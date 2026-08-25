import os
import re
from fastapi import HTTPException
from google import genai

class GeminiService:
    def __init__(self) -> None:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError(
                "GEMINI_API_KEY is missing. Copy .env.example to .env "
                "and add your Gemini API key."
            )
        self.client = genai.Client(api_key=api_key)
        configured = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
        self.models = list(dict.fromkeys([
            configured, "gemini-2.5-flash", "gemini-2.5-flash-lite"
        ]))

    def generate(self, prompt: str) -> str:
        last_error = None
        for model in self.models:
            try:
                result = self.client.models.generate_content(
                    model=model, contents=prompt
                )
                text = getattr(result, "text", None)
                if text and text.strip():
                    return text.strip()
                last_error = f"{model} returned an empty response."
            except Exception as exc:
                last_error = exc
        raise HTTPException(
            status_code=503,
            detail=f"Gemini request failed for all configured models: {last_error}",
        )

def build_baseline_prompt(transcript: str) -> str:
    return f"""
You are a senior requirements engineer.

Create a BASELINE specification from the meeting transcript below.
This baseline represents what can be extracted BEFORE clarification.

TRANSCRIPT:
{transcript}

Use exactly:
FUNCTIONAL REQUIREMENTS
FR1: ...
FR2: ...

NON-FUNCTIONAL REQUIREMENTS
NFR1: ...
NFR2: ...

AMBIGUITIES / ASSUMPTIONS
- ...

Rules:
- Do not invent facts.
- Keep vague stakeholder language vague when no measurable value exists.
- Functional requirements describe system behaviour.
- Non-functional requirements describe quality attributes or constraints.
- "Quick", "soon", "good enough", "strong", etc. are not measurable unless
  the transcript supplies a measurable criterion.
""".strip()

def build_clarification_prompt(transcript: str) -> str:
    return f"""
Act as a live requirements analyst.

Identify statements that are vague, subjective, ambiguous, incomplete,
non-measurable, or missing important constraints.

TRANSCRIPT:
{transcript}

Return:
AMBIGUOUS STATEMENTS
1. Statement: "..."
   Issue: ...

CLARIFICATION QUESTIONS
Q1: ...
Q2: ...
Q3: ...

Rules:
- Ask only questions that could materially improve a requirement.
- Do not ask for information already stated explicitly.
- Prefer measurable acceptance criteria, thresholds, definitions, weighting
  rules, deadlines, and constraints.
- Do not invent a requirement simply to create a question.
""".strip()

def build_refinement_prompt(transcript: str, questions: list[str], responses: list[str]) -> str:
    q_text = "\n".join(f"Q{i}: {q}" for i, q in enumerate(questions, 1)) or "None"
    r_text = "\n".join(f"Response {i}: {r}" for i, r in enumerate(responses, 1)) or "None"
    return f"""
You are refining software requirements after stakeholder clarification.

ORIGINAL TRANSCRIPT
{transcript}

CLARIFICATION QUESTIONS
{q_text}

STAKEHOLDER RESPONSES
{r_text}

Return exactly:
FUNCTIONAL REQUIREMENTS
FR1: ...
FR2: ...

NON-FUNCTIONAL REQUIREMENTS
NFR1: ...
NFR2: ...

NFR CATEGORIES
Security:
- ...
Performance:
- ...
Reliability:
- ...
Fairness:
- ...
Usability:
- ...
Other:
- ...

CLARIFICATION IMPACT
- What became precise:
- What became testable:
- Remaining ambiguity:

Rules:
- Only use information supported by the transcript and responses.
- Never manufacture numeric targets or deadlines.
- If a response remains vague, explicitly retain it as a remaining ambiguity.
- Preserve measurable stakeholder answers closely enough to remain traceable.
""".strip()

def build_comparison_prompt(baseline: str, refined: str) -> str:
    return f"""
Compare these two requirement specifications.

BASELINE
{baseline}

REFINED
{refined}

Evaluate:
1. Completeness
2. Specificity
3. Testability
4. Ambiguity reduction
5. Traceability to stakeholder statements
6. Functional requirement quality
7. Non-functional requirement quality
8. NFR categorization

Explain:
- What was vague before?
- What became measurable or testable?
- What ambiguities remain?
- How clarification changed the specification.

Use only evidence contained in the two texts.
""".strip()

def extract_questions(text: str) -> list[str]:
    questions = []
    for line in text.splitlines():
        match = re.match(r"^(?:Q\s*)?\d+\s*[.):\-]\s*(.+)$", line.strip(), re.I)
        if match:
            value = match.group(1).strip()
            if value and value not in questions:
                questions.append(value)
    return questions
