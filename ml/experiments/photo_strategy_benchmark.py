"""Compare simple image-search and grouping strategies for Photo AI Platform.

The benchmark is intentionally dependency-free. It uses synthetic photo metadata
so the same file can run on a fresh machine and still compare maintenance and
scaling trade-offs before real model choices are locked in.
"""

from __future__ import annotations

from collections import defaultdict, deque
from dataclasses import dataclass
from math import sqrt
from random import Random
from time import perf_counter


THEMES = ["ceremony", "group", "portrait", "dance", "details", "venue"]
LOCATIONS = ["church", "garden", "studio", "city_hall", "beach"]
PEOPLE = [f"person_{idx}" for idx in range(1, 31)]


@dataclass(frozen=True)
class Photo:
    id: str
    library: str
    shooting: str
    theme: str
    location: str
    minute: int
    people: tuple[str, ...]
    caption: str
    embedding: tuple[float, ...]


def unit(value: str, salt: str = "") -> float:
    text = f"{value}:{salt}"
    h = 2166136261
    for char in text:
        h ^= ord(char)
        h *= 16777619
        h &= 0xFFFFFFFF
    return (h % 2000) / 1000 - 1


def vector_for(*tokens: str, dim: int = 16) -> tuple[float, ...]:
    values = []
    for axis in range(dim):
        raw = sum(unit(token, str(axis)) for token in tokens)
        values.append(raw)
    norm = sqrt(sum(value * value for value in values)) or 1
    return tuple(value / norm for value in values)


def generate_photos(count: int = 800, seed: int = 42) -> list[Photo]:
    rng = Random(seed)
    photos: list[Photo] = []

    for idx in range(count):
        library = f"lib_{1 + idx // 250}"
        shooting = f"shoot_{1 + idx // 80}"
        theme = rng.choice(THEMES)
        location = rng.choice(LOCATIONS)
        people = tuple(sorted(rng.sample(PEOPLE, rng.randint(0, 3))))
        minute = rng.randint(0, 720)
        caption = " ".join([theme, location, *people[:2], "photo"])
        embedding = vector_for(theme, location, shooting, *people[:2])
        photos.append(
            Photo(
                id=f"photo_{idx:04d}",
                library=library,
                shooting=shooting,
                theme=theme,
                location=location,
                minute=minute,
                people=people,
                caption=caption,
                embedding=embedding,
            )
        )

    return photos


def cosine(left: tuple[float, ...], right: tuple[float, ...]) -> float:
    return sum(a * b for a, b in zip(left, right))


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


def text_caption_clustering(photos: list[Photo], threshold: float = 0.67) -> dict[str, object]:
    graph = {photo.id: set() for photo in photos}
    tokens = {photo.id: set(photo.caption.split()) for photo in photos}

    for index, left in enumerate(photos):
        left_tokens = tokens[left.id]
        for right in photos[index + 1 :]:
            right_tokens = tokens[right.id]
            score = len(left_tokens & right_tokens) / len(left_tokens | right_tokens)
            if score >= threshold:
                graph[left.id].add(right.id)
                graph[right.id].add(left.id)

    components = connected_components(graph)
    return {"groups": len(components), "largest_group": max(map(len, components))}


def metadata_facets(photos: list[Photo]) -> dict[str, object]:
    buckets: dict[tuple[str, str, str], list[str]] = defaultdict(list)
    for photo in photos:
        buckets[(photo.library, photo.shooting, photo.theme)].append(photo.id)
    return {"groups": len(buckets), "largest_group": max(map(len, buckets.values()))}


def embedding_knn_graph(photos: list[Photo], top_k: int = 5, min_score: float = 0.88) -> dict[str, object]:
    graph = {photo.id: set() for photo in photos}

    for left in photos:
        scored = []
        for right in photos:
            if left.id == right.id:
                continue
            scored.append((cosine(left.embedding, right.embedding), right.id))
        for score, neighbor_id in sorted(scored, reverse=True)[:top_k]:
            if score >= min_score:
                graph[left.id].add(neighbor_id)
                graph[neighbor_id].add(left.id)

    components = connected_components(graph)
    return {"groups": len(components), "largest_group": max(map(len, components))}


def hybrid_similarity_graph(photos: list[Photo], top_k: int = 4, min_score: float = 0.86) -> dict[str, object]:
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
            same_context = left.theme == right.theme or left.location == right.location
            if right.minute - left.minute <= 20 and same_context:
                graph[left.id].add(right.id)
                graph[right.id].add(left.id)

    for group in by_person.values():
        ids = [photo.id for photo in group[:80]]
        for left_id, right_id in zip(ids, ids[1:]):
            graph[left_id].add(right_id)
            graph[right_id].add(left_id)

    for left in photos:
        candidates = []
        for right in photos:
            if left.id == right.id or left.shooting != right.shooting:
                continue
            score = cosine(left.embedding, right.embedding)
            score += 0.08 if left.theme == right.theme else 0
            score += 0.05 if left.location == right.location else 0
            candidates.append((score, right.id))
        for score, neighbor_id in sorted(candidates, reverse=True)[:top_k]:
            if score < min_score:
                continue
            graph[left.id].add(neighbor_id)
            graph[neighbor_id].add(left.id)

    components = connected_components(graph)
    return {"groups": len(components), "largest_group": max(map(len, components))}


def timed(name: str, fn, photos: list[Photo]) -> dict[str, object]:
    start = perf_counter()
    result = fn(photos)
    elapsed_ms = (perf_counter() - start) * 1000
    return {"approach": name, "elapsed_ms": round(elapsed_ms, 2), **result}


def main() -> None:
    photos = generate_photos()
    rows = [
        timed("metadata_facets", metadata_facets, photos),
        timed("text_caption_clustering", text_caption_clustering, photos),
        timed("embedding_knn_graph", embedding_knn_graph, photos),
        timed("hybrid_similarity_graph", hybrid_similarity_graph, photos),
    ]

    print("Synthetic dataset:", len(photos), "photos")
    print()
    print(f"{'approach':28} {'elapsed_ms':>12} {'groups':>8} {'largest':>8}")
    print("-" * 62)
    for row in rows:
        print(
            f"{row['approach']:28} {row['elapsed_ms']:12.2f} "
            f"{row['groups']:8} {row['largest_group']:8}"
        )

    print()
    print("Recommendation:")
    print("- Runtime path: vector search + metadata filters.")
    print("- Product grouping: hybrid graph over embeddings, people, time and shooting.")
    print("- Offline enrichment: captions only for selected albums or async jobs.")


if __name__ == "__main__":
    main()
