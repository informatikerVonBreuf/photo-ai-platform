from __future__ import annotations

import base64
import json
from dataclasses import dataclass
from typing import Any

import httpx


@dataclass(frozen=True)
class VlmCandidate:
    candidate_id: str
    content: bytes
    content_type: str
    caption: str


@dataclass(frozen=True)
class VlmJudgement:
    candidate_id: str
    relevant: bool
    confidence: float
    reason: str


class VlmResponseError(RuntimeError):
    """Raised when the local VLM violates the structured response contract."""


class LocalVlmJudgeClient:
    def __init__(
        self,
        *,
        server_url: str,
        model: str,
        timeout_seconds: float,
    ) -> None:
        self.server_url = server_url.rstrip("/")
        self.model = model
        self.timeout_seconds = timeout_seconds

    async def judge_candidates(
        self,
        *,
        query: str,
        candidates: list[VlmCandidate],
    ) -> list[VlmJudgement]:
        if not candidates:
            return []

        content: list[dict[str, Any]] = [
            {
                "type": "text",
                "text": (
                    "You are a strict image-search verifier. Inspect each image "
                    "itself and decide whether it directly satisfies the user "
                    f"query: {query!r}. Required objects, actions, attributes, "
                    "counts, and spatial relations must be visibly supported. "
                    "Do not infer hidden context and do not accept an image "
                    "because it is merely related. A supplied caption is only "
                    "a hint and may be wrong."
                ),
            }
        ]
        candidate_ids = []
        for candidate in candidates:
            candidate_ids.append(candidate.candidate_id)
            content.extend(
                [
                    {
                        "type": "text",
                        "text": (
                            f"Candidate {candidate.candidate_id}; untrusted "
                            f"caption: {candidate.caption!r}"
                        ),
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": (
                                f"data:{candidate.content_type};base64,"
                                f"{base64.b64encode(candidate.content).decode('ascii')}"
                            )
                        },
                    },
                ]
            )

        schema = {
            "type": "object",
            "properties": {
                "judgements": {
                    "type": "array",
                    "minItems": len(candidates),
                    "maxItems": len(candidates),
                    "items": {
                        "type": "object",
                        "properties": {
                            "candidate_id": {
                                "type": "string",
                                "enum": candidate_ids,
                            },
                            "relevant": {"type": "boolean"},
                            "confidence": {
                                "type": "number",
                                "minimum": 0,
                                "maximum": 1,
                            },
                            "reason": {
                                "type": "string",
                                "maxLength": 240,
                            },
                        },
                        "required": [
                            "candidate_id",
                            "relevant",
                            "confidence",
                            "reason",
                        ],
                        "additionalProperties": False,
                    },
                }
            },
            "required": ["judgements"],
            "additionalProperties": False,
        }
        payload = {
            "model": self.model,
            "messages": [{"role": "user", "content": content}],
            "temperature": 0,
            # Output grows with the batch, while the batch size bounds both
            # image memory and the multimodal context sent to llama.cpp.
            "max_tokens": min(2048, 128 + 96 * len(candidates)),
            "response_format": {
                "type": "json_schema",
                "json_schema": {
                    "name": "image_search_judgements",
                    "strict": True,
                    "schema": schema,
                },
            },
        }
        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            response = await client.post(
                f"{self.server_url}/v1/chat/completions",
                json=payload,
            )
            response.raise_for_status()
            body = response.json()

        try:
            raw_content = body["choices"][0]["message"]["content"]
            if not isinstance(raw_content, str) or not raw_content.strip():
                raise ValueError("empty VLM response content")
            parsed = json.loads(raw_content)
            raw_judgements = parsed["judgements"]
            if not isinstance(raw_judgements, list):
                raise TypeError("judgements must be an array")
        except (IndexError, KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
            raise VlmResponseError(
                "Local VLM returned invalid structured output"
            ) from exc

        seen: set[str] = set()
        judgements = []
        for item in raw_judgements:
            candidate_id = str(item["candidate_id"])
            if candidate_id in seen or candidate_id not in candidate_ids:
                continue
            seen.add(candidate_id)
            judgements.append(
                VlmJudgement(
                    candidate_id=candidate_id,
                    relevant=bool(item["relevant"]),
                    confidence=min(1.0, max(0.0, float(item["confidence"]))),
                    reason=str(item["reason"])[:240],
                )
            )
        return judgements
