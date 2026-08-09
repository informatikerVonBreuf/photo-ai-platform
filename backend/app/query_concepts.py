from __future__ import annotations

import re
from math import ceil
from collections.abc import Mapping
from typing import Any


TOKEN_PATTERN = re.compile(r"[^\W_]+", re.UNICODE)

LEXICAL_STOP_WORDS = frozenset(
    {
        "a",
        "an",
        "and",
        "are",
        "at",
        "avec",
        "dans",
        "de",
        "des",
        "du",
        "en",
        "et",
        "est",
        "for",
        "in",
        "la",
        "le",
        "les",
        "of",
        "on",
        "or",
        "ou",
        "pour",
        "sur",
        "the",
        "to",
        "un",
        "une",
        "with",
    }
)

PEOPLE_CONCEPT = frozenset(
    {
        "boy",
        "child",
        "children",
        "femme",
        "gens",
        "girl",
        "group",
        "homme",
        "kid",
        "kids",
        "man",
        "men",
        "people",
        "person",
        "personne",
        "personnes",
        "woman",
        "women",
    }
)
PLAYING_CONCEPT = frozenset(
    {
        "dancing",
        "game",
        "jeu",
        "jouant",
        "joue",
        "jouer",
        "play",
        "playing",
        "running",
        "skiing",
        "skateboarding",
        "surfing",
        "swinging",
    }
)
FOOD_CONCEPT = frozenset(
    {
        "aliment",
        "aliments",
        "apple",
        "apples",
        "banana",
        "bananas",
        "broccoli",
        "dish",
        "food",
        "fruit",
        "fruits",
        "meal",
        "nourriture",
        "pizza",
        "repas",
        "rice",
        "sandwich",
    }
)

TERM_CONCEPTS = {
    **{
        term: PEOPLE_CONCEPT
        for term in {"gens", "group", "people", "person", "personne", "personnes"}
    },
    **{term: frozenset({"homme", "man", "men"}) for term in {"homme", "man", "men"}},
    **{
        term: frozenset({"femme", "woman", "women"})
        for term in {"femme", "woman", "women"}
    },
    **{
        term: frozenset({"child", "children", "kid", "kids"})
        for term in {"child", "children", "kid", "kids"}
    },
    **{term: PLAYING_CONCEPT for term in PLAYING_CONCEPT},
    **{
        term: FOOD_CONCEPT
        for term in {
            "aliment",
            "aliments",
            "dish",
            "food",
            "meal",
            "nourriture",
            "repas",
        }
    },
    "apple": frozenset({"apple", "apples"}),
    "apples": frozenset({"apple", "apples"}),
    "banana": frozenset({"banana", "bananas"}),
    "bananas": frozenset({"banana", "bananas"}),
    "fruit": frozenset({"fruit", "fruits"}),
    "fruits": frozenset({"fruit", "fruits"}),
}


def tokenize(value: str) -> set[str]:
    return {
        token.casefold()
        for token in TOKEN_PATTERN.findall(value)
        if len(token) >= 2
    }


def extract_query_concepts(query: str) -> list[frozenset[str]]:
    concepts: list[frozenset[str]] = []
    seen: set[frozenset[str]] = set()
    for term in tokenize(query):
        if term in LEXICAL_STOP_WORDS:
            continue
        concept = TERM_CONCEPTS.get(term, frozenset({term}))
        if concept not in seen:
            seen.add(concept)
            concepts.append(concept)
    return concepts


def expanded_lexical_query(query: str) -> str:
    return " ".join(
        sorted(
            term
            for concept in extract_query_concepts(query)
            for term in concept
        )
    )


def searchable_item_tokens(item: Mapping[str, Any]) -> set[str]:
    values = [
        item.get("caption") or "",
        item.get("original_filename") or "",
        *(item.get("tags") or []),
    ]
    return tokenize(" ".join(str(value) for value in values))


def concept_coverage(
    query: str,
    item: Mapping[str, Any],
) -> tuple[int, int, int]:
    concepts = extract_query_concepts(query)
    tokens = searchable_item_tokens(item)
    matched = sum(bool(concept & tokens) for concept in concepts)
    total = len(concepts)
    minimum = total if total <= 3 else ceil(total * 0.6)
    return matched, total, minimum
