import os
import logging
from typing import Optional, List, Any
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import BaseMessage
from ..config import settings

logger = logging.getLogger("AIRequirementAnalyst.LLM")

class LLMService:
    """
    LangChain Google Generative AI Service.
    Implements model chaining, temperature controls, and graceful multi-model fallbacks
    following the patterns established in Lab 2 and Lab 3.
    """
    def __init__(self) -> None:
        self.api_key = settings.GOOGLE_API_KEY
        self.models = settings.MODELS
        self._llm_instances: dict[str, ChatGoogleGenerativeAI] = {}
        
    def is_available(self) -> bool:
        return bool(self.api_key and len(self.api_key.strip()) > 5)

    def get_llm(self, model_name: Optional[str] = None, temperature: float = 0.1) -> Optional[ChatGoogleGenerativeAI]:
        """
        Returns a ChatGoogleGenerativeAI instance for the given or default model.
        """
        if not self.is_available():
            return None
            
        target_model = model_name or settings.PRIMARY_MODEL
        cache_key = f"{target_model}_{temperature}"
        
        if cache_key not in self._llm_instances:
            try:
                self._llm_instances[cache_key] = ChatGoogleGenerativeAI(
                    model=target_model,
                    google_api_key=self.api_key,
                    temperature=temperature,
                    max_retries=2,
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
                logger.warning(f"[LangChain] Model {model} execution failed: {exc} -> trying next model")

        logger.error(f"[LangChain] All LLM models failed. Last error: {last_error}")
        return None, f"fallback_error: {last_error}"

llm_service = LLMService()
