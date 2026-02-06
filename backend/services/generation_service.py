# backend/services/generation_service.py

# backend/services/generation_service.py

"""
Generation Service for Unified Curriculum Generation
Handles AI calls to generate sections, subsections, and topic boxes
"""

import os
import json
import logging
from typing import Dict, List, Optional, Any
from openai import AsyncOpenAI
from .prompt_builder import PromptBuilder

logger = logging.getLogger(__name__)

# DON'T initialize client here - do it in __init__ instead
# client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))  # REMOVE THIS LINE


class GenerationService:
    """Service for generating curriculum content at any level"""
    
    def __init__(self):
        self.prompt_builder = PromptBuilder()
        # Initialize client HERE instead
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY environment variable not set")
        self.client = AsyncOpenAI(api_key=api_key)
    
    async def generate(
        self,
        level: str,
        context: Dict[str, Any],
        user_guidance: Optional[str] = None,
        count: int = 3
    ) -> Dict[str, Any]:
        """
        Generate curriculum content at specified level
        
        Args:
            level: "full_course", "sections", "subsections", or "topics"
            context: Context dictionary with course/section/subsection info
            user_guidance: Optional teacher guidance
            count: Number of items to generate
            
        Returns:
            dict: Generated items with metadata
        """
        
        try:
            # Build prompt based on level
            prompt = self.prompt_builder.build_prompt(
                level=level,
                context=context,
                user_guidance=user_guidance,
                count=count
            )
            
            logger.info(f"Generating {count} {level} with OpenAI...")
            
            # Call OpenAI
            response = await self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert curriculum designer. Return only valid JSON, no markdown."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.7,
                max_tokens=2000
            )
            
            # Extract response
            raw_response = response.choices[0].message.content.strip()
            
            # Clean markdown if present
            if raw_response.startswith("```json"):
                raw_response = raw_response.replace("```json", "").replace("```", "").strip()
            elif raw_response.startswith("```"):
                raw_response = raw_response.replace("```", "").strip()
            
            # Parse JSON
            result = json.loads(raw_response)
            
            # Add generated IDs and order
            result = self._add_ids_and_order(result, level)
            
            logger.info(f"Successfully generated {level}")
            
            return {
                "success": True,
                "level": level,
                "items": result,
                "count": count
            }
            
        except json.JSONDecodeError as e:
            logger.error(f"JSON parse error: {e}\nRaw response: {raw_response}")
            return {
                "success": False,
                "error": f"Failed to parse AI response: {str(e)}",
                "level": level
            }
        
        except Exception as e:
            logger.error(f"Generation error: {e}", exc_info=True)
            return {
                "success": False,
                "error": str(e),
                "level": level
            }
    
    def _add_ids_and_order(self, result: Dict[str, Any], level: str) -> List[Dict[str, Any]]:
        """
        Add unique IDs and order numbers to generated items
        
        Args:
            result: Raw result from AI
            level: Generation level
            
        Returns:
            List of items with IDs and order
        """
        import uuid
        
        if level == "sections":
            items = result.get("sections", [])
            for i, item in enumerate(items, 1):
                item['id'] = f"section-{uuid.uuid4().hex[:8]}"
                item['order'] = i
            return items
        
        elif level == "subsections":
            items = result.get("subsections", [])
            for i, item in enumerate(items, 1):
                item['id'] = f"subsection-{uuid.uuid4().hex[:8]}"
                item['order'] = i
                # Ensure required fields exist
                if 'duration_minutes' not in item:
                    item['duration_minutes'] = 30
                if 'learning_objectives' not in item:
                    item['learning_objectives'] = []
                if 'content_keywords' not in item:
                    item['content_keywords'] = []
            return items
        
        elif level == "topics":
            items = result.get("topics", [])
            for i, item in enumerate(items, 1):
                item['id'] = f"topic-{uuid.uuid4().hex[:8]}"
                item['order'] = i
                # Ensure required fields exist
                if 'duration_minutes' not in item:
                    item['duration_minutes'] = 20
                if 'pla_pillars' not in item:
                    item['pla_pillars'] = []
                if 'learning_objectives' not in item:
                    item['learning_objectives'] = []
                if 'content_keywords' not in item:
                    item['content_keywords'] = []
                # Initialize empty resource arrays
                item['video_resources'] = []
                item['worksheets'] = []
                item['activities'] = []
            return items
        
        elif level == "full_course":
            # For full course, return entire structure
            # This maintains compatibility with existing flow
            return result
        
        return []