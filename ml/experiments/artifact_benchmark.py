"""Run lightweight benchmarks on cached image/caption artifacts.

This script is intentionally model-free at runtime. It uses the cached
embeddings and captions already produced by the research notebooks to smoke-test
three product capabilities:

- image -> image retrieval
- text -> image retrieval through captions and seed-caption expansion
- image clustering through a similarity graph
"""

from __future__ import annotations

import argparse
import json
import math
import os
import re
import shutil
import unicodedata
from collections import Counter, defaultdict, deque
from dataclasses import dataclass
from pathlib import Path
from time import perf_counter

# Windows/conda can load two OpenMP runtimes when torch/open_clip and numpy-like
# packages are used together. This keeps the benchmark runnable; production
# images should instead pin a single clean numerical stack.
os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")
os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS", "1")

import numpy as np

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:  # pragma: no cover - visual output is optional.
    Image = None
    ImageDraw = None
    ImageFont = None


IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
DEFAULT_QUERIES = [
    "person riding horse",
    "dog",
    "bus street",
    "kitchen table",
    "bear grass",
    "tennis player",
    "pizza food",
    "beach surf",
    "cat sofa",
    "airplane sky",
    "baseball player",
    "skiing snow",
    "zebra grass",
    "train station",
    "traffic light",
    "wine glass table",
    "elephant",
    "boat water",
    "child skateboard",
    "bird branch",
    "bathroom sink",
    "laptop desk",
    "sheep field",
    "motorcycle road",
    "orange fruit",
    "bench park",
    "fire hydrant street",
    "cake plate",
    "giraffe",
    "snowboarder",
    "two people playing tennis",
    "person standing near bus on street",
    "animal sitting on couch indoors",
    "group of people eating at table",
    "small boat on water",
    "person with skis in snow",
    "food close up on plate",
    "traffic scene with cars and lights",
    "child playing outdoor sport",
    "living room with furniture",
]

DEFAULT_DENSE_QUERY_CASES = [
    {
        "query": "person riding a horse outdoors without cars or motorcycles",
        "positive": ["person", "riding", "horse", "outdoor"],
        "negative": ["car", "motorcycle"],
    },
    {
        "query": "dog sitting on a couch indoors but not a cat",
        "positive": ["dog", "couch", "indoor"],
        "negative": ["cat"],
    },
    {
        "query": "kitchen or dining table with food and no people",
        "positive": ["kitchen", "table", "food"],
        "negative": ["people"],
    },
    {
        "query": "bus on a city street without trains",
        "positive": ["bus", "street"],
        "negative": ["train"],
    },
    {
        "query": "tennis player on court, not baseball or skiing",
        "positive": ["tennis", "player"],
        "negative": ["baseball", "skiing"],
    },
    {
        "query": "boat on water with no airplane or train",
        "positive": ["boat", "water"],
        "negative": ["airplane", "train"],
    },
    {
        "query": "bathroom with sink and mirror, no kitchen",
        "positive": ["bathroom", "sink", "mirror"],
        "negative": ["kitchen"],
    },
]

DEFAULT_NATURAL_DENSE_QUERY_CASES = [
    "I need a clean kitchen or dining table with visible food, but no people in the shot.",
    "Find a dog relaxing on a sofa indoors, ideally no cats around.",
    "Show me someone riding a horse outside, avoid cars and motorcycles.",
    "I want a bus in a city street scene rather than a train station.",
    "Looking for a tennis player on court, not baseball and not skiing.",
    "A small boat on the water, no airplane or train in the scene.",
    "Bathroom interior with a sink and mirror, but not a kitchen.",
    "A plate of pizza or food on a table, without people.",
    "Street traffic with cars and a traffic light, no animals.",
    "A person using skis in the snow, not a snowboard.",
    "Animal in grass, preferably a zebra or giraffe, without people.",
    "A laptop on a desk in an indoor room, no food on the table.",
    "Beach or water sport scene with a surfer, not a boat.",
    "A child on a skateboard outdoors, avoid bicycles.",
    "Living room furniture with couch or sofa, no dog or cat.",
    "A bird sitting on a branch, not an airplane in the sky.",
    "A fire hydrant on the street with no people nearby.",
    "A cake or dessert on a plate, no kitchen sink.",
    "A train on tracks or at a station, not a bus.",
    "A motorcycle on a road, no bicycle.",
    "A group eating around a table, no animals.",
    "A bench in a park or outdoor area, not a couch indoors.",
    "A bear in grass or outdoors, no people.",
    "A baseball player on a field, not tennis.",
    "A sheep or cow in a field, no cars.",
    "Je veux une photo d'un chien sur un canape, sans chat.",
    "Montre une cuisine avec une table et de la nourriture, mais pas de personne.",
    "Trouve un bateau sur l'eau, sauf avion ou train.",
    "Image d'une salle de bain avec lavabo et miroir, sans cuisine.",
    "Je cherche une rue avec un bus, pas une gare avec un train.",
    "Un joueur de tennis sur le court, sans baseball ni ski.",
    "Un ordinateur portable sur un bureau dans une piece, pas de nourriture.",
]

CATEGORY_KEYWORDS = {
    "people": {
        "person",
        "people",
        "man",
        "woman",
        "child",
        "girl",
        "boy",
        "player",
        "rider",
        "group",
    },
    "animals": {
        "dog",
        "cat",
        "bear",
        "horse",
        "zebra",
        "giraffe",
        "elephant",
        "sheep",
        "bird",
        "cow",
    },
    "vehicles": {
        "bus",
        "car",
        "truck",
        "train",
        "airplane",
        "motorcycle",
        "bike",
        "bicycle",
        "boat",
    },
    "food": {
        "pizza",
        "cake",
        "food",
        "plate",
        "table",
        "kitchen",
        "orange",
        "fruit",
        "wine",
        "glass",
    },
    "sports": {
        "tennis",
        "baseball",
        "ski",
        "skis",
        "snowboard",
        "surf",
        "skateboard",
        "sport",
    },
    "indoor": {
        "room",
        "sofa",
        "couch",
        "bed",
        "bathroom",
        "sink",
        "laptop",
        "desk",
        "furniture",
    },
    "outdoor": {
        "street",
        "road",
        "park",
        "field",
        "grass",
        "beach",
        "water",
        "snow",
        "branch",
    },
}

TERM_EXPANSIONS = {
    "animal": {"animal", "dog", "cat", "bear", "horse", "zebra", "giraffe", "elephant", "sheep", "cow", "bird"},
    "people": {"person", "people", "man", "woman", "child", "girl", "boy", "player", "group"},
    "person": {"person", "people", "man", "woman", "child", "girl", "boy", "player"},
    "outdoor": {"outdoor", "outside", "street", "road", "park", "field", "grass", "beach", "water", "snow"},
    "indoor": {"indoor", "inside", "room", "kitchen", "bathroom", "sofa", "couch", "bed"},
    "car": {"car", "cars", "truck", "vehicle"},
    "motorcycle": {"motorcycle", "motorbike", "bike"},
    "bicycle": {"bicycle", "bike"},
    "skiing": {"skiing", "ski", "skis", "snowboard", "snowboarder"},
    "food": {"food", "pizza", "cake", "plate", "sandwich", "fruit", "orange"},
    "couch": {"couch", "sofa"},
    "vehicle": {"vehicle", "car", "truck", "bus", "train", "motorcycle", "bicycle"},
}

CONCEPT_ALIASES = {
    "airplanes": "airplane",
    "animals": "animal",
    "bicycles": "bicycle",
    "bikes": "bicycle",
    "boats": "boat",
    "buses": "bus",
    "cars": "car",
    "cats": "cat",
    "couches": "couch",
    "cows": "cow",
    "dogs": "dog",
    "fields": "field",
    "giraffes": "giraffe",
    "horses": "horse",
    "indoors": "indoor",
    "kitchens": "kitchen",
    "motorbikes": "motorcycle",
    "motorcycles": "motorcycle",
    "outdoors": "outdoor",
    "outside": "outdoor",
    "plates": "plate",
    "players": "player",
    "relaxing": "sitting",
    "rooms": "room",
    "skis": "ski",
    "snowboarder": "snowboard",
    "snowboarders": "snowboard",
    "sofas": "couch",
    "streets": "street",
    "tables": "table",
    "trains": "train",
    "vehicles": "vehicle",
    "zebras": "zebra",
    "animaux": "animal",
    "assiette": "plate",
    "assiettes": "plate",
    "avion": "airplane",
    "avions": "airplane",
    "bateau": "boat",
    "bateaux": "boat",
    "bureau": "desk",
    "bus": "bus",
    "canape": "couch",
    "canapes": "couch",
    "chat": "cat",
    "chats": "cat",
    "cheval": "horse",
    "chevaux": "horse",
    "chien": "dog",
    "chiens": "dog",
    "cuisine": "kitchen",
    "eau": "water",
    "exterieur": "outdoor",
    "gare": "station",
    "interieur": "indoor",
    "interior": "indoor",
    "joueur": "player",
    "joueuse": "player",
    "lavabo": "sink",
    "mer": "water",
    "miroir": "mirror",
    "moto": "motorcycle",
    "motos": "motorcycle",
    "mouton": "sheep",
    "nourriture": "food",
    "ordinateur": "laptop",
    "personne": "people",
    "personnes": "people",
    "piece": "room",
    "plage": "beach",
    "rue": "street",
    "salle": "room",
    "ski": "ski",
    "table": "table",
    "tennis": "tennis",
    "train": "train",
    "trains": "train",
    "velo": "bicycle",
    "velos": "bicycle",
    "voiture": "car",
    "voitures": "car",
    "zebre": "zebra",
    "zebres": "zebra",
    "somebody": "person",
    "someone": "person",
}

PROMPT_STOPWORDS = {
    "a",
    "an",
    "and",
    "any",
    "around",
    "at",
    "be",
    "but",
    "clean",
    "clear",
    "dans",
    "d",
    "de",
    "des",
    "du",
    "et",
    "en",
    "find",
    "for",
    "good",
    "i",
    "idealement",
    "ideally",
    "image",
    "in",
    "it",
    "je",
    "la",
    "l",
    "le",
    "les",
    "looking",
    "me",
    "montre",
    "nearby",
    "need",
    "ni",
    "of",
    "on",
    "or",
    "ou",
    "photo",
    "picture",
    "please",
    "prefer",
    "preferably",
    "pour",
    "plutot",
    "quality",
    "scene",
    "cherche",
    "shot",
    "show",
    "showing",
    "small",
    "sur",
    "that",
    "the",
    "to",
    "trouve",
    "un",
    "une",
    "using",
    "veut",
    "veux",
    "visible",
    "want",
    "with",
}

NEGATION_PATTERN = re.compile(
    r"\b(?:but\s+not|rather\s+than|instead\s+of|free\s+of|without|avoid(?:ing)?|exclude(?:s|d|ing)?|except|no|not|mais\s+pas|sans|sauf|aucun|aucune)\b|pas\s+d[eu']?",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class ArtifactDataset:
    paths: list[Path]
    captions: list[str]
    image_embeddings: np.ndarray
    caption_embeddings: np.ndarray
    mapping_note: str


def canonical_token(token: str) -> str:
    return CONCEPT_ALIASES.get(token, token)


def tokenize(text: str) -> list[str]:
    normalized_text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    raw_tokens = re.findall(r"[a-z0-9]+", normalized_text.lower())
    tokens = [canonical_token(token) for token in raw_tokens]
    return [token for token in tokens if token not in PROMPT_STOPWORDS]


def normalize(matrix: np.ndarray) -> np.ndarray:
    matrix = matrix.astype(np.float32, copy=False)
    norms = np.linalg.norm(matrix, axis=1, keepdims=True)
    norms[norms == 0] = 1
    return matrix / norms


def load_dataset(data_dir: Path, artifacts_dir: Path, limit: int | None = None) -> ArtifactDataset:
    image_paths_all = sorted(
        path
        for path in data_dir.iterdir()
        if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS
    )
    captions = json.loads((artifacts_dir / "captions_blip.json").read_text(encoding="utf-8"))
    image_embeddings = np.load(artifacts_dir / "emb_img.npy")
    caption_embeddings = np.load(artifacts_dir / "emb_cap.npy")

    artifact_count = min(len(captions), len(image_embeddings), len(caption_embeddings))
    mapping_note = "paths aligned directly with cached artifacts"
    image_paths = image_paths_all
    if len(image_paths_all) != artifact_count:
        without_copies = [path for path in image_paths_all if " - Copie" not in path.stem]
        if len(without_copies) == artifact_count:
            image_paths = without_copies
            mapping_note = "excluded local '- Copie' files to match cached artifact count"

    count = min(len(image_paths), artifact_count)
    if limit:
        count = min(count, limit)

    return ArtifactDataset(
        paths=image_paths[:count],
        captions=captions[:count],
        image_embeddings=normalize(image_embeddings[:count]),
        caption_embeddings=normalize(caption_embeddings[:count]),
        mapping_note=mapping_note,
    )


def top_indices(scores: np.ndarray, k: int, exclude: int | None = None) -> list[int]:
    scores = scores.copy()
    if exclude is not None:
        scores[exclude] = -np.inf
    if k >= len(scores):
        return np.argsort(-scores).tolist()
    candidates = np.argpartition(-scores, kth=k)[:k]
    return candidates[np.argsort(-scores[candidates])].tolist()


def image_base_name(path: Path) -> str:
    return path.stem.replace(" - Copie", "").lower()


def duplicate_groups(paths: list[Path]) -> dict[str, list[int]]:
    groups: dict[str, list[int]] = defaultdict(list)
    for index, path in enumerate(paths):
        groups[image_base_name(path)].append(index)
    return {key: value for key, value in groups.items() if len(value) > 1}


def build_bm25(captions: list[str]) -> tuple[list[Counter[str]], dict[str, float], float]:
    docs = [Counter(tokenize(caption)) for caption in captions]
    df = Counter()
    lengths = []
    for doc in docs:
        lengths.append(sum(doc.values()))
        for token in doc:
            df[token] += 1
    total = len(docs)
    avgdl = sum(lengths) / total if total else 1
    idf = {token: math.log((total - freq + 0.5) / (freq + 0.5) + 1) for token, freq in df.items()}
    return docs, idf, avgdl


def bm25_scores(query: str, docs: list[Counter[str]], idf: dict[str, float], avgdl: float) -> np.ndarray:
    query_tokens = tokenize(query)
    scores = np.zeros(len(docs), dtype=np.float32)
    k1 = 1.5
    b = 0.75
    for index, doc in enumerate(docs):
        doc_len = sum(doc.values()) or 1
        for token in query_tokens:
            freq = doc.get(token, 0)
            if not freq:
                continue
            denom = freq + k1 * (1 - b + b * doc_len / avgdl)
            scores[index] += idf.get(token, 0.0) * freq * (k1 + 1) / denom
    return scores


def tfidf_scores(query: str, docs: list[Counter[str]], idf: dict[str, float]) -> np.ndarray:
    query_counts = Counter(tokenize(query))
    query_weights = {token: count * idf.get(token, 0.0) for token, count in query_counts.items()}
    query_norm = math.sqrt(sum(value * value for value in query_weights.values())) or 1
    scores = np.zeros(len(docs), dtype=np.float32)

    for index, doc in enumerate(docs):
        doc_weights = {token: count * idf.get(token, 0.0) for token, count in doc.items()}
        doc_norm = math.sqrt(sum(value * value for value in doc_weights.values())) or 1
        dot = sum(query_weights.get(token, 0.0) * value for token, value in doc_weights.items())
        scores[index] = dot / (query_norm * doc_norm)
    return scores


def minmax_scores(scores: np.ndarray) -> np.ndarray:
    finite = np.isfinite(scores)
    if not finite.any():
        return np.zeros_like(scores, dtype=np.float32)
    valid = scores[finite]
    low = float(valid.min())
    high = float(valid.max())
    if high <= low:
        return np.zeros_like(scores, dtype=np.float32)
    normalized = np.zeros_like(scores, dtype=np.float32)
    normalized[finite] = (scores[finite] - low) / (high - low)
    return normalized


def weighted_sum(weighted_scores: list[tuple[float, np.ndarray]]) -> np.ndarray:
    output = np.zeros_like(weighted_scores[0][1], dtype=np.float32)
    for weight, scores in weighted_scores:
        output += weight * minmax_scores(scores)
    return output


def restrict_to_candidates(scores: np.ndarray, candidates: list[int], candidate_count: int = 300) -> np.ndarray:
    restricted = np.full_like(scores, -np.inf, dtype=np.float32)
    selected = candidates[: min(candidate_count, len(candidates))]
    restricted[selected] = scores[selected]
    return restricted


def interleave_rankings(rankings: list[list[int]], top_k: int) -> list[int]:
    seen = set()
    output = []
    max_len = max((len(ranking) for ranking in rankings), default=0)
    for offset in range(max_len):
        for ranking in rankings:
            if offset >= len(ranking):
                continue
            index = ranking[offset]
            if index in seen:
                continue
            seen.add(index)
            output.append(index)
            if len(output) >= top_k:
                return output
    return output


def reciprocal_rank_fusion(rankings: list[list[int]], size: int, k: int = 60) -> np.ndarray:
    scores = np.zeros(size, dtype=np.float32)
    for ranking in rankings:
        for rank, index in enumerate(ranking, start=1):
            scores[index] += 1 / (k + rank)
    return scores


def caption_relevance(query: str, captions: list[str]) -> set[int]:
    query_tokens = set(tokenize(query))
    if not query_tokens:
        return set()
    relevant = set()
    min_hits = max(1, math.ceil(len(query_tokens) / 2))
    for index, caption in enumerate(captions):
        hits = query_tokens & set(tokenize(caption))
        if len(hits) >= min_hits:
            relevant.add(index)
    return relevant


def expand_term(term: str) -> set[str]:
    token = term.lower().strip()
    if not token:
        return set()
    return {token, *TERM_EXPANSIONS.get(token, set())}


def concept_hit_count(tokens: set[str], concepts: list[str]) -> int:
    return sum(1 for concept in concepts if tokens & expand_term(concept))


def any_concept_hit(tokens: set[str], concepts: list[str]) -> bool:
    return concept_hit_count(tokens, concepts) > 0


def normalize_constraint_terms(terms: list[object]) -> list[str]:
    normalized = []
    for term in terms:
        normalized.extend(tokenize(str(term)))
    return list(dict.fromkeys(normalized))


def listish(value: object) -> list[object]:
    if isinstance(value, str):
        return [value]
    if isinstance(value, list | tuple | set):
        return list(value)
    return [value]


def infer_constraints_from_query(query: str) -> tuple[list[str], list[str]]:
    parts = [part.strip() for part in NEGATION_PATTERN.split(query.lower()) if part.strip()]
    if not parts:
        return normalize_constraint_terms([query]), []
    positive = normalize_constraint_terms([parts[0]])
    negative = []
    for part in parts[1:]:
        negative.extend(normalize_constraint_terms([part]))
    negative = list(dict.fromkeys(negative))
    positive = [term for term in positive if term not in negative]
    return positive, negative


def normalize_dense_case(case: dict[str, object] | str) -> dict[str, object]:
    if isinstance(case, str):
        query = case
        positive, negative = infer_constraints_from_query(query)
        constraint_source = "inferred"
    else:
        query = str(case["query"])
        inferred_positive, inferred_negative = infer_constraints_from_query(query)
        has_explicit_constraints = "positive" in case or "negative" in case
        positive = normalize_constraint_terms(listish(case.get("positive", inferred_positive)))
        negative = normalize_constraint_terms(listish(case.get("negative", inferred_negative)))
        constraint_source = str(
            case.get("constraint_source", "provided" if has_explicit_constraints else "inferred")
        )
    return {
        "query": query,
        "positive": positive,
        "negative": negative,
        "constraint_source": constraint_source,
    }


def positive_coverage_scores(caption_tokens: list[set[str]], positive: list[str]) -> np.ndarray:
    scores = np.zeros(len(caption_tokens), dtype=np.float32)
    if not positive:
        return scores
    denom = max(1, len(positive))
    for index, tokens in enumerate(caption_tokens):
        scores[index] = concept_hit_count(tokens, positive) / denom
    return scores


def negative_hit_scores(caption_tokens: list[set[str]], negative: list[str]) -> np.ndarray:
    scores = np.zeros(len(caption_tokens), dtype=np.float32)
    if not negative:
        return scores
    denom = max(1, len(negative))
    for index, tokens in enumerate(caption_tokens):
        scores[index] = concept_hit_count(tokens, negative) / denom
    return scores


def constraint_support_counts(caption_tokens: list[set[str]], concepts: list[str]) -> dict[str, int]:
    return {
        concept: sum(1 for tokens in caption_tokens if tokens & expand_term(concept))
        for concept in concepts
    }


def max_similarity_to_terms(matrix: np.ndarray, term_embeddings: np.ndarray | None) -> np.ndarray:
    if term_embeddings is None or len(term_embeddings) == 0:
        return np.zeros(len(matrix), dtype=np.float32)
    return np.max(matrix @ term_embeddings.T, axis=1).astype(np.float32)


def dense_relevance(
    caption_tokens: list[set[str]],
    positive: list[str],
    negative: list[str],
) -> set[int]:
    if not positive:
        return set()
    min_hits = max(1, math.ceil(len(positive) / 2))
    relevant = set()
    for index, tokens in enumerate(caption_tokens):
        if concept_hit_count(tokens, positive) < min_hits:
            continue
        if any_concept_hit(tokens, negative):
            continue
        relevant.add(index)
    return relevant


def dense_ranking_metrics(
    ranking: list[int],
    relevant: set[int],
    caption_tokens: list[set[str]],
    positive: list[str],
    negative: list[str],
    top_k: int,
) -> dict[str, float]:
    selected = ranking[:top_k]
    if not selected:
        return {
            "constraint_precision_at_k": 0.0,
            "false_positive_rate_at_k": 0.0,
            "avg_positive_coverage_at_k": 0.0,
        }
    positive_denom = max(1, len(positive))
    false_positives = sum(1 for index in selected if any_concept_hit(caption_tokens[index], negative))
    positive_coverage = [
        concept_hit_count(caption_tokens[index], positive) / positive_denom for index in selected
    ]
    return {
        "constraint_precision_at_k": len(set(selected) & relevant) / top_k if relevant else 0.0,
        "false_positive_rate_at_k": false_positives / len(selected),
        "avg_positive_coverage_at_k": float(np.mean(positive_coverage)) if positive_coverage else 0.0,
    }


def caption_category(caption: str) -> str:
    tokens = set(tokenize(caption))
    matches = []
    for category, keywords in CATEGORY_KEYWORDS.items():
        overlap = len(tokens & keywords)
        if overlap:
            matches.append((overlap, category))
    if not matches:
        return "other"
    return sorted(matches, reverse=True)[0][1]


def jaccard(left: set[str], right: set[str]) -> float:
    if not left and not right:
        return 0.0
    return len(left & right) / max(1, len(left | right))


def precision_at(indices: list[int], relevant: set[int], k: int) -> float:
    if not relevant:
        return 0.0
    return len(set(indices[:k]) & relevant) / k


def result_item(dataset: ArtifactDataset, index: int, score: float | None = None) -> dict[str, object]:
    item: dict[str, object] = {
        "index": index,
        "path": str(dataset.paths[index]),
        "filename": dataset.paths[index].name,
        "caption": dataset.captions[index],
    }
    if score is not None:
        item["score"] = round(float(score), 4)
    return item


def matched_concepts(tokens: set[str], concepts: list[str]) -> list[str]:
    return [concept for concept in concepts if tokens & expand_term(concept)]


def dense_candidate_diagnostics(
    tokens: set[str],
    positive: list[str],
    negative: list[str],
) -> dict[str, object]:
    positive_hits = matched_concepts(tokens, positive)
    negative_hits = matched_concepts(tokens, negative)
    missing_positive = [concept for concept in positive if concept not in positive_hits]
    blockers = []
    if negative_hits:
        blockers.append("negative_constraint_hit")
    if missing_positive:
        blockers.append("missing_positive_constraints")
    if not positive_hits:
        blockers.append("no_positive_evidence_in_caption")
    return {
        "positive_hits": positive_hits,
        "missing_positive": missing_positive,
        "negative_hits": negative_hits,
        "positive_coverage": round(len(positive_hits) / max(1, len(positive)), 4),
        "negative_hit_count": len(negative_hits),
        "blockers": blockers,
    }


def dense_result_item(
    dataset: ArtifactDataset,
    index: int,
    caption_tokens: list[set[str]],
    positive: list[str],
    negative: list[str],
    score_channels: dict[str, np.ndarray],
    rank: int | None = None,
    stage: str | None = None,
) -> dict[str, object]:
    item = result_item(dataset, index)
    if rank is not None:
        item["rank"] = rank
    if stage is not None:
        item["stage"] = stage
    item["diagnostics"] = dense_candidate_diagnostics(caption_tokens[index], positive, negative)
    item["scores"] = {
        name: round(float(scores[index]), 4)
        for name, scores in score_channels.items()
        if np.isfinite(scores[index])
    }
    return item


def stage_diagnostics(
    dataset: ArtifactDataset,
    stage: str,
    ranking: list[int],
    caption_tokens: list[set[str]],
    positive: list[str],
    negative: list[str],
    score_channels: dict[str, np.ndarray],
    top_k: int,
    previous_ranking: list[int] | None = None,
) -> dict[str, object]:
    selected = ranking[:top_k]
    previous = previous_ranking[:top_k] if previous_ranking else []
    items = [
        dense_result_item(
            dataset,
            index,
            caption_tokens,
            positive,
            negative,
            score_channels,
            rank=rank,
            stage=stage,
        )
        for rank, index in enumerate(selected, start=1)
    ]
    negative_hits = sum(1 for item in items if item["diagnostics"]["negative_hits"])  # type: ignore[index]
    complete_constraints = sum(
        1 for item in items if not item["diagnostics"]["missing_positive"]  # type: ignore[index]
        and not item["diagnostics"]["negative_hits"]  # type: ignore[index]
    )
    return {
        "stage": stage,
        "negative_hits_in_top_k": negative_hits,
        "complete_constraint_matches": complete_constraints,
        "avg_positive_coverage": round(
            float(np.mean([item["diagnostics"]["positive_coverage"] for item in items])), 4  # type: ignore[index]
        )
        if items
        else 0.0,
        "removed_from_previous": [index for index in previous if index not in selected],
        "introduced_vs_previous": [index for index in selected if index not in previous],
        "items": items,
    }


def encode_text_queries_open_clip(
    queries: list[str],
    model_name: str,
    pretrained: str,
    batch_size: int,
) -> tuple[np.ndarray | None, dict[str, object]]:
    try:
        import torch
        import open_clip
    except ImportError as exc:
        return None, {"enabled": False, "error": f"missing dependency: {exc}"}

    device = "cuda" if torch.cuda.is_available() else "cpu"
    started = perf_counter()
    model, _, _ = open_clip.create_model_and_transforms(model_name, pretrained=pretrained)
    model = model.to(device).eval()
    tokenizer = open_clip.get_tokenizer(model_name)

    vectors = []
    with torch.no_grad():
        for start in range(0, len(queries), batch_size):
            batch = queries[start : start + batch_size]
            tokens = tokenizer(batch).to(device)
            encoded = model.encode_text(tokens)
            encoded = encoded / encoded.norm(dim=-1, keepdim=True)
            vectors.append(encoded.detach().cpu().numpy().astype(np.float32))

    return np.vstack(vectors), {
        "enabled": True,
        "library": "open_clip",
        "model": model_name,
        "pretrained": pretrained,
        "device": device,
        "embedding_dim": int(vectors[0].shape[1]) if vectors else None,
        "elapsed_seconds": round(perf_counter() - started, 2),
    }


def benchmark_text_to_image(
    dataset: ArtifactDataset,
    queries: list[str],
    top_k: int,
    query_embeddings: np.ndarray | None = None,
) -> dict[str, object]:
    docs, idf, avgdl = build_bm25(dataset.captions)
    query_results = []
    precision_rows = defaultdict(list)

    for query_index, query in enumerate(queries):
        lexical = bm25_scores(query, docs, idf, avgdl)
        tfidf = tfidf_scores(query, docs, idf)
        lexical_rank = top_indices(lexical, min(100, len(lexical)))
        tfidf_rank = top_indices(tfidf, min(100, len(tfidf)))
        clip_text_to_image_scores = np.zeros(len(dataset.paths), dtype=np.float32)
        clip_text_to_caption_scores = np.zeros(len(dataset.paths), dtype=np.float32)
        has_clip_query = query_embeddings is not None and query_index < len(query_embeddings)
        if has_clip_query:
            query_vector = query_embeddings[query_index]
            clip_text_to_image_scores = dataset.image_embeddings @ query_vector
            clip_text_to_caption_scores = dataset.caption_embeddings @ query_vector

        seed_rank = [index for index in lexical_rank[:20] if lexical[index] > 0]
        caption_expansion_scores = np.zeros(len(dataset.paths), dtype=np.float32)
        image_expansion_scores = np.zeros(len(dataset.paths), dtype=np.float32)
        if seed_rank:
            seed_weights = lexical[seed_rank].astype(np.float32)
            max_weight = float(seed_weights.max()) or 1.0
            seed_weights = seed_weights / max_weight
            seed_caption_embeddings = dataset.caption_embeddings[seed_rank]

            # Keep every seed caption vector separate. Averaging seed embeddings
            # collapses concepts and can erase useful query information.
            caption_seed_scores = dataset.caption_embeddings @ seed_caption_embeddings.T
            image_seed_scores = dataset.image_embeddings @ seed_caption_embeddings.T
            caption_expansion_scores = np.max(caption_seed_scores * seed_weights, axis=1)
            image_expansion_scores = np.max(image_seed_scores * seed_weights, axis=1)

        caption_rank = top_indices(caption_expansion_scores, min(100, len(caption_expansion_scores)))
        image_rank = top_indices(image_expansion_scores, min(100, len(image_expansion_scores)))
        clip_image_rank = top_indices(clip_text_to_image_scores, min(100, len(clip_text_to_image_scores)))
        clip_caption_rank = top_indices(clip_text_to_caption_scores, min(100, len(clip_text_to_caption_scores)))
        rrf_bm25_caption_scores = reciprocal_rank_fusion([lexical_rank, caption_rank], len(dataset.paths))
        rrf_bm25_image_scores = reciprocal_rank_fusion([lexical_rank, image_rank], len(dataset.paths))
        rrf_all_scores = reciprocal_rank_fusion(
            [lexical_rank, tfidf_rank, caption_rank, image_rank],
            len(dataset.paths),
        )
        linear_bm25_caption_scores = weighted_sum([(0.6, lexical), (0.4, caption_expansion_scores)])
        linear_bm25_image_scores = weighted_sum([(0.6, lexical), (0.4, image_expansion_scores)])
        linear_all_scores = weighted_sum(
            [
                (0.45, lexical),
                (0.15, tfidf),
                (0.2, caption_expansion_scores),
                (0.2, image_expansion_scores),
            ]
        )
        linear_clip_bm25_scores = weighted_sum([(0.5, lexical), (0.5, clip_text_to_image_scores)])
        linear_clip_caption_bm25_scores = weighted_sum(
            [(0.4, lexical), (0.3, clip_text_to_caption_scores), (0.3, clip_text_to_image_scores)]
        )
        rrf_clip_bm25_scores = reciprocal_rank_fusion([lexical_rank, clip_image_rank], len(dataset.paths))
        rrf_clip_caption_bm25_scores = reciprocal_rank_fusion(
            [lexical_rank, clip_caption_rank, clip_image_rank],
            len(dataset.paths),
        )
        rrf_everything_scores = reciprocal_rank_fusion(
            [lexical_rank, tfidf_rank, caption_rank, image_rank, clip_caption_rank, clip_image_rank],
            len(dataset.paths),
        )
        bm25_then_image_scores = restrict_to_candidates(
            weighted_sum([(0.35, lexical), (0.65, image_expansion_scores)]),
            lexical_rank,
        )
        image_then_bm25_scores = restrict_to_candidates(
            weighted_sum([(0.7, lexical), (0.3, image_expansion_scores)]),
            image_rank,
        )
        bm25_then_clip_scores = restrict_to_candidates(
            weighted_sum([(0.35, lexical), (0.65, clip_text_to_image_scores)]),
            lexical_rank,
        )
        clip_then_bm25_scores = restrict_to_candidates(
            weighted_sum([(0.7, lexical), (0.3, clip_text_to_image_scores)]),
            clip_image_rank,
        )

        rankings = {
            "caption_bm25": top_indices(lexical, top_k),
            "caption_tfidf": top_indices(tfidf, top_k),
            "bm25_seed_caption_expansion": top_indices(caption_expansion_scores, top_k),
            "bm25_seed_image_expansion": top_indices(image_expansion_scores, top_k),
            "linear_bm25_caption": top_indices(linear_bm25_caption_scores, top_k),
            "linear_bm25_image": top_indices(linear_bm25_image_scores, top_k),
            "linear_all_channels": top_indices(linear_all_scores, top_k),
            "rrf_bm25_caption": top_indices(rrf_bm25_caption_scores, top_k),
            "rrf_bm25_image": top_indices(rrf_bm25_image_scores, top_k),
            "rrf_all_channels": top_indices(rrf_all_scores, top_k),
            "two_stage_bm25_recall_image_rerank": top_indices(bm25_then_image_scores, top_k),
            "two_stage_image_recall_bm25_rerank": top_indices(image_then_bm25_scores, top_k),
            "separate_bm25_image_interleave": interleave_rankings([lexical_rank, image_rank], top_k),
        }
        if has_clip_query:
            rankings.update(
                {
                    "openclip_text_to_image": top_indices(clip_text_to_image_scores, top_k),
                    "openclip_text_to_caption": top_indices(clip_text_to_caption_scores, top_k),
                    "linear_openclip_bm25": top_indices(linear_clip_bm25_scores, top_k),
                    "linear_openclip_caption_bm25": top_indices(linear_clip_caption_bm25_scores, top_k),
                    "rrf_openclip_bm25": top_indices(rrf_clip_bm25_scores, top_k),
                    "rrf_openclip_caption_bm25": top_indices(rrf_clip_caption_bm25_scores, top_k),
                    "rrf_everything": top_indices(rrf_everything_scores, top_k),
                    "two_stage_bm25_recall_openclip_rerank": top_indices(bm25_then_clip_scores, top_k),
                    "two_stage_openclip_recall_bm25_rerank": top_indices(clip_then_bm25_scores, top_k),
                    "separate_bm25_openclip_interleave": interleave_rankings([lexical_rank, clip_image_rank], top_k),
                }
            )
        relevant = caption_relevance(query, dataset.captions)
        for name, ranking in rankings.items():
            precision_rows[name].append(precision_at(ranking, relevant, top_k))

        query_results.append(
            {
                "query": query,
                "heuristic_relevant_count": len(relevant),
                "methods": {
                    name: [result_item(dataset, idx, None) for idx in ranking[:top_k]]
                    for name, ranking in rankings.items()
                },
            }
        )

    return {
        "metrics": {
            name: {"precision_at_k": round(float(np.mean(values)), 4)}
            for name, values in precision_rows.items()
        },
        "queries": query_results,
    }


def benchmark_dense_text_to_image(
    dataset: ArtifactDataset,
    dense_cases: list[dict[str, object]],
    top_k: int,
    query_embeddings: np.ndarray | None = None,
    constraint_embeddings: list[dict[str, np.ndarray]] | None = None,
) -> dict[str, object]:
    docs, idf, avgdl = build_bm25(dataset.captions)
    caption_tokens = [set(tokenize(caption)) for caption in dataset.captions]
    query_results = []
    metric_rows: dict[str, dict[str, list[float]]] = defaultdict(lambda: defaultdict(list))
    metric_rows_by_source: dict[str, dict[str, dict[str, list[float]]]] = defaultdict(
        lambda: defaultdict(lambda: defaultdict(list))
    )

    for query_index, raw_case in enumerate(dense_cases):
        case = normalize_dense_case(raw_case)
        query = str(case["query"])
        positive = list(case["positive"])  # type: ignore[arg-type]
        negative = list(case["negative"])  # type: ignore[arg-type]
        constraint_source = str(case.get("constraint_source", "unknown"))
        positive_support = constraint_support_counts(caption_tokens, positive)
        negative_support = constraint_support_counts(caption_tokens, negative)

        lexical = bm25_scores(query, docs, idf, avgdl)
        tfidf = tfidf_scores(query, docs, idf)
        clip_text_to_image_scores = np.zeros(len(dataset.paths), dtype=np.float32)
        clip_text_to_caption_scores = np.zeros(len(dataset.paths), dtype=np.float32)
        has_clip_query = query_embeddings is not None and query_index < len(query_embeddings)
        if has_clip_query:
            query_vector = query_embeddings[query_index]
            clip_text_to_image_scores = dataset.image_embeddings @ query_vector
            clip_text_to_caption_scores = dataset.caption_embeddings @ query_vector
        case_constraint_embeddings = (
            constraint_embeddings[query_index]
            if constraint_embeddings is not None and query_index < len(constraint_embeddings)
            else None
        )

        if has_clip_query:
            raw_hybrid_scores = weighted_sum(
                [
                    (0.35, lexical),
                    (0.15, tfidf),
                    (0.25, clip_text_to_image_scores),
                    (0.25, clip_text_to_caption_scores),
                ]
            )
        else:
            raw_hybrid_scores = weighted_sum([(0.75, lexical), (0.25, tfidf)])

        positive_scores = positive_coverage_scores(caption_tokens, positive)
        negative_scores = negative_hit_scores(caption_tokens, negative)
        constraint_scores = weighted_sum([(0.75, raw_hybrid_scores), (0.25, positive_scores)])
        constraint_scores = constraint_scores - 0.85 * negative_scores

        hard_filter_scores = constraint_scores.copy()
        if negative:
            hard_filter_scores[negative_scores > 0] = -np.inf
            if np.isfinite(hard_filter_scores).sum() < top_k:
                hard_filter_scores = constraint_scores

        lexical_rank = top_indices(lexical, min(100, len(lexical)))
        clip_image_rank = top_indices(clip_text_to_image_scores, min(100, len(clip_text_to_image_scores)))
        clip_caption_rank = top_indices(clip_text_to_caption_scores, min(100, len(clip_text_to_caption_scores)))
        rrf_scores = reciprocal_rank_fusion(
            [lexical_rank, clip_caption_rank, clip_image_rank] if has_clip_query else [lexical_rank],
            len(dataset.paths),
        )
        rrf_constraint_scores = weighted_sum([(0.78, rrf_scores), (0.22, positive_scores)])
        rrf_constraint_scores = rrf_constraint_scores - 0.85 * negative_scores

        contrastive_negative_scores = None
        if case_constraint_embeddings is not None:
            positive_term_embeddings = case_constraint_embeddings.get("positive")
            negative_term_embeddings = case_constraint_embeddings.get("negative")
            positive_visual = max_similarity_to_terms(dataset.image_embeddings, positive_term_embeddings)
            positive_caption = max_similarity_to_terms(dataset.caption_embeddings, positive_term_embeddings)
            negative_visual = max_similarity_to_terms(dataset.image_embeddings, negative_term_embeddings)
            negative_caption = max_similarity_to_terms(dataset.caption_embeddings, negative_term_embeddings)
            contrastive_negative_scores = weighted_sum(
                [
                    (0.5, constraint_scores),
                    (0.25, positive_visual),
                    (0.15, positive_caption),
                ]
            )
            contrastive_negative_scores = (
                contrastive_negative_scores
                - 0.45 * minmax_scores(negative_visual)
                - 0.25 * minmax_scores(negative_caption)
            )

        rankings = {
            "caption_bm25": top_indices(lexical, top_k),
            "raw_hybrid": top_indices(raw_hybrid_scores, top_k),
            "constraint_aware_rerank": top_indices(constraint_scores, top_k),
            "hard_negative_filter": top_indices(hard_filter_scores, top_k),
            "rrf_constraint_aware": top_indices(rrf_constraint_scores, top_k),
        }
        if contrastive_negative_scores is not None:
            rankings["contrastive_negative_rerank"] = top_indices(contrastive_negative_scores, top_k)
        if has_clip_query:
            rankings.update(
                {
                    "openclip_text_to_image": top_indices(clip_text_to_image_scores, top_k),
                    "openclip_text_to_caption": top_indices(clip_text_to_caption_scores, top_k),
                }
            )

        relevant = dense_relevance(caption_tokens, positive, negative)
        method_metrics = {}
        for name, ranking in rankings.items():
            metrics = dense_ranking_metrics(ranking, relevant, caption_tokens, positive, negative, top_k)
            method_metrics[name] = {metric: round(value, 4) for metric, value in metrics.items()}
            for metric, value in metrics.items():
                metric_rows[name][metric].append(value)
                metric_rows_by_source[constraint_source][name][metric].append(value)

        score_channels = {
            "bm25": lexical,
            "tfidf": tfidf,
            "raw_hybrid": raw_hybrid_scores,
            "positive_coverage": positive_scores,
            "negative_penalty": negative_scores,
            "constraint_score": constraint_scores,
            "hard_filter_score": hard_filter_scores,
            "rrf_constraint_score": rrf_constraint_scores,
            "openclip_text_to_image": clip_text_to_image_scores,
            "openclip_text_to_caption": clip_text_to_caption_scores,
        }
        if contrastive_negative_scores is not None:
            score_channels["contrastive_negative_score"] = contrastive_negative_scores

        stage_order = [
            "caption_bm25",
            "raw_hybrid",
            "constraint_aware_rerank",
            "hard_negative_filter",
            "rrf_constraint_aware",
            "contrastive_negative_rerank",
            "openclip_text_to_image",
            "openclip_text_to_caption",
        ]
        previous_ranking = None
        step_by_step = []
        for stage in stage_order:
            if stage not in rankings:
                continue
            step = stage_diagnostics(
                dataset,
                stage,
                rankings[stage],
                caption_tokens,
                positive,
                negative,
                score_channels,
                top_k,
                previous_ranking,
            )
            step["metrics"] = method_metrics[stage]
            step_by_step.append(step)
            previous_ranking = rankings[stage]

        raw_issues = []
        for rank, index in enumerate(rankings["raw_hybrid"][:top_k], start=1):
            item = dense_result_item(
                dataset,
                index,
                caption_tokens,
                positive,
                negative,
                score_channels,
                rank=rank,
                stage="raw_hybrid",
            )
            diagnostics = item["diagnostics"]
            if diagnostics["negative_hits"] or diagnostics["missing_positive"]:  # type: ignore[index]
                raw_issues.append(item)

        risk_flags = []
        raw_step = next((step for step in step_by_step if step["stage"] == "raw_hybrid"), None)
        final_step = next(
            (
                step
                for step in step_by_step
                if step["stage"] in {"contrastive_negative_rerank", "rrf_constraint_aware", "hard_negative_filter"}
            ),
            None,
        )
        if raw_step and raw_step["negative_hits_in_top_k"]:
            risk_flags.append("raw_hybrid_contains_explicit_negative_constraints")
        if step_by_step and max(step["complete_constraint_matches"] for step in step_by_step) == 0:
            risk_flags.append("no_top_result_satisfies_all_caption_constraints")
        if relevant and len(relevant) < top_k:
            risk_flags.append("few_caption_matches_for_full_constraint_set")
        if final_step and final_step["avg_positive_coverage"] < 0.7:
            risk_flags.append("final_results_have_partial_positive_coverage")
        if constraint_source == "inferred" and not positive:
            risk_flags.append("auto_constraint_extraction_failed")
        if constraint_source == "inferred" and NEGATION_PATTERN.search(query) and not negative:
            risk_flags.append("negation_detected_but_no_negative_constraint_extracted")
        if constraint_source == "inferred" and len(positive) > 7:
            risk_flags.append("many_inferred_positive_constraints")
        unsupported_positive = [term for term, count in positive_support.items() if count == 0]
        if unsupported_positive:
            risk_flags.append("positive_constraints_without_caption_support")

        query_results.append(
            {
                "query": query,
                "constraint_source": constraint_source,
                "positive_constraints": positive,
                "negative_constraints": negative,
                "constraint_support": {
                    "positive": positive_support,
                    "negative": negative_support,
                },
                "heuristic_relevant_count": len(relevant),
                "risk_flags": risk_flags,
                "method_metrics": method_metrics,
                "step_by_step": step_by_step,
                "raw_hybrid_blockers": raw_issues,
                "methods": {
                    name: [
                        dense_result_item(
                            dataset,
                            idx,
                            caption_tokens,
                            positive,
                            negative,
                            score_channels,
                            rank=rank,
                            stage=name,
                        )
                        for rank, idx in enumerate(ranking[:top_k], start=1)
                    ]
                    for name, ranking in rankings.items()
                },
            }
        )

    return {
        "metrics": {
            name: {
                metric: round(float(np.mean(values)), 4)
                for metric, values in metric_values.items()
            }
            for name, metric_values in metric_rows.items()
        },
        "metrics_by_constraint_source": {
            source: {
                name: {
                    metric: round(float(np.mean(values)), 4)
                    for metric, values in metric_values.items()
                }
                for name, metric_values in source_rows.items()
            }
            for source, source_rows in metric_rows_by_source.items()
        },
        "queries": query_results,
    }


def benchmark_image_to_image(dataset: ArtifactDataset, top_k: int, max_queries: int = 30) -> dict[str, object]:
    groups = duplicate_groups(dataset.paths)
    query_indices = [indices[0] for indices in groups.values()][:max_queries]
    if len(query_indices) < max_queries:
        step = max(1, len(dataset.paths) // max_queries)
        query_indices.extend(range(0, len(dataset.paths), step))
    query_indices = list(dict.fromkeys(query_indices))[:max_queries]

    duplicate_hit_at_1 = []
    duplicate_hit_at_5 = []
    caption_overlap_visual = []
    caption_overlap_hybrid = []
    query_results = []

    for query_index in query_indices:
        visual_scores = dataset.image_embeddings @ dataset.image_embeddings[query_index]
        caption_scores = dataset.caption_embeddings @ dataset.caption_embeddings[query_index]
        hybrid_scores = 0.75 * visual_scores + 0.25 * caption_scores
        visual_rank = top_indices(visual_scores, top_k, exclude=query_index)
        hybrid_rank = top_indices(hybrid_scores, top_k, exclude=query_index)

        partners = set(groups.get(image_base_name(dataset.paths[query_index]), [])) - {query_index}
        if partners:
            duplicate_hit_at_1.append(bool(partners & set(visual_rank[:1])))
            duplicate_hit_at_5.append(bool(partners & set(visual_rank[:5])))

        relevant = caption_relevance(dataset.captions[query_index], dataset.captions) - {query_index}
        caption_overlap_visual.append(precision_at(visual_rank, relevant, top_k))
        caption_overlap_hybrid.append(precision_at(hybrid_rank, relevant, top_k))

        query_results.append(
            {
                "query": result_item(dataset, query_index),
                "duplicate_partners": sorted(partners),
                "methods": {
                    "image_embedding_only": [
                        result_item(dataset, idx, visual_scores[idx]) for idx in visual_rank[:top_k]
                    ],
                    "image_caption_hybrid": [
                        result_item(dataset, idx, hybrid_scores[idx]) for idx in hybrid_rank[:top_k]
                    ],
                },
            }
        )

    return {
        "metrics": {
            "duplicate_groups": len(groups),
            "duplicate_hit_at_1": round(float(np.mean(duplicate_hit_at_1)), 4) if duplicate_hit_at_1 else None,
            "duplicate_hit_at_5": round(float(np.mean(duplicate_hit_at_5)), 4) if duplicate_hit_at_5 else None,
            "caption_overlap_precision_at_k_visual": round(float(np.mean(caption_overlap_visual)), 4),
            "caption_overlap_precision_at_k_hybrid": round(float(np.mean(caption_overlap_hybrid)), 4),
        },
        "queries": query_results,
    }


def connected_components(graph: list[set[int]]) -> list[list[int]]:
    seen = set()
    components = []
    for node in range(len(graph)):
        if node in seen:
            continue
        queue = deque([node])
        seen.add(node)
        component = []
        while queue:
            current = queue.popleft()
            component.append(current)
            for neighbor in graph[current]:
                if neighbor not in seen:
                    seen.add(neighbor)
                    queue.append(neighbor)
        components.append(component)
    return components


def cluster_pair_coherence(component: list[int], scores: np.ndarray) -> float | None:
    if len(component) < 2:
        return None
    pair_scores = []
    for pos, left in enumerate(component):
        for right in component[pos + 1 :]:
            pair_scores.append(float(scores[left, right]))
    return sum(pair_scores) / len(pair_scores) if pair_scores else None


def cluster_record(
    dataset: ArtifactDataset,
    component: list[int],
    cluster_id: int,
    categories: list[str],
    scores: np.ndarray,
) -> dict[str, object]:
    coherence = cluster_pair_coherence(component, scores)
    return {
        "cluster_id": cluster_id,
        "size": len(component),
        "category": categories[component[0]] if component else "unknown",
        "coherence": round(float(coherence), 4) if coherence is not None else None,
        "items": [result_item(dataset, idx) for idx in component],
    }


def build_image_assignments(cluster_records: list[dict[str, object]]) -> tuple[list[dict[str, object]], dict[str, object]]:
    assignments = []
    summary: dict[str, dict[str, int]] = defaultdict(
        lambda: {
            "images": 0,
            "clustered_images": 0,
            "singleton_images": 0,
            "clusters": 0,
            "non_singleton_clusters": 0,
            "singleton_clusters": 0,
        }
    )

    for cluster in cluster_records:
        cluster_id = int(cluster["cluster_id"])
        category = str(cluster["category"])
        cluster_size = int(cluster["size"])
        is_singleton = cluster_size == 1
        summary[category]["clusters"] += 1
        summary[category]["singleton_clusters" if is_singleton else "non_singleton_clusters"] += 1

        for item in cluster["items"]:  # type: ignore[union-attr]
            assignment_type = "category_singleton" if is_singleton else "thematic_cluster"
            summary[category]["images"] += 1
            summary[category]["singleton_images" if is_singleton else "clustered_images"] += 1
            assignments.append(
                {
                    "index": item["index"],
                    "path": item["path"],
                    "filename": item["filename"],
                    "caption": item["caption"],
                    "category": category,
                    "cluster_id": cluster_id,
                    "cluster_size": cluster_size,
                    "cluster_coherence": cluster["coherence"],
                    "is_singleton": is_singleton,
                    "assignment_type": assignment_type,
                    "needs_review": category == "other",
                }
            )

    assignments_sorted = sorted(assignments, key=lambda item: int(item["index"]))
    return assignments_sorted, dict(sorted(summary.items()))


def benchmark_clustering(dataset: ArtifactDataset, top_k: int, threshold: float | None) -> dict[str, object]:
    scores = dataset.image_embeddings @ dataset.image_embeddings.T
    np.fill_diagonal(scores, -np.inf)
    caption_tokens = [set(tokenize(caption)) for caption in dataset.captions]
    categories = [caption_category(caption) for caption in dataset.captions]
    buckets: dict[str, list[int]] = defaultdict(list)
    for index, category in enumerate(categories):
        buckets[category].append(index)

    nearest_scores = np.max(scores, axis=1)
    if threshold is None:
        threshold = float(np.clip(np.percentile(nearest_scores, 95), 0.3, 0.98))

    graph = [set() for _ in dataset.paths]
    nearest_by_node: dict[int, set[int]] = {}
    for bucket_indices in buckets.values():
        bucket_set = set(bucket_indices)
        for index in bucket_indices:
            local_scores = np.full(len(dataset.paths), -np.inf, dtype=np.float32)
            local_candidates = list(bucket_set - {index})
            if not local_candidates:
                nearest_by_node[index] = set()
                continue
            local_scores[local_candidates] = scores[index, local_candidates]
            nearest_by_node[index] = set(top_indices(local_scores, min(top_k, len(local_candidates))))

    for left, neighbors in nearest_by_node.items():
        for right in neighbors:
            if left >= right:
                continue
            mutual = left in nearest_by_node.get(right, set())
            token_overlap = jaccard(caption_tokens[left], caption_tokens[right])
            strong_visual = scores[left, right] >= threshold
            semantic_edge = scores[left, right] >= threshold * 0.96 and token_overlap >= 0.25
            if mutual and (strong_visual or semantic_edge):
                graph[left].add(right)
                graph[right].add(left)

    components = connected_components(graph)
    components_sorted = sorted(components, key=len, reverse=True)
    non_singletons = [component for component in components_sorted if len(component) > 1]
    duplicate_same_cluster = []
    index_to_cluster = {}
    for cluster_id, component in enumerate(components):
        for index in component:
            index_to_cluster[index] = cluster_id
    for indices in duplicate_groups(dataset.paths).values():
        cluster_ids = {index_to_cluster[index] for index in indices if index in index_to_cluster}
        duplicate_same_cluster.append(len(cluster_ids) == 1)

    cluster_records = [
        cluster_record(dataset, component, cluster_id, categories, scores)
        for cluster_id, component in enumerate(components_sorted)
    ]
    non_singleton_records = [cluster for cluster in cluster_records if cluster["size"] > 1]
    singleton_records = [cluster for cluster in cluster_records if cluster["size"] == 1]
    image_assignments, category_summary = build_image_assignments(cluster_records)
    cluster_coherence = [
        float(cluster["coherence"])
        for cluster in non_singleton_records
        if cluster["coherence"] is not None
    ]

    return {
        "metrics": {
            "threshold": round(threshold, 4),
            "groups": len(components),
            "assigned_images": len(image_assignments),
            "category_assignment_coverage": round(len(image_assignments) / max(1, len(dataset.paths)), 4),
            "non_singleton_groups": len(non_singletons),
            "largest_group": len(components_sorted[0]) if components_sorted else 0,
            "singleton_ratio": round(sum(1 for c in components if len(c) == 1) / len(components), 4),
            "avg_non_singleton_coherence": round(float(np.mean(cluster_coherence)), 4)
            if cluster_coherence
            else None,
            "metadata_buckets": dict(sorted(Counter(categories).items())),
            "duplicate_same_cluster_rate": round(float(np.mean(duplicate_same_cluster)), 4)
            if duplicate_same_cluster
            else None,
        },
        "sample_clusters": non_singleton_records[:10],
        "non_singleton_clusters": non_singleton_records,
        "singleton_clusters": singleton_records,
        "image_assignments": image_assignments,
        "category_summary": category_summary,
    }


def make_contact_sheet(dataset: ArtifactDataset, items: list[dict[str, object]], output_path: Path, columns: int = 5) -> None:
    if Image is None:
        return
    tile_width, tile_height = 220, 190
    caption_height = 92
    rows = math.ceil(len(items) / columns)
    sheet = Image.new("RGB", (columns * tile_width, rows * (tile_height + caption_height)), "white")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()

    for pos, item in enumerate(items):
        row, col = divmod(pos, columns)
        x = col * tile_width
        y = row * (tile_height + caption_height)
        path = Path(str(item["path"]))
        try:
            image = Image.open(path).convert("RGB")
            image.thumbnail((tile_width, tile_height))
            px = x + (tile_width - image.width) // 2
            py = y + (tile_height - image.height) // 2
            sheet.paste(image, (px, py))
        except Exception:
            draw.rectangle([x, y, x + tile_width - 1, y + tile_height - 1], outline="red")
        text = f'{item["index"]}: {item["caption"]}'[:92]
        if item.get("assignment_type"):
            cluster_label = "singleton" if item.get("is_singleton") else f'cluster {item.get("cluster_id")}'
            text = (
                f'{item["index"]}: {item["caption"]}'[:86]
                + f"\ncat:{str(item.get('category'))[:30]}\n{cluster_label[:38]}"
            )
        diagnostics = item.get("diagnostics")
        if isinstance(diagnostics, dict):
            positive_hits = ",".join(diagnostics.get("positive_hits", [])) or "none"
            missing_positive = ",".join(diagnostics.get("missing_positive", [])) or "none"
            negative_hits = ",".join(diagnostics.get("negative_hits", [])) or "none"
            text = (
                f'{item["index"]}: {item["caption"]}'[:86]
                + f"\n+{positive_hits[:38]}\nmiss:{missing_positive[:34]}\n-{negative_hits[:38]}"
            )
        draw.multiline_text((x + 4, y + tile_height + 4), text, fill="black", font=font, spacing=2)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output_path)


def write_report(
    report: dict[str, object],
    output_dir: Path,
    dense_step_visual_limit: int = 20,
    cluster_visual_limit: int = 0,
    category_page_size: int = 60,
) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    dataset = report["_dataset"]
    for generated_dir in ["image_to_image", "text_to_image", "dense_text_to_image", "clustering"]:
        target = output_dir / generated_dir
        if target.exists():
            shutil.rmtree(target)
    serializable_report = {key: value for key, value in report.items() if key != "_dataset"}
    serializable_report["report_generation"] = {
        "dense_step_visual_limit": dense_step_visual_limit,
        "cluster_visual_limit": cluster_visual_limit,
        "category_page_size": category_page_size,
        "dense_step_visual_note": "0 exports contact sheets for every dense prompt; metrics are always computed for every prompt.",
        "cluster_visual_note": "0 exports contact sheets for every non-singleton cluster; singleton clusters are listed in JSON only.",
        "category_page_note": "Category pages include every image, including singleton images. Use 0 to disable category contact sheets.",
    }
    (output_dir / "summary.json").write_text(json.dumps(serializable_report, indent=2), encoding="utf-8")
    image_queries = report["image_to_image"]["queries"][:5]
    for index, query in enumerate(image_queries, start=1):
        items = [query["query"], *query["methods"]["image_embedding_only"][:9]]
        make_contact_sheet(dataset, items, output_dir / "image_to_image" / f"query_{index:02d}.jpg")

    text_queries = report["text_to_image"]["queries"][:5]
    for index, query in enumerate(text_queries, start=1):
        for method_name in [
            "caption_bm25",
            "openclip_text_to_image",
            "openclip_text_to_caption",
            "rrf_openclip_caption_bm25",
            "two_stage_bm25_recall_openclip_rerank",
            "rrf_all_channels",
            "separate_bm25_openclip_interleave",
        ]:
            if method_name not in query["methods"]:
                continue
            items = query["methods"][method_name][:10]
            make_contact_sheet(
                dataset,
                items,
                output_dir / "text_to_image" / method_name / f"query_{index:02d}.jpg",
            )

    dense_queries = report["dense_text_to_image"]["queries"]
    dense_visual_queries = dense_queries if dense_step_visual_limit <= 0 else dense_queries[:dense_step_visual_limit]
    for index, query in enumerate(dense_visual_queries, start=1):
        step_dir = output_dir / "dense_text_to_image" / "step_by_step" / f"query_{index:02d}"
        step_dir.mkdir(parents=True, exist_ok=True)
        step_payload = {
            "query": query["query"],
            "constraint_source": query["constraint_source"],
            "positive_constraints": query["positive_constraints"],
            "negative_constraints": query["negative_constraints"],
            "constraint_support": query["constraint_support"],
            "risk_flags": query["risk_flags"],
            "method_metrics": query["method_metrics"],
            "raw_hybrid_blockers": query["raw_hybrid_blockers"],
            "steps": query["step_by_step"],
        }
        (step_dir / "diagnostics.json").write_text(json.dumps(step_payload, indent=2), encoding="utf-8")
        for step_index, step in enumerate(query["step_by_step"], start=1):
            make_contact_sheet(
                dataset,
                step["items"][:10],
                step_dir / f"{step_index:02d}_{step['stage']}.jpg",
            )

        for method_name in [
            "raw_hybrid",
            "constraint_aware_rerank",
            "hard_negative_filter",
            "rrf_constraint_aware",
            "contrastive_negative_rerank",
        ]:
            if method_name not in query["methods"]:
                continue
            items = query["methods"][method_name][:10]
            make_contact_sheet(
                dataset,
                items,
                output_dir / "dense_text_to_image" / method_name / f"query_{index:02d}.jpg",
            )

    clustering_dir = output_dir / "clustering"
    clustering_dir.mkdir(parents=True, exist_ok=True)
    non_singleton_clusters = report["clustering"]["non_singleton_clusters"]
    singleton_clusters = report["clustering"]["singleton_clusters"]
    image_assignments = report["clustering"]["image_assignments"]
    category_summary = report["clustering"]["category_summary"]
    (clustering_dir / "non_singleton_clusters.json").write_text(
        json.dumps(non_singleton_clusters, indent=2),
        encoding="utf-8",
    )
    (clustering_dir / "singleton_clusters.json").write_text(
        json.dumps(singleton_clusters, indent=2),
        encoding="utf-8",
    )
    (clustering_dir / "image_assignments.json").write_text(
        json.dumps(image_assignments, indent=2),
        encoding="utf-8",
    )
    (clustering_dir / "category_summary.json").write_text(
        json.dumps(category_summary, indent=2),
        encoding="utf-8",
    )
    assignments_by_category: dict[str, list[dict[str, object]]] = defaultdict(list)
    for assignment in image_assignments:
        assignments_by_category[str(assignment["category"])].append(assignment)
    (clustering_dir / "category_assignments.json").write_text(
        json.dumps(dict(sorted(assignments_by_category.items())), indent=2),
        encoding="utf-8",
    )
    visual_clusters = (
        non_singleton_clusters
        if cluster_visual_limit <= 0
        else non_singleton_clusters[:cluster_visual_limit]
    )
    for cluster in visual_clusters:
        cluster_id = int(cluster["cluster_id"])
        size = int(cluster["size"])
        output_name = f"cluster_{cluster_id:04d}_size_{size:03d}.jpg"
        make_contact_sheet(dataset, cluster["items"], clustering_dir / output_name)

    if category_page_size > 0:
        category_dir = clustering_dir / "categories"
        for category, assignments in sorted(assignments_by_category.items()):
            for page_index, start in enumerate(range(0, len(assignments), category_page_size), start=1):
                page_items = assignments[start : start + category_page_size]
                output_name = f"{category}_page_{page_index:03d}.jpg"
                make_contact_sheet(dataset, page_items, category_dir / category / output_name)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Benchmark cached retrieval and clustering artifacts.")
    parser.add_argument("--data-dir", type=Path, default=Path("notebooks/data/images/val2017"))
    parser.add_argument("--artifacts-dir", type=Path, default=Path("notebooks/data/artifacts"))
    parser.add_argument("--output-dir", type=Path, default=Path("reports/algorithm_tests/latest"))
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--top-k", type=int, default=10)
    parser.add_argument("--cluster-top-k", type=int, default=5)
    parser.add_argument("--cluster-threshold", type=float, default=None)
    parser.add_argument("--text-encoder", choices=["openclip", "none"], default="openclip")
    parser.add_argument("--clip-model", default="ViT-L-14")
    parser.add_argument("--clip-pretrained", default="openai")
    parser.add_argument("--text-batch-size", type=int, default=16)
    parser.add_argument("--queries", nargs="*", default=DEFAULT_QUERIES)
    parser.add_argument(
        "--dense-query",
        action="append",
        default=[],
        help="Extra dense prompt to evaluate with inferred positive/negative constraints.",
    )
    parser.add_argument(
        "--dense-step-visual-limit",
        type=int,
        default=20,
        help="Number of dense prompts exported as step-by-step contact sheets. Use 0 to export every dense prompt.",
    )
    parser.add_argument(
        "--cluster-visual-limit",
        type=int,
        default=0,
        help="Number of non-singleton clusters exported as contact sheets. Use 0 to export every non-singleton cluster.",
    )
    parser.add_argument(
        "--category-page-size",
        type=int,
        default=60,
        help="Images per category contact-sheet page. Use 0 to disable category pages.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    start = perf_counter()
    dataset = load_dataset(args.data_dir, args.artifacts_dir, args.limit)
    dense_cases = [normalize_dense_case(case) for case in DEFAULT_DENSE_QUERY_CASES]
    dense_cases.extend(normalize_dense_case(query) for query in DEFAULT_NATURAL_DENSE_QUERY_CASES)
    dense_cases.extend(normalize_dense_case(query) for query in args.dense_query)
    query_embeddings = None
    dense_query_embeddings = None
    dense_constraint_embeddings = None
    text_encoder_report = {"enabled": False, "reason": "disabled"}
    if args.text_encoder == "openclip":
        constraint_texts = []
        constraint_shapes = []
        for case in dense_cases:
            positive = list(case["positive"])  # type: ignore[arg-type]
            negative = list(case["negative"])  # type: ignore[arg-type]
            constraint_shapes.append((len(positive), len(negative)))
            constraint_texts.extend([str(term) for term in positive])
            constraint_texts.extend([str(term) for term in negative])

        all_queries = [
            *args.queries,
            *[str(case["query"]) for case in dense_cases],
            *constraint_texts,
        ]
        all_query_embeddings, text_encoder_report = encode_text_queries_open_clip(
            all_queries,
            args.clip_model,
            args.clip_pretrained,
            args.text_batch_size,
        )
        if all_query_embeddings is not None:
            dense_start = len(args.queries)
            constraint_start = dense_start + len(dense_cases)
            query_embeddings = all_query_embeddings[:dense_start]
            dense_query_embeddings = all_query_embeddings[dense_start:constraint_start]

            dense_constraint_embeddings = []
            cursor = constraint_start
            for positive_count, negative_count in constraint_shapes:
                positive_vectors = all_query_embeddings[cursor : cursor + positive_count]
                cursor += positive_count
                negative_vectors = all_query_embeddings[cursor : cursor + negative_count]
                cursor += negative_count
                dense_constraint_embeddings.append(
                    {
                        "positive": positive_vectors,
                        "negative": negative_vectors,
                    }
                )

    report: dict[str, object] = {
        "dataset": {
            "images": len(dataset.paths),
            "data_dir": str(args.data_dir),
            "artifacts_dir": str(args.artifacts_dir),
            "mapping_note": dataset.mapping_note,
        },
        "text_encoder": text_encoder_report,
        "text_to_image": benchmark_text_to_image(dataset, args.queries, args.top_k, query_embeddings),
        "dense_text_to_image": benchmark_dense_text_to_image(
            dataset,
            dense_cases,
            args.top_k,
            dense_query_embeddings,
            dense_constraint_embeddings,
        ),
        "image_to_image": benchmark_image_to_image(dataset, args.top_k),
        "clustering": benchmark_clustering(dataset, args.cluster_top_k, args.cluster_threshold),
        "elapsed_seconds": None,
        "_dataset": dataset,
    }
    report["elapsed_seconds"] = round(perf_counter() - start, 2)
    write_report(
        report,
        args.output_dir,
        args.dense_step_visual_limit,
        args.cluster_visual_limit,
        args.category_page_size,
    )

    print(f"Dataset: {len(dataset.paths)} images")
    print(f"Report: {args.output_dir / 'summary.json'}")
    print("Text->image:", report["text_to_image"]["metrics"])
    print("Dense text->image:", report["dense_text_to_image"]["metrics"])
    print("Image->image:", report["image_to_image"]["metrics"])
    print("Clustering:", report["clustering"]["metrics"])


if __name__ == "__main__":
    main()
