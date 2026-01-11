import json
from openai import OpenAI
from config import OPENAI_API_KEY, OPENAI_MODEL, OPENAI_TEMPERATURE

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