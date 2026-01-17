"""
Shared LLM handler for OpenAI API calls
Consolidates all LLM interactions across all three phases
"""

import json
import logging
from typing import Dict, Optional
from openai import OpenAI

from config import OPENAI_API_KEY, OPENAI_MODEL, OPENAI_TEMPERATURE

# Initialize logger
logger = logging.getLogger(__name__)

# Initialize OpenAI client
client = OpenAI(api_key=OPENAI_API_KEY)


def call_openai(
    prompt: str,
    system_message: str = "You are a helpful assistant.",
    temperature: float = OPENAI_TEMPERATURE,
    max_tokens: Optional[int] = None,
    json_mode: bool = True
) -> Dict:
    """
    Call OpenAI API and return parsed JSON response.
    
    This is the centralized function for all LLM calls across EdCube.
    It handles API interaction, error handling, and JSON parsing.
    
    Args:
        prompt: The user prompt to send to the LLM
        system_message: System message defining assistant behavior
        temperature: Sampling temperature (0.0 to 2.0)
        max_tokens: Maximum tokens in response (None for model default)
        json_mode: Force JSON output format (default True)
    
    Returns:
        dict: Parsed JSON response from the LLM
    
    Raises:
        json.JSONDecodeError: If response is not valid JSON
        Exception: If OpenAI API call fails
    
    Example:
        >>> response = call_openai(
        ...     prompt="Generate a course outline",
        ...     system_message="You are a curriculum designer."
        ... )
        >>> print(response['course_title'])
    """
    try:
        # Build API call parameters
        params = {
            "model": OPENAI_MODEL,
            "messages": [
                {"role": "system", "content": system_message},
                {"role": "user", "content": prompt}
            ],
            "temperature": temperature,
        }
        
        # Add optional parameters
        if max_tokens:
            params["max_tokens"] = max_tokens
        
        if json_mode:
            params["response_format"] = {"type": "json_object"}
        
        # Call OpenAI API
        logger.info(f"Calling OpenAI API with model: {OPENAI_MODEL}")
        response = client.chat.completions.create(**params)
        
        # Extract response text
        response_text = response.choices[0].message.content
        
        # Parse JSON if in JSON mode
        if json_mode:
            parsed_response = json.loads(response_text)
            logger.info("Successfully parsed JSON response from OpenAI")
            return parsed_response
        else:
            return {"response": response_text}
    
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse JSON response from OpenAI: {e}")
        logger.error(f"Raw response (first 500 chars): {response_text[:500]}")
        raise
    
    except Exception as e:
        logger.error(f"Error calling OpenAI API: {e}")
        raise


def validate_json_response(
    data: Dict,
    required_fields: list,
    context: str = "response"
) -> bool:
    """
    Validate that a JSON response contains required fields.
    
    Args:
        data: The JSON data to validate
        required_fields: List of required field names
        context: Description of what's being validated (for error messages)
    
    Returns:
        bool: True if valid
    
    Raises:
        ValueError: If validation fails
    
    Example:
        >>> data = {"title": "Math", "grade": 5}
        >>> validate_json_response(data, ["title", "grade"], "course data")
        True
    """
    for field in required_fields:
        if field not in data:
            error_msg = f"Missing required field '{field}' in {context}"
            logger.error(error_msg)
            raise ValueError(error_msg)
    
    logger.info(f"Successfully validated {context} with {len(required_fields)} required fields")
    return True