"""Dependency-free benchmarks for retrieval and clustering strategies.

The goal is not to replace real CLIP/DINO/InsightFace evaluation. It gives a
stable harness to compare architectural choices before connecting heavy open
source models.
"""

from __future__ import annotations

from collections import Counter, defaultdict, deque
from dataclasses import dataclass
from math import log, sqrt
from random import Random
from time import perf_counter


THEMES = ["ceremony", "group", "portrait", "dance", "details", "venue"]
LOCATIONS = ["church", "garden", "studio", "city_hall", "beach"]
STYLES = ["wide", "closeup", "candid", "posed", "low_light"]
PEOPLE = [f"person_{idx}" for idx in range(1, 41)]


@dataclass(frozen=True)
class Photo:
    id: str
    library: str
    shooting: str
    theme: str
    location: str
    style: str
    minute: int
    people: tuple[str, ...]
    caption: str
    image_embedding: tuple[float, ...]
    text_embedding: tuple[float, ...]


@dataclass(frozen=True)
class TextQuery:
    text: str
    tokens: tuple[str, ...]
    relevant_themes: tuple[str, ...] = ()
    relevant_locations: tuple[str, ...] = ()
    relevant_styles: tuple[str, ...] = ()


def unit(value: str, salt: str = "") -> float:
    text = f"{value}:{salt}"
    h = 2166136261
    for char in text:
        h ^= ord(char)
        h *= 16777619
        h &= 0xFFFFFFFF
    return (h % 2000) / 1000 - 1


def vector_for(*tokens: str, dim: int = 32) -> tuple[float, ...]:
    values = []
    for axis in range(dim):
        values.append(sum(unit(token, str(axis)) for token in tokens))
    norm = sqrt(sum(value * value for value in values)) or 1
    return tuple(value / norm for value in values)


def cosine(left: tuple[float, ...], right: tuple[float, ...]) -> float:
    return sum(a * b for a, b in zip(left, right))


def generate_photos(count: int = 1200, seed: int = 7) -> list[Photo]:
    rng = Random(seed)
    photos: list[Photo] = []

    for idx in range(count):
        library = f"lib_{1 + idx // 300}"
        shooting = f"shoot_{1 + idx // 100}"
        theme = rng.choice(THEMES)
        location = rng.choice(LOCATIONS)
        style = rng.choice(STYLES)
        people = tuple(sorted(rng.sample(PEOPLE, rng.randint(0, 3))))
        minute = rng.randint(0, 720)
        caption_tokens = [theme, location, style, *people[:2], "photo"]
        caption = " ".join(caption_tokens)

        photos.append(
            Photo(
                id=f"photo_{idx:05d}",
                library=library,
                shooting=shooting,
                theme=theme,
                location=location,
                style=style,
                minute=minute,
                people=people,
                caption=caption,
                image_embedding=vector_for(theme, location, style, shooting, *people[:2]),
                text_embedding=vector_for(theme, location, style),
            )
        )

    return photos


def precision_at_k(ranking: list[str], relevant: set[str], k: int = 10) -> float:
    if not relevant:
        return 0.0
    return len(set(ranking[:k]) & relevant) / k


def recall_at_k(ranking: list[str], relevant: set[str], k: int = 10) -> float:
    if not relevant:
        return 0.0
    return len(set(ranking[:k]) & relevant) / min(k, len(relevant))


def average_metric(values: list[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def rank_by_score(scores: dict[str, float]) -> list[str]:
    return [photo_id for photo_id, _ in sorted(scores.items(), key=lambda item: item[1], reverse=True)]


def build_bm25_index(photos: list[Photo]) -> tuple[dict[str, Counter[str]], dict[str, float]]:
    token_counts = {photo.id: Counter(photo.caption.split()) for photo in photos}
    df = Counter()
    for counts in token_counts.values():
        for token in counts:
            df[token] += 1
    total = len(photos)
    idf = {token: log((total - freq + 0.5) / (freq + 0.5) + 1) for token, freq in df.items()}
    return token_counts, idf


def bm25_scores(query_tokens: tuple[str, ...], token_counts: dict[str, Counter[str]], idf: dict[str, float]) -> dict[str, float]:
    scores = {}
    for photo_id, counts in token_counts.items():
        scores[photo_id] = sum(counts[token] * idf.get(token, 0.0) for token in query_tokens)
    return scores


def rrf(rankings: list[list[str]], k: int = 60) -> list[str]:
    scores: dict[str, float] = defaultdict(float)
    for ranking in rankings:
        for rank, photo_id in enumerate(ranking, start=1):
            scores[photo_id] += 1 / (k + rank)
    return rank_by_score(scores)


def build_graph(photos: list[Photo], visual_top_k: int = 4) -> dict[str, set[str]]:
    graph = {photo.id: set() for photo in photos}
    by_shooting: dict[str, list[Photo]] = defaultdict(list)
    by_person: dict[tuple[str, str], list[Photo]] = defaultdict(list)

    for photo in photos:
        by_shooting[photo.shooting].append(photo)
        for person in photo.people:
            by_person[(photo.shooting, person)].append(photo)

    for group in by_shooting.values():
        ordered = sorted(group, key=lambda photo: photo.minute)
        for left, right in zip(ordered, ordered[1:]):
            if right.minute - left.minute <= 20 and (left.theme == right.theme or left.location == right.location):
                graph[left.id].add(right.id)
                graph[right.id].add(left.id)

    for group in by_person.values():
        ids = [photo.id for photo in group]
        for left_id, right_id in zip(ids, ids[1:]):
            graph[left_id].add(right_id)
            graph[right_id].add(left_id)

    by_id = {photo.id: photo for photo in photos}
    for left in photos:
        candidates = []
        for right in photos:
            if left.id == right.id or left.shooting != right.shooting:
                continue
            candidates.append((cosine(left.image_embedding, right.image_embedding), right.id))
        for score, neighbor_id in sorted(candidates, reverse=True)[:visual_top_k]:
            if score >= 0.88:
                graph[left.id].add(neighbor_id)
                graph[neighbor_id].add(left.id)

    # Drop isolated nodes from expansion bias, but keep keys for component logic.
    for photo_id in by_id:
        graph.setdefault(photo_id, set())
    return graph


def graph_rerank(base_ranking: list[str], graph: dict[str, set[str]], top_n: int = 30) -> list[str]:
    scores = defaultdict(float)
    for rank, photo_id in enumerate(base_ranking, start=1):
        scores[photo_id] += 1 / rank
        if rank <= top_n:
            for neighbor in graph.get(photo_id, set()):
                scores[neighbor] += 0.25 / rank
    return rank_by_score(scores)


def connected_components(graph: dict[str, set[str]]) -> list[list[str]]:
    seen: set[str] = set()
    components: list[list[str]] = []
    for node in graph:
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


def text_queries() -> list[TextQuery]:
    return [
        TextQuery("outdoor ceremony", ("ceremony", "garden"), ("ceremony",), ("garden", "church")),
        TextQuery("studio portrait", ("studio", "portrait"), ("portrait",), ("studio",)),
        TextQuery("dance party low light", ("dance", "low_light"), ("dance",), (), ("low_light",)),
        TextQuery("wide venue shots", ("venue", "wide"), ("venue",), (), ("wide",)),
        TextQuery("group photos", ("group", "posed"), ("group",), (), ("posed",)),
    ]


def relevant_for_text(query: TextQuery, photos: list[Photo]) -> set[str]:
    relevant = set()
    for photo in photos:
        if query.relevant_themes and photo.theme not in query.relevant_themes:
            continue
        if query.relevant_locations and photo.location not in query.relevant_locations:
            continue
        if query.relevant_styles and photo.style not in query.relevant_styles:
            continue
        relevant.add(photo.id)
    return relevant


def benchmark_text_to_image(photos: list[Photo]) -> list[dict[str, float | str]]:
    token_counts, idf = build_bm25_index(photos)
    graph = build_graph(photos)
    rows = []
    methods = defaultdict(list)

    for query in text_queries():
        relevant = relevant_for_text(query, photos)
        query_vector = vector_for(*query.tokens)

        text_vector_scores = {photo.id: cosine(query_vector, photo.text_embedding) for photo in photos}
        image_vector_scores = {photo.id: cosine(query_vector, photo.image_embedding) for photo in photos}
        lexical_scores = bm25_scores(query.tokens, token_counts, idf)

        text_vector_rank = rank_by_score(text_vector_scores)
        image_vector_rank = rank_by_score(image_vector_scores)
        lexical_rank = rank_by_score(lexical_scores)
        rrf_rank = rrf([text_vector_rank, lexical_rank])
        graph_rank = graph_rerank(rrf_rank, graph)

        rankings = {
            "clip_text_vector": text_vector_rank,
            "caption_bm25": lexical_rank,
            "rrf_vector_bm25": rrf_rank,
            "rrf_plus_graph_rerank": graph_rank,
            "image_vector_proxy": image_vector_rank,
        }

        for name, ranking in rankings.items():
            methods[name].append(precision_at_k(ranking, relevant, 10))

    for name, values in methods.items():
        rows.append({"approach": name, "precision_at_10": round(average_metric(values), 3)})
    return rows


def image_query_set(photos: list[Photo], seed: int = 11, count: int = 30) -> list[Photo]:
    rng = Random(seed)
    return rng.sample(photos, count)


def relevant_for_image(query: Photo, photos: list[Photo]) -> set[str]:
    relevant = set()
    for photo in photos:
        if photo.id == query.id:
            continue
        same_person = bool(set(query.people) & set(photo.people))
        same_context = query.shooting == photo.shooting and query.theme == photo.theme
        if same_person or same_context:
            relevant.add(photo.id)
    return relevant


def benchmark_image_to_image(photos: list[Photo]) -> list[dict[str, float | str]]:
    graph = build_graph(photos)
    rows = []
    methods = defaultdict(list)

    for query in image_query_set(photos):
        relevant = relevant_for_image(query, photos)
        if not relevant:
            continue

        visual_scores = {photo.id: cosine(query.image_embedding, photo.image_embedding) for photo in photos if photo.id != query.id}
        metadata_prefilter_scores = {
            photo.id: cosine(query.image_embedding, photo.image_embedding)
            for photo in photos
            if photo.id != query.id and photo.shooting == query.shooting
        }
        person_boost_scores = {}
        for photo in photos:
            if photo.id == query.id:
                continue
            score = cosine(query.image_embedding, photo.image_embedding)
            if set(query.people) & set(photo.people):
                score += 0.18
            if query.shooting == photo.shooting:
                score += 0.08
            person_boost_scores[photo.id] = score

        visual_rank = rank_by_score(visual_scores)
        metadata_rank = rank_by_score(metadata_prefilter_scores)
        person_rank = rank_by_score(person_boost_scores)
        graph_rank = graph_rerank(visual_rank, graph)

        rankings = {
            "image_embedding_only": visual_rank,
            "metadata_prefilter_then_vector": metadata_rank,
            "person_context_hybrid": person_rank,
            "visual_plus_graph_expansion": graph_rank,
        }

        for name, ranking in rankings.items():
            methods[name].append(recall_at_k(ranking, relevant, 10))

    for name, values in methods.items():
        rows.append({"approach": name, "recall_at_10": round(average_metric(values), 3)})
    return rows


def benchmark_clustering(photos: list[Photo]) -> list[dict[str, int | str]]:
    graph = build_graph(photos)
    metadata_buckets: dict[tuple[str, str, str], list[str]] = defaultdict(list)
    for photo in photos:
        metadata_buckets[(photo.library, photo.shooting, photo.theme)].append(photo.id)

    visual_graph = {photo.id: set() for photo in photos}
    for left in photos:
        for right in photos:
            if left.id >= right.id:
                continue
            if cosine(left.image_embedding, right.image_embedding) >= 0.91:
                visual_graph[left.id].add(right.id)
                visual_graph[right.id].add(left.id)

    rows = []
    for name, groups in [
        ("metadata_facets", list(metadata_buckets.values())),
        ("visual_similarity_components", connected_components(visual_graph)),
        ("hybrid_graph_components", connected_components(graph)),
    ]:
        rows.append(
            {
                "approach": name,
                "groups": len(groups),
                "largest_group": max(len(group) for group in groups),
            }
        )
    return rows


def timed(label: str, fn, photos: list[Photo]) -> tuple[str, float, list[dict[str, object]]]:
    start = perf_counter()
    rows = fn(photos)
    elapsed_ms = (perf_counter() - start) * 1000
    return label, round(elapsed_ms, 2), rows


def print_rows(title: str, rows: list[dict[str, object]]) -> None:
    print(title)
    for row in rows:
        print("  ", row)
    print()


def main() -> None:
    photos = generate_photos()
    print("Synthetic dataset:", len(photos), "photos")
    print()

    for label, elapsed_ms, rows in [
        timed("text_to_image", benchmark_text_to_image, photos),
        timed("image_to_image", benchmark_image_to_image, photos),
        timed("clustering", benchmark_clustering, photos),
    ]:
        print(f"== {label} ({elapsed_ms} ms) ==")
        print_rows("results:", rows)

    print("Recommendation:")
    print("- image->image: vector search + metadata/person context beats vector-only.")
    print("- text->image: CLIP text vector is the light baseline; RRF helps when captions exist.")
    print("- LLM judge: use only as top-N reranker/evaluator, not as primary retrieval.")
    print("- clustering: metadata first, hybrid graph for unordered thematic grouping.")


if __name__ == "__main__":
    main()
