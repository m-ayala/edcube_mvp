import json
from openai import OpenAI
from outliner_config import OPENAI_API_KEY, OPENAI_MODEL, OPENAI_TEMPERATURE

# Initialize OpenAI client
client = OpenAI(api_key=OPENAI_API_KEY)

def call_openai(prompt, system_message="You are a helpful assistant."):
    """
    Call OpenAI API and return parsed JSON response
    
    Args:
        prompt (str): The user prompt to send
        system_message (str): System message for the assistant
    
    Returns:
        dict: Parsed JSON response from the LLM
    """
    try:
        response = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[
                {"role": "system", "content": system_message},
                {"role": "user", "content": prompt}
            ],
            temperature=OPENAI_TEMPERATURE,
            response_format={"type": "json_object"}  # Forces JSON output
        )
        
        # Extract the response text
        response_text = response.choices[0].message.content
        
        # Parse JSON
        parsed_response = json.loads(response_text)
        
        return parsed_response
    
    except json.JSONDecodeError as e:
        print(f"❌ Error: Failed to parse JSON response from OpenAI")
        print(f"Raw response: {response_text[:500]}...")
        raise e
    
    except Exception as e:
        print(f"❌ Error calling OpenAI API: {str(e)}")
        raise e


def validate_boxes_response(boxes_data):
    """
    Validate that the boxes response has the correct structure
    
    Args:
        boxes_data (dict): The parsed JSON from LLM
    
    Returns:
        bool: True if valid, raises exception if invalid
    """
    required_fields = ['topic', 'grade_level', 'teacher_time_budget_minutes', 'boxes']
    
    for field in required_fields:
        if field not in boxes_data:
            raise ValueError(f"Missing required field: {field}")
    
    if not isinstance(boxes_data['boxes'], list):
        raise ValueError("'boxes' must be a list")
    
    if len(boxes_data['boxes']) == 0:
        raise ValueError("No boxes generated")
    
    # Validate each box has required fields
    for i, box in enumerate(boxes_data['boxes']):
        required_box_fields = ['box_id', 'title', 'description', 'duration_minutes', 'components']
        for field in required_box_fields:
            if field not in box:
                raise ValueError(f"Box {i+1} missing required field: {field}")
    
    print(f"✅ Validated: {len(boxes_data['boxes'])} boxes generated")
    return True