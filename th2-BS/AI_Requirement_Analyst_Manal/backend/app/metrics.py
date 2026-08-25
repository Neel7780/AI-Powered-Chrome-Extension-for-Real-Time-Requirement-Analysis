import re
from typing import Dict, List

VAGUE_PATTERNS = [
    r"\bgood enough\b", r"\bquick\b", r"\bsoon\b", r"\bmainly\b",
    r"\bthings like\b", r"\bstrong\b", r"\bimpactful\b", r"\bnot slow\b",
    r"\bideally\b", r"\bsometimes\b", r"\boverall profile strength\b",
    r"\bgood companies\b", r"\bsolid projects\b",
]

TESTABLE_TERMS = [
    "shall", "must", "within", "seconds", "ms", "percent", "%", "maximum",
    "minimum", "accuracy", "precision", "recall", "deadline", "latency",
    "uptime", "authorized", "encrypt",
]

def requirement_lines(text: str) -> List[str]:
    return [
        line.strip()
        for line in text.splitlines()
        if re.match(r"^(FR|NFR)\d+\s*:", line.strip(), re.I)
    ]

def vague_count(text: str) -> int:
    return sum(len(re.findall(p, text, flags=re.I)) for p in VAGUE_PATTERNS)

def evaluate(text: str) -> Dict[str, int]:
    reqs = requirement_lines(text)
    vague = vague_count(text)
    if not reqs:
        return {
            "requirement_count": 0,
            "ambiguous_phrase_count": vague,
            "specificity_score": 0,
            "testability_score": 0,
        }

    specificity = max(0, min(100, round(100 * (1 - vague / max(len(reqs), 1)))))
    testable = sum(
        any(term in req.lower() for term in TESTABLE_TERMS)
        for req in reqs
    )
    return {
        "requirement_count": len(reqs),
        "ambiguous_phrase_count": vague,
        "specificity_score": specificity,
        "testability_score": round(100 * testable / len(reqs)),
    }
