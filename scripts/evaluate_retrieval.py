from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from ml.evaluation import evaluate_retrieval_run


def load_queries(path: Path) -> list[dict[str, Any]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    queries = payload.get("queries")
    if not isinstance(queries, list):
        raise ValueError(f"{path} must contain a 'queries' list")
    return queries


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Evaluate a staged multimodal retrieval run against qrels."
    )
    parser.add_argument("--qrels", type=Path, required=True)
    parser.add_argument("--run", type=Path, required=True)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()

    qrels = {
        str(row["query_id"]): {
            str(photo_id): float(grade)
            for photo_id, grade in row.get("relevance", {}).items()
        }
        for row in load_queries(args.qrels)
    }
    runs = {
        str(row["query_id"]): {
            str(stage): [str(photo_id) for photo_id in photo_ids]
            for stage, photo_ids in row.get("stages", {}).items()
        }
        for row in load_queries(args.run)
    }
    report = evaluate_retrieval_run(qrels, runs)
    serialized = json.dumps(report, indent=2, ensure_ascii=True)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(serialized + "\n", encoding="utf-8")
    print(serialized)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
