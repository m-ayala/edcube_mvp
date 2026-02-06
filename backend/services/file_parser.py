import os
import json
from openai import AsyncOpenAI

client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

async def parse_course_file(file_path: str, file_ext: str, teacher_uid: str):
    """
    Parse uploaded course file using GPT-4 to extract structured data
    """
    
    # Read file content based on type
    if file_ext in ['.xlsx', '.xls']:
        file_content = read_excel_file(file_path)
    elif file_ext in ['.docx', '.doc']:
        file_content = read_word_file(file_path)
    else:
        raise ValueError(f"Unsupported file extension: {file_ext}")
    
    # Use GPT-4 to parse and structure the content
    prompt = f"""
You are a curriculum parser. Extract course structure from this teacher's file.

FILE CONTENT:
{file_content}

OUTPUT FORMAT (JSON only, no markdown):
{{
  "course_name": "string",
  "class": "string (e.g., Class 1, Class 2, or Grade 3, etc.)",
  "subject": "string (e.g., Math, Science, History)",
  "topic": "string (main topic/theme of the course)",
  "sections": [
    {{
      "id": "section-1",
      "title": "string",
      "description": "string",
      "subsections": [
        {{
          "id": "sub-1",
          "title": "string",
          "description": "string",
          "duration_minutes": 30,
          "pla_pillars": [],
          "learning_objectives": ["objective1", "objective2"],
          "content_keywords": ["keyword1", "keyword2"],
          "what_must_be_covered": "string",
          "video_resources": [],
          "worksheets": [],
          "activities": []
        }}
      ]
    }}
  ]
}}

RULES:
1. Extract course_name, class/grade level, subject, and main topic from the document
2. If class/grade not mentioned, infer from content complexity (e.g., "Class 3" for elementary)
3. If subject not explicit, infer from content (e.g., "Math" if discussing fractions)
4. Extract all sections/topics as separate sections
5. Each section should have subsections (break down topics into smaller parts)
6. Infer learning objectives from content
7. Extract key content keywords
8. Generate unique IDs (section-1, section-2, sub-1, sub-2, etc.)
9. If duration isn't specified, estimate reasonable durations (15-45 mins per subsection)
10. Return ONLY valid JSON, no explanations or markdown
"""

    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": "You are a curriculum structure parser. Output only valid JSON."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.3
    )
    
    parsed_text = response.choices[0].message.content.strip()
    
    # Remove markdown code fences if present
    if parsed_text.startswith("```json"):
        parsed_text = parsed_text[7:]
    if parsed_text.startswith("```"):
        parsed_text = parsed_text[3:]
    if parsed_text.endswith("```"):
        parsed_text = parsed_text[:-3]
    
    course_data = json.loads(parsed_text.strip())
    
    return course_data


def read_excel_file(file_path: str) -> str:
    """Read Excel file and convert to text"""
    import pandas as pd
    
    try:
        # Read all sheets
        excel_file = pd.ExcelFile(file_path)
        content_parts = []
        
        for sheet_name in excel_file.sheet_names:
            df = pd.read_excel(file_path, sheet_name=sheet_name)
            content_parts.append(f"SHEET: {sheet_name}\n")
            content_parts.append(df.to_string(index=False))
            content_parts.append("\n\n")
        
        return "\n".join(content_parts)
    
    except Exception as e:
        raise ValueError(f"Failed to read Excel file: {str(e)}")


def read_word_file(file_path: str) -> str:
    """Read Word document and convert to text"""
    from docx import Document
    
    try:
        doc = Document(file_path)
        content_parts = []
        
        for paragraph in doc.paragraphs:
            if paragraph.text.strip():
                content_parts.append(paragraph.text)
        
        return "\n".join(content_parts)
    
    except Exception as e:
        raise ValueError(f"Failed to read Word file: {str(e)}")