# backend/schemas/generation_schema.py

from pydantic import BaseModel
from typing import Literal, Optional, Dict, List, Any

class GenerationContext(BaseModel):
    """Context information for AI generation"""
    course: Dict[str, Any]  # title, description, grade
    existing_sections: Optional[List[Dict[str, str]]] = None  # For section generation
    all_section_names: Optional[List[str]] = None  # For subsection generation
    current_section: Optional[Dict[str, Any]] = None  # For subsection generation
    subsection: Optional[Dict[str, Any]] = None  # For topic generation

class GenerateRequest(BaseModel):
    """Unified generation request"""
    level: Literal["full_course", "sections", "subsections", "topics"]
    context: GenerationContext
    user_guidance: Optional[str] = None
    count: int = 3
    teacher_uid: str

class GenerateResponse(BaseModel):
    """Generation response"""
    success: bool
    level: str
    items: List[Dict[str, Any]]
    message: Optional[str] = None