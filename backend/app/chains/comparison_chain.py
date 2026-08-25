from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_google_genai import ChatGoogleGenerativeAI

COMPARISON_SYSTEM_PROMPT = """You are a lead requirements auditor conducting an ISO/IEC/IEEE 29148 before-and-after quality comparison.

Compare the BASELINE specification (before clarification) with the REFINED specification (after stakeholder decisions).

Provide a structured, rigorous assessment:
1. Executive Transformation Summary
2. Ambiguity Elimination Audit (which subjective phrases were replaced with measurable thresholds)
3. Testability & Verifiability Gains (how acceptance criteria and SLOs enable automated testing)
4. Traceability & Stakeholder Governance (how requirement statements link directly to confirmed decisions)
5. ISO 29148 Standard Compliance Assessment
"""

def build_comparison_chain(llm: ChatGoogleGenerativeAI):
    """
    Creates a LangChain LCEL chain for Before-vs-After Comparison Audit.
    """
    prompt = ChatPromptTemplate.from_messages([
        ("system", COMPARISON_SYSTEM_PROMPT),
        ("human", (
            "BASELINE SPECIFICATION (Without Clarification):\n{baseline}\n\n"
            "REFINED SPECIFICATION (With AI Clarification):\n{refined}\n\n"
            "Generate the comprehensive comparison audit:"
        ))
    ])
    return prompt | llm | StrOutputParser()
