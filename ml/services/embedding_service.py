from __future__ import annotations

import asyncio
import os
import threading
from io import BytesIO
from pathlib import Path
from typing import Any

os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")
os.environ.setdefault("HF_HUB_DISABLE_IMPLICIT_TOKEN", "1")
os.environ.setdefault("HF_HUB_DISABLE_PROGRESS_BARS", "1")
os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
os.environ.setdefault("DO_NOT_TRACK", "1")
if os.name == "nt":
    # Conda packages on Windows may otherwise load two OpenMP runtimes.
    os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")
    os.environ.setdefault("OMP_NUM_THREADS", "1")
    os.environ.setdefault("MKL_NUM_THREADS", "1")

from fastapi import FastAPI, File, HTTPException, UploadFile
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel, Field


RUNTIME_KIND = os.getenv("EMBEDDING_RUNTIME", "transformers_clip")
MODEL_NAME = os.getenv(
    "EMBEDDING_MODEL_NAME",
    os.getenv(
        "OPENCLIP_MODEL_NAME",
        "wkcn/TinyCLIP-ViT-8M-16-Text-3M-YFCC15M",
    ),
)
MODEL_PATH = Path(
    os.getenv(
        "EMBEDDING_MODEL_PATH",
        os.getenv("OPENCLIP_WEIGHTS_PATH", "models/tinyclip"),
    )
)
MODEL_REVISION = (
    os.getenv("EMBEDDING_MODEL_REVISION")
    or os.getenv("OPENCLIP_MODEL_REVISION")
    or None
)
MAX_IMAGE_MB = int(
    os.getenv("EMBEDDING_MAX_IMAGE_MB", os.getenv("OPENCLIP_MAX_IMAGE_MB", "50"))
)


class TextEmbeddingRequest(BaseModel):
    text: str = Field(min_length=1, max_length=8000)


class OpenClipRuntime:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._model: Any = None
        self._preprocess: Any = None
        self._tokenizer: Any = None
        self._torch: Any = None
        self._device: str | None = None

    @property
    def loaded(self) -> bool:
        return self._model is not None

    @property
    def device(self) -> str | None:
        return self._device

    def load(self) -> None:
        if self.loaded:
            return
        with self._lock:
            if self.loaded:
                return
            if not MODEL_PATH.is_file():
                raise FileNotFoundError(
                    "OpenCLIP weights are missing. Set OPENCLIP_WEIGHTS_PATH "
                    f"to a local file; implicit downloads are disabled: {MODEL_PATH}"
                )

            import open_clip
            import torch

            device = "cuda" if torch.cuda.is_available() else "cpu"
            model, _, preprocess = open_clip.create_model_and_transforms(
                MODEL_NAME,
                pretrained=str(MODEL_PATH.resolve()),
            )
            self._model = model.to(device).eval()
            self._preprocess = preprocess
            self._tokenizer = open_clip.get_tokenizer(MODEL_NAME)
            self._torch = torch
            self._device = device

    def encode_text(self, text: str) -> list[float]:
        self.load()
        with self._torch.inference_mode():
            tokens = self._tokenizer([text]).to(self._device)
            vector = self._model.encode_text(tokens)
            vector = vector / vector.norm(dim=-1, keepdim=True).clamp_min(1e-12)
        return vector[0].detach().cpu().float().tolist()

    def encode_image(self, image: Image.Image) -> list[float]:
        self.load()
        with self._torch.inference_mode():
            tensor = self._preprocess(image.convert("RGB"))
            tensor = tensor.unsqueeze(0).to(self._device)
            vector = self._model.encode_image(tensor)
            vector = vector / vector.norm(dim=-1, keepdim=True).clamp_min(1e-12)
        return vector[0].detach().cpu().float().tolist()


class TransformersClipRuntime:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._model: Any = None
        self._processor: Any = None
        self._torch: Any = None
        self._device: str | None = None

    @property
    def loaded(self) -> bool:
        return self._model is not None

    @property
    def device(self) -> str | None:
        return self._device

    def load(self) -> None:
        if self.loaded:
            return
        with self._lock:
            if self.loaded:
                return
            if not MODEL_PATH.is_dir():
                raise FileNotFoundError(
                    "Local Transformers CLIP directory is missing. Set "
                    f"EMBEDDING_MODEL_PATH; implicit downloads are disabled: {MODEL_PATH}"
                )

            import torch
            from transformers import CLIPModel, CLIPProcessor

            device = "cuda" if torch.cuda.is_available() else "cpu"
            processor = CLIPProcessor.from_pretrained(
                str(MODEL_PATH.resolve()),
                local_files_only=True,
                use_fast=False,
            )
            model = CLIPModel.from_pretrained(
                str(MODEL_PATH.resolve()),
                local_files_only=True,
            )
            self._model = model.to(device).eval()
            self._processor = processor
            self._torch = torch
            self._device = device

    @staticmethod
    def _pooled_feature(output: Any) -> Any:
        return output.pooler_output if hasattr(output, "pooler_output") else output

    def encode_text(self, text: str) -> list[float]:
        self.load()
        max_tokens = int(self._model.config.text_config.max_position_embeddings)
        inputs = self._processor(
            text=[text],
            return_tensors="pt",
            padding=True,
            truncation=True,
            max_length=max_tokens,
        )
        model_inputs = {
            key: value.to(self._device)
            for key, value in inputs.items()
            if key in {"input_ids", "attention_mask", "position_ids"}
        }
        with self._torch.inference_mode():
            output = self._model.get_text_features(**model_inputs)
            vector = self._pooled_feature(output)
            vector = vector / vector.norm(dim=-1, keepdim=True).clamp_min(1e-12)
        return vector[0].detach().cpu().float().tolist()

    def text_diagnostics(self, text: str) -> dict[str, Any]:
        self.load()
        token_ids = self._processor.tokenizer(
            text,
            add_special_tokens=True,
            truncation=False,
        )["input_ids"]
        max_tokens = int(self._model.config.text_config.max_position_embeddings)
        return {
            "tokens_before_truncation": len(token_ids),
            "model_max_tokens": max_tokens,
            "truncated": len(token_ids) > max_tokens,
        }

    def encode_image(self, image: Image.Image) -> list[float]:
        self.load()
        inputs = self._processor(
            images=image.convert("RGB"),
            return_tensors="pt",
        )
        with self._torch.inference_mode():
            output = self._model.get_image_features(
                pixel_values=inputs["pixel_values"].to(self._device)
            )
            vector = self._pooled_feature(output)
            vector = vector / vector.norm(dim=-1, keepdim=True).clamp_min(1e-12)
        return vector[0].detach().cpu().float().tolist()


if RUNTIME_KIND == "open_clip":
    runtime: OpenClipRuntime | TransformersClipRuntime = OpenClipRuntime()
elif RUNTIME_KIND == "transformers_clip":
    runtime = TransformersClipRuntime()
else:
    raise RuntimeError(f"Unsupported EMBEDDING_RUNTIME: {RUNTIME_KIND}")

app = FastAPI(
    title="Photo AI Local Embedding Service",
    version="0.1.0",
)


def embedding_response(
    vector: list[float],
    *,
    input_diagnostics: dict[str, Any] | None = None,
) -> dict[str, Any]:
    response = {
        "vector": vector,
        "dimensions": len(vector),
        "model": MODEL_NAME,
        "revision": MODEL_REVISION,
        "runtime": RUNTIME_KIND,
        "device": runtime.device,
        "local_only": True,
    }
    if input_diagnostics is not None:
        response["input"] = input_diagnostics
    return response


@app.get("/health/live")
async def liveness() -> dict[str, Any]:
    return {
        "status": "ok",
        "model": MODEL_NAME,
        "runtime": RUNTIME_KIND,
        "model_path": str(MODEL_PATH),
        "model_present": MODEL_PATH.exists(),
        "loaded": runtime.loaded,
        "local_only": True,
    }


@app.get("/health/model")
async def model_health(load: bool = False) -> dict[str, Any]:
    if load:
        try:
            runtime.load()
        except Exception as exc:
            raise HTTPException(
                status_code=503,
                detail=f"{exc.__class__.__name__}: {exc}",
            ) from exc
    return {
        "ready": runtime.loaded,
        "model": MODEL_NAME,
        "runtime": RUNTIME_KIND,
        "device": runtime.device,
        "model_present": MODEL_PATH.exists(),
    }


@app.post("/embed/text")
async def embed_text(payload: TextEmbeddingRequest) -> dict[str, Any]:
    try:
        if not runtime.loaded:
            runtime.load()
        vector = await asyncio.to_thread(runtime.encode_text, payload.text)
        diagnostics = None
        if isinstance(runtime, TransformersClipRuntime):
            diagnostics = await asyncio.to_thread(
                runtime.text_diagnostics,
                payload.text,
            )
        return embedding_response(vector, input_diagnostics=diagnostics)
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail=f"{exc.__class__.__name__}: {exc}",
        ) from exc


@app.post("/embed/image")
async def embed_image(
    image: UploadFile = File(...),
) -> dict[str, Any]:
    content = await image.read(MAX_IMAGE_MB * 1024 * 1024 + 1)
    await image.close()
    if len(content) > MAX_IMAGE_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Image is too large")

    try:
        with Image.open(BytesIO(content)) as opened:
            opened.load()
            if not runtime.loaded:
                runtime.load()
            vector = await asyncio.to_thread(
                runtime.encode_image,
                opened.copy(),
            )
        return embedding_response(vector)
    except (UnidentifiedImageError, OSError) as exc:
        raise HTTPException(status_code=415, detail="Invalid image") from exc
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail=f"{exc.__class__.__name__}: {exc}",
        ) from exc
