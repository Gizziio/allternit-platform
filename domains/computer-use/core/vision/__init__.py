"""
A2R Computer Use — Vision Module
Wraps the existing a2r_vision action parser and VLM integration.

This module provides:
- Vision-based action parsing (from UI-TARS / ByteDance parser)
- VLM inference integration
- Screenshot analysis
- Vision-driven observe → decide → act → verify loop
- Heuristic target detection (no VLM required)
"""

# Re-export from existing operator vision module
# In Phase 1, this wraps the existing code.
# After extraction (Phase 5), this becomes the primary location.

from typing import Dict, Any, Optional

from .loop import (
    VisionLoop,
    VisionLoopResult,
    ObservationResult,
    DecisionResult,
    ActionResult,
    VerifyResult,
)
from .targets import TargetDetector


class VisionParser:
    """
    Parses VLM output into structured actions.
    Wraps the existing a2r_vision.action_parser module.
    """

    @staticmethod
    def parse_action(action_str: str) -> Dict[str, Any]:
        """Parse a single action string from VLM output into structured action dict."""
        import re
        # Match function-call style: action(param=value, ...)
        match = re.match(r'(\w+)\((.*)\)', action_str.strip())
        if match:
            func_name = match.group(1)
            params_str = match.group(2)
            params = {}
            for param in params_str.split(','):
                param = param.strip()
                if '=' in param:
                    key, val = param.split('=', 1)
                    params[key.strip()] = val.strip().strip('"\'')
            return {"action": func_name, "parameters": params}
        return {"action": "unknown", "raw": action_str}

    @staticmethod
    def parse_coordinates(text: str) -> Dict[str, Any]:
        """Parse coordinate output from VLM (point format)."""
        import re
        pattern = r"<point>(\d+)\s+(\d+)</point>"
        matches = re.findall(pattern, text)
        if matches:
            points = [{"x": int(x), "y": int(y)} for x, y in matches]
            return {"points": points}
        return {"points": []}


class VisionInference:
    """
    Calls VLM inference endpoint for screenshot analysis.
    Wraps the existing fn_inference_real from operator main.py.
    """

    def __init__(self, api_base: Optional[str] = None, api_key: Optional[str] = None, model: Optional[str] = None):
        import os
        self.api_base = api_base or os.getenv("A2R_VISION_INFERENCE_BASE")
        self.api_key = api_key or os.getenv("A2R_VISION_INFERENCE_KEY", os.getenv("OPENAI_API_KEY", "no-key"))
        self.model = model or os.getenv("A2R_VISION_MODEL_NAME", "a2r-vision-7b")

    def analyze_screenshot(self, task: str, screenshot_b64: str) -> str:
        """Analyze a screenshot with a VLM and return action proposals."""
        if not self.api_base:
            raise ValueError("VLM API base not configured (A2R_VISION_INFERENCE_BASE)")

        from openai import OpenAI
        client = OpenAI(base_url=self.api_base, api_key=self.api_key)

        response = client.chat.completions.create(
            model=self.model,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "text", "text": f"Task: {task}"},
                    {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{screenshot_b64}"}},
                ],
            }],
            max_tokens=512,
            temperature=0,
        )
        return response.choices[0].message.content
