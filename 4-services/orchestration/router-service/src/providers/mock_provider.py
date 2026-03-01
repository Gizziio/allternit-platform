from typing import Dict, Any, List
from ..adapter import ModelAdapter

class MockProvider(ModelAdapter):
    @property
    def provider_id(self) -> str:
        return 'mock'

    async def list_models(self) -> List[Dict[str, Any]]:
        return [
            {'id': 'mock-fast', 'context_window': 4096},
            {'id': 'mock-smart', 'context_window': 16384}
        ]

    async def complete(self, 
                       model: str, 
                       messages: List[Dict[str, str]], 
                       config: Dict[str, Any]) -> Dict[str, Any]:
        return {
            'content': f'Mock response from {model}',
            'usage': {'input_tokens': 10, 'output_tokens': 5},
            'provider': self.provider_id
        }

    def estimate_cost(self, model: str, input_tokens: int, output_tokens: int) -> float:
        return 0.0
