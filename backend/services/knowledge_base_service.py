"""
Knowledge Base Service
Read access to the taxonomy knowledge base collections in Firestore:
kb_age_bands, kb_objectives, kb_worksheet_formats, kb_activity_formats,
kb_content_formats.

This data changes rarely, so each collection is fetched once and cached
in memory for the lifetime of the process.
"""

from typing import Dict, List, Optional
import firebase_admin
from firebase_admin import firestore

_cache: Dict[str, List[Dict]] = {}


def _get_db():
    if not firebase_admin._apps:
        firebase_admin.initialize_app()
    return firestore.client()


def _get_collection_cached(collection_name: str) -> List[Dict]:
    if collection_name not in _cache:
        db = _get_db()
        docs = db.collection(collection_name).stream()
        _cache[collection_name] = [{'id': d.id, **d.to_dict()} for d in docs]
    return _cache[collection_name]


def get_age_bands() -> List[Dict]:
    return _get_collection_cached('kb_age_bands')


def get_objectives() -> List[Dict]:
    return _get_collection_cached('kb_objectives')


def get_worksheet_formats() -> List[Dict]:
    return _get_collection_cached('kb_worksheet_formats')


def get_activity_formats() -> List[Dict]:
    return _get_collection_cached('kb_activity_formats')


def get_content_formats() -> List[Dict]:
    return _get_collection_cached('kb_content_formats')
