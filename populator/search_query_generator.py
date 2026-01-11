from llm_handler import call_openai
from prompts import get_search_query_generation_prompt


def generate_queries_for_section(section, grade_level, teacher_comments=""):
    """
    Generate 1-3 YouTube search queries for a section using LLM
    
    Args:
        section (dict): Section data from course outline
        grade_level (str): Grade level of students
        teacher_comments (str): Teacher's special requirements/objectives
    
    Returns:
        list: List of query dictionaries with priority and rationale
    """
    print(f"   Generating search queries for: {section.get('title', 'Unknown')}")
    
    try:
        # Get the prompt (now includes teacher comments and detailed objectives)
        prompt = get_search_query_generation_prompt(section, grade_level, teacher_comments)
        
        # Call LLM
        system_message = "You are an expert at creating effective YouTube search queries for educational content. You generate targeted queries that find high-quality, age-appropriate videos based on detailed learning objectives."
        
        response = call_openai(prompt, system_message)
        
        # Extract queries
        queries = response.get('queries', [])
        
        if not queries:
            print(f"   ⚠️  No queries generated, using fallback")
            return generate_fallback_queries(section, grade_level)
        
        # Display generated queries
        for query_data in queries:
            print(f"   ✓ {query_data.get('priority', 'unknown').capitalize()}: \"{query_data.get('query', '')}\"")
        
        return queries
    
    except Exception as e:
        print(f"   ❌ Error generating queries: {str(e)}")
        print(f"   Using fallback queries...")
        return generate_fallback_queries(section, grade_level)


def generate_fallback_queries(section, grade_level):
    """
    Generate simple fallback queries if LLM fails
    
    Args:
        section (dict): Section data
        grade_level (str): Grade level
    
    Returns:
        list: Basic query list
    """
    section_title = section.get('title', '')
    
    # Extract keywords if available
    instruction = section.get('components', {}).get('instruction', {}) if 'components' in section else {}
    keywords = instruction.get('content_keywords', [])
    
    # Build queries
    queries = []
    
    # Primary: section title + top keyword
    if keywords:
        primary_query = f"{section_title} {keywords[0]}"
    else:
        primary_query = section_title
    
    queries.append({
        "priority": "primary",
        "query": primary_query[:50],  # Truncate if too long
        "rationale": "Fallback query using section title and keywords"
    })
    
    # Secondary: simplified version
    queries.append({
        "priority": "secondary",
        "query": f"{section_title} explained",
        "rationale": "Fallback explanatory query"
    })
    
    return queries