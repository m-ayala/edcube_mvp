"""
Knowledge Base Service
Read access to the taxonomy knowledge base, now stored under a single
`EdCube/knowledge_base` document as categorized subcollections:
pedagogy, age, content, worksheets, activities (see backend/firebase/paths.py).

Old top-level collection names (kb_age_bands, kb_objectives,
kb_worksheet_formats, kb_activity_formats, kb_content_formats) are gone --
only the Firestore path changed here. Function names, signatures and return
shapes are unchanged so callers in prompt_builder, outliner and generation
need no edits.

This data changes rarely, so each collection is fetched once and cached
in memory for the lifetime of the process.
"""

from typing import Dict, List, Optional
import firebase_admin
from firebase_admin import firestore
from firebase.paths import kb_col

_cache: Dict[str, List[Dict]] = {}


def _get_db():
    if not firebase_admin._apps:
        firebase_admin.initialize_app()
    return firestore.client()


def _get_collection_cached(category: str) -> List[Dict]:
    if category not in _cache:
        db = _get_db()
        docs = kb_col(db, category).stream()
        _cache[category] = [{'id': d.id, **d.to_dict()} for d in docs]
    return _cache[category]


def get_age_bands() -> List[Dict]:
    return _get_collection_cached('age')


def get_objectives() -> List[Dict]:
    return _get_collection_cached('pedagogy')


def get_worksheet_formats() -> List[Dict]:
    return _get_collection_cached('worksheets')


def get_activity_formats() -> List[Dict]:
    return _get_collection_cached('activities')


def get_content_formats() -> List[Dict]:
    return _get_collection_cached('content')
