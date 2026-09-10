import os
import time
import logging
from typing import Optional, List, Any
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import BaseMessage
from ..config import settings

logger = logging.getLogger("AIRequirementAnalyst.LLM")

class LLMService:
    """
    LangChain Google Generative AI Service.
    Implements model chaining, temperature controls, graceful multi-model fallbacks,
    and automatic 429 quota rate-limit circuit breaking.
    """
    def __init__(self) -> None:
        self.api_key = settings.GOOGLE_API_KEY
        self.models = settings.MODELS
        self._llm_instances: dict[str, ChatGoogleGenerativeAI] = {}
        self.cooldown_until: float = 0.0

    def is_available(self) -> bool:
        if not (self.api_key and len(self.api_key.strip()) > 5):
            return False
        if time.time() < self.cooldown_until:
            return False
        return True

    def get_llm(self, model_name: Optional[str] = None, temperature: float = 0.1) -> Optional[ChatGoogleGenerativeAI]:
        """
        Returns a ChatGoogleGenerativeAI instance for the given or default model.
        """
        if not (self.api_key and len(self.api_key.strip()) > 5):
            return None

        target_model = model_name or settings.PRIMARY_MODEL
        cache_key = f"{target_model}_{temperature}"

        if cache_key not in self._llm_instances:
            try:
                self._llm_instances[cache_key] = ChatGoogleGenerativeAI(
                    model=target_model,
                    google_api_key=self.api_key,
                    temperature=temperature,
                    max_retries=1,
                )
            except Exception as e:
                logger.warning(f"Failed to initialize ChatGoogleGenerativeAI for model {target_model}: {e}")
                return None

        return self._llm_instances[cache_key]

    def invoke_with_fallback(self, chain_builder_fn, input_data: dict[str, Any]) -> tuple[Any, str]:
        """
        Executes a LangChain chain across configured fallback models.
        Returns (result, model_used_or_fallback_status).
        """
        if not self.is_available():
            if time.time() < self.cooldown_until:
                remaining = int(self.cooldown_until - time.time())
                return None, f"rate_limit_cooldown ({remaining}s remaining)"
            return None, "offline_no_key"

        last_error = None
        for model in self.models:
            llm = self.get_llm(model)
            if not llm:
                continue
            try:
                chain = chain_builder_fn(llm)
                result = chain.invoke(input_data)
                return result, model
            except Exception as exc:
                last_error = exc
                err_str = str(exc)
                # Check for rate limit / quota exhaustion
                if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
                    logger.warning(
                        f"[LangChain] Gemini API rate limit reached (429 RESOURCE_EXHAUSTED). "
                        f"Activating 30s circuit breaker to respect free-tier quota."
                    )
                    self.cooldown_until = time.time() + 30.0
                    return None, "rate_limited_cooldown"

                logger.warning(f"[LangChain] Model {model} execution failed: {exc} -> trying next model")

        logger.error(f"[LangChain] All LLM models failed. Last error: {last_error}")
        return None, f"fallback_error: {last_error}"

llm_service = LLMService()
