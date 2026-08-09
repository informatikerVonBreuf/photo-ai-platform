from __future__ import annotations

import asyncio
import json
from typing import Any

import pytest

from backend.app.vlm import (
    LocalVlmJudgeClient,
    VlmCandidate,
    VlmResponseError,
)


class FakeResponse:
    def __init__(self, body: dict[str, Any]) -> None:
        self.body = body

    def raise_for_status(self) -> None:
        return None

    def json(self) -> dict[str, Any]:
        return self.body


class FakeAsyncClient:
    payloads: list[dict[str, Any]] = []
    response_content = ""

    def __init__(self, **kwargs: Any) -> None:
        self.kwargs = kwargs

    async def __aenter__(self) -> "FakeAsyncClient":
        return self

    async def __aexit__(self, *args: Any) -> None:
        return None

    async def post(self, url: str, *, json: dict[str, Any]) -> FakeResponse:
        self.payloads.append(json)
        return FakeResponse(
            {
                "choices": [
                    {"message": {"content": self.response_content}}
                ]
            }
        )


def make_client() -> LocalVlmJudgeClient:
    return LocalVlmJudgeClient(
        server_url="http://llama:8080",
        model="qwen-vl",
        timeout_seconds=30,
    )


def make_candidate() -> VlmCandidate:
    return VlmCandidate(
        candidate_id="candidate_1",
        content=b"image",
        content_type="image/jpeg",
        caption="food on a table",
    )


def test_vlm_uses_llama_cpp_json_schema_contract(monkeypatch) -> None:
    FakeAsyncClient.payloads = []
    FakeAsyncClient.response_content = json.dumps(
        {
            "judgements": [
                {
                    "candidate_id": "candidate_1",
                    "relevant": True,
                    "confidence": 0.91,
                    "reason": "Food is visibly on the table.",
                }
            ]
        }
    )
    monkeypatch.setattr("backend.app.vlm.httpx.AsyncClient", FakeAsyncClient)

    result = asyncio.run(
        make_client().judge_candidates(
            query="food on a table",
            candidates=[make_candidate()],
        )
    )

    response_format = FakeAsyncClient.payloads[0]["response_format"]
    assert response_format["type"] == "json_schema"
    assert response_format["json_schema"]["strict"] is True
    assert response_format["json_schema"]["schema"]["required"] == [
        "judgements"
    ]
    assert result[0].relevant is True
    assert result[0].confidence == 0.91


def test_vlm_rejects_empty_structured_output(monkeypatch) -> None:
    FakeAsyncClient.payloads = []
    FakeAsyncClient.response_content = ""
    monkeypatch.setattr("backend.app.vlm.httpx.AsyncClient", FakeAsyncClient)

    with pytest.raises(VlmResponseError):
        asyncio.run(
            make_client().judge_candidates(
                query="food on a table",
                candidates=[make_candidate()],
            )
        )

