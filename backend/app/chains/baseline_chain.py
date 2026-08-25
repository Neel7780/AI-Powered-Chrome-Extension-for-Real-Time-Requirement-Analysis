from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_google_genai import ChatGoogleGenerativeAI

BASELINE_SYSTEM_PROMPT = """You are a senior requirements engineering assistant specializing in ISO/IEC/IEEE 29148 principles.

Your task is to analyze the meeting transcript and extract the BASELINE software requirements BEFORE any stakeholder clarification.

CRITICAL RE REQUIREMENTS RULES:
1. Do NOT invent or assume any numerical targets, metrics, or SLOs that were not explicitly stated in the transcript.
2. If a stakeholder uses vague terms (e.g. "good enough", "fast", "solid", "soon", "not slow", "ideally quick", "trust"), retain the vagueness and explicitly flag it as an unresolved ambiguity.
3. Separate requirements into:
   - FUNCTIONAL REQUIREMENTS (FR): System behaviors, actions, data handling, interfaces.
   - NON-FUNCTIONAL REQUIREMENTS (NFR): Quality attributes, performance, reliability, security, fairness.
   - IDENTIFIED AMBIGUITIES / ASSUMPTIONS: Specific unquantified phrases and what needs clarification.

Output format:
FUNCTIONAL REQUIREMENTS
FR1: [Title] - [Description with raw transcript phrasing]
FR2: ...

NON-FUNCTIONAL REQUIREMENTS
NFR1: [Category] - [Description retaining raw vagueness]
NFR2: ...

IDENTIFIED AMBIGUITIES
- Phrase: "..." | Issue: ... | Needs: ...
"""

def build_baseline_chain(llm: ChatGoogleGenerativeAI):
    """
    Creates a LangChain LCEL chain for Baseline Requirement Extraction.
    """
    prompt = ChatPromptTemplate.from_messages([
        ("system", BASELINE_SYSTEM_PROMPT),
        ("human", "Meeting Transcript:\n{transcript}\n\nGenerate the baseline specification:")
    ])
    return prompt | llm | StrOutputParser()
