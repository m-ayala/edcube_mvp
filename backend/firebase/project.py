"""
Which Firebase project resources the backend talks to.

The project itself comes from Application Default Credentials (Cloud Run's
service project, or GOOGLE_CLOUD_PROJECT locally). The Firestore database and
Storage bucket names are set here so they live in one place.

The edcubeai-fdba7 project's database is the named database `default`
(Firebase now creates new projects that way), not the implicit `(default)`
the SDKs use when no database is given, so every client must pass it.
"""

import os

FIRESTORE_DATABASE = os.getenv("FIRESTORE_DATABASE", "default")
STORAGE_BUCKET = os.getenv("STORAGE_BUCKET", "edcubeai-fdba7.firebasestorage.app")


def firestore_client():
    """Admin SDK Firestore client for the configured database. Assumes
    firebase_admin.initialize_app() has already run."""
    from firebase_admin import firestore
    return firestore.client(database_id=FIRESTORE_DATABASE)
