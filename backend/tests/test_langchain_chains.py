import pytest
from backend.app.services.llm_service import llm_service
from backend.app.chains.baseline_chain import build_baseline_chain
from backend.app.chains.clarify_chain import build_clarify_chain
from backend.app.chains.refine_chain import build_refine_chain
from backend.app.chains.comparison_chain import build_comparison_chain

def test_chain_builders_structure():
    """
    Verifies that all 4 LangChain LCEL chain builder functions create valid Runnable chains.
    """
    llm = llm_service.get_llm()
    if not llm:
        pytest.skip("Gemini API key not configured for live LLM chain test.")

    base_chain = build_baseline_chain(llm)
    assert base_chain is not None
    assert hasattr(base_chain, "invoke")

    clar_chain = build_clarify_chain(llm)
    assert clar_chain is not None
    assert hasattr(clar_chain, "invoke")

    ref_chain = build_refine_chain(llm)
    assert ref_chain is not None
    assert hasattr(ref_chain, "invoke")

    comp_chain = build_comparison_chain(llm)
    assert comp_chain is not None
    assert hasattr(comp_chain, "invoke")

def test_llm_service_configuration():
    """
    Verifies that LLMService exposes primary model and fallback list.
    """
    assert len(llm_service.models) >= 1
    assert "gemini-3.1-flash-lite" in llm_service.models
