from abc import ABC, abstractmethod
from typing import Dict, Any, List

class ModelAdapter(ABC):
    """
    Interface for Multi-LLM Routing Adapters (G0201)
    """
    
    @property
    @abstractmethod
    def provider_id(self) -> str:
        """Unique identifier for the provider (e.g., 'anthropic', 'openai')"""
        pass

    @abstractmethod
    async def list_models(self) -> List[Dict[str, Any]]:
        """Return available models and their capabilities"""
        pass

    @abstractmethod
    async def complete(self, 
                       model: str, 
                       messages: List[Dict[str, str]], 
                       config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute completion.
        Returns standardized response format.
        """
        pass

    @abstractmethod
    def estimate_cost(self, model: str, input_tokens: int, output_tokens: int) -> float:
        """Estimate cost in USD"""
        pass
