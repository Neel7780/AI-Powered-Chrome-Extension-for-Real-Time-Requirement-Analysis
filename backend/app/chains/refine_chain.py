from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_google_genai import ChatGoogleGenerativeAI

REFINE_SYSTEM_PROMPT = """You are a senior requirements analyst synthesizing refined specifications following ISO/IEC/IEEE 29148 standards.

You are given:
1. The original meeting transcript.
2. The clarification questions presented to the stakeholder.
3. The explicit responses/decisions provided by the stakeholder.

CRITICAL REFINEMENT RULES:
1. ONLY refine requirements for which the stakeholder has provided an explicit answer.
2. If a clarification question was NOT answered, keep that requirement in status: PENDING_CLARIFICATION with unquantified thresholds.
3. Incorporate the stakeholder's exact confirmed SLOs, metrics, and parameters as stakeholder evidence.
4. Cleanly separate stakeholder requirement statements from implementation acceptance criteria (e.g. error handling).
5. Categorize Non-Functional Requirements (Performance, Fairness, Accuracy, Scope, Security, Usability, Reliability).

Output format:
REFINED FUNCTIONAL REQUIREMENTS
FR1: [Title]
- Description: [Refined description]
- Stakeholder Decision: [Evidence]
- Acceptance Criteria: [Gherkin-style Given/When/Then]

REFINED NON-FUNCTIONAL REQUIREMENTS
NFR1 [Category]: [Title]
- Description: [Quantified requirement statement]
- Target Metric / SLO: [Measurable threshold]
- Traceability: [Clarification reference]
- Verification Method: [e.g. Automated Performance Benchmark]

NFR CATEGORIZATION
- Performance: ...
- Fairness: ...
- Accuracy: ...
- Scope: ...
- Security: ...
- Usability: ...

TRANSFORMATION AUDIT
- Vague phrases replaced:
- Measurable SLOs established:
- Remaining pending items:
"""

def build_refine_chain(llm: ChatGoogleGenerativeAI):
    """
    Creates a LangChain LCEL chain for Response-Driven Requirement Refinement.
    """
    prompt = ChatPromptTemplate.from_messages([
        ("system", REFINE_SYSTEM_PROMPT),
        ("human", (
            "Original Transcript:\n{transcript}\n\n"
            "Clarification Questions:\n{questions}\n\n"
            "Stakeholder Decisions / Responses:\n{responses}\n\n"
            "Synthesize the refined specification:"
        ))
    ])
    return prompt | llm | StrOutputParser()
