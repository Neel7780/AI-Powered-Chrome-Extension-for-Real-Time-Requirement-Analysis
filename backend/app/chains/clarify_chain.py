from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_google_genai import ChatGoogleGenerativeAI

CLARIFY_SYSTEM_PROMPT = """You are an expert requirements engineering analyst.
Analyze the meeting dialogue to detect all vague, subjective, ambiguous, and unquantified statements.
For each ambiguity, formulate a targeted, professional clarification question offering quantitative SLOs or concrete options to establish measurable acceptance criteria.

Guidelines:
- Detect fuzzy predicates: "not slow", "quick", "good enough", "trust", "solid", "soon", "mainly", "avoid bias".
- For each ambiguity, provide:
  1. The verbatim triggered statement from the dialogue.
  2. The quality category (Performance, Accuracy, Fairness, Scope, Explainability, Usability, Security).
  3. A precise clarification question.
  4. 3-4 industry-standard quantitative options (e.g. latency SLOs, Disparate Impact ratios, Precision/NDCG thresholds, milestones).

Format your output clearly:
AMBIGUOUS STATEMENTS & CLARIFICATIONS:
Q1 [Category]: [Question]
Triggered by: "[Exact phrase]"
Options:
- [Option A with concrete metric]
- [Option B with concrete metric]
- [Option C with concrete metric]

Q2 [Category]: ...
"""

def build_clarify_chain(llm: ChatGoogleGenerativeAI):
    """
    Creates a LangChain LCEL chain for Targeted Clarification Generation.
    """
    prompt = ChatPromptTemplate.from_messages([
        ("system", CLARIFY_SYSTEM_PROMPT),
        ("human", "Meeting Transcript:\n{transcript}\n\nIdentify ambiguities and generate clarification questions:")
    ])
    return prompt | llm | StrOutputParser()
