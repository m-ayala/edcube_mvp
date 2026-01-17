"""
Shared utilities for EdCube backend
"""

from .llm_handler import call_openai, validate_json_response

__all__ = [
    'call_openai',
    'validate_json_response',
]