"""
Firebase Service
Handles all Firestore database operations for curricula
"""

import os
from typing import Dict, List, Optional
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime


class FirebaseService:
    """Service for Firebase Firestore operations"""
    
    def __init__(self):
        """Initialize Firebase Admin SDK"""
        # Initialize Firebase if not already done
        if not firebase_admin._apps:
            # Use Application Default Credentials (from gcloud auth)
            firebase_admin.initialize_app()
        
        self.db = firestore.client()
        self.curricula_collection = self.db.collection('curricula')
    
    async def save_curriculum(self, teacher_id: str, curriculum_data: Dict) -> str:
        """
        Save a new curriculum to Firestore
        
        Args:
            teacher_id: Firebase user ID
            curriculum_data: Curriculum data to save
            
        Returns:
            Document ID of saved curriculum
        """
        try:
            # Add metadata
            curriculum_data['teacher_id'] = teacher_id
            curriculum_data['created_at'] = datetime.utcnow()
            curriculum_data['updated_at'] = datetime.utcnow()
            
            # Save to Firestore
            doc_ref = self.curricula_collection.add(curriculum_data)
            doc_id = doc_ref[1].id
            
            print(f"✅ Saved curriculum to Firebase: {doc_id}")
            return doc_id
        
        except Exception as e:
            print(f"❌ Error saving curriculum: {str(e)}")
            raise
    
    async def get_curriculum(self, curriculum_id: str, teacher_id: str) -> Optional[Dict]:
        """
        Fetch a curriculum by ID
        
        Args:
            curriculum_id: Firestore document ID
            teacher_id: User ID for authorization
            
        Returns:
            Curriculum data or None if not found
        """
        try:
            doc = self.curricula_collection.document(curriculum_id).get()
            
            if not doc.exists:
                return None
            
            curriculum = doc.to_dict()
            
            # Verify ownership
            if curriculum.get('teacher_id') != teacher_id:
                print(f"⚠️  Authorization failed: User {teacher_id} tried to access curriculum owned by {curriculum.get('teacher_id')}")
                return None
            
            curriculum['id'] = doc.id
            return curriculum
        
        except Exception as e:
            print(f"❌ Error fetching curriculum: {str(e)}")
            raise
    
    async def list_teacher_curricula(self, teacher_id: str) -> List[Dict]:
        """
        List all curricula for a teacher
        
        Args:
            teacher_id: Firebase user ID
            
        Returns:
            List of curriculum summaries
        """
        try:
            docs = self.curricula_collection\
                .where('teacher_id', '==', teacher_id)\
                .order_by('created_at', direction=firestore.Query.DESCENDING)\
                .stream()
            
            curricula = []
            for doc in docs:
                data = doc.to_dict()
                # Return only summary data, not full outline
                curricula.append({
                    'id': doc.id,
                    'course_name': data.get('course_name'),
                    'subject': data.get('subject'),
                    'topic': data.get('topic'),
                    'grade_level': data.get('grade_level'),
                    'duration': data.get('duration'),
                    'created_at': data.get('created_at'),
                    'updated_at': data.get('updated_at')
                })
            
            return curricula
        
        except Exception as e:
            print(f"❌ Error listing curricula: {str(e)}")
            raise
    
    async def delete_curriculum(self, curriculum_id: str, teacher_id: str) -> bool:
        """
        Delete a curriculum
        
        Args:
            curriculum_id: Firestore document ID
            teacher_id: User ID for authorization
            
        Returns:
            True if deleted, False if not found
        """
        try:
            # First verify ownership
            curriculum = await self.get_curriculum(curriculum_id, teacher_id)
            
            if not curriculum:
                return False
            
            # Delete document
            self.curricula_collection.document(curriculum_id).delete()
            print(f"✅ Deleted curriculum: {curriculum_id}")
            return True
        
        except Exception as e:
            print(f"❌ Error deleting curriculum: {str(e)}")
            raise
    
    async def add_resources_to_curriculum(
        self,
        curriculum_id: str,
        teacher_id: str,
        section_ids: List[str],
        resources: list,
        resource_type: str
    ):
        """
        Add generated resources to specific sections in a curriculum
        
        Args:
            curriculum_id: Firestore document ID
            teacher_id: User ID for authorization
            section_ids: List of section IDs to update
            resources: List of resource dictionaries
            resource_type: "worksheets" or "activities"
        """
        try:
            # Fetch curriculum
            curriculum = await self.get_curriculum(curriculum_id, teacher_id)
            
            if not curriculum:
                raise ValueError("Curriculum not found")
            
            # Update sections with resources
            for section in curriculum['outline']['sections']:
                if section.get('id') in section_ids:
                    # Find matching resources for this section
                    section_resources = [
                        r for r in resources
                        if r.get('section_id') == section.get('id')
                    ]
                    
                    # Add resources to section
                    if resource_type not in section:
                        section[resource_type] = []
                    section[resource_type].extend(section_resources)
            
            # Update in Firestore
            curriculum['updated_at'] = datetime.utcnow()
            self.curricula_collection.document(curriculum_id).set(curriculum)
            
            print(f"✅ Added {len(resources)} {resource_type} to curriculum {curriculum_id}")
        
        except Exception as e:
            print(f"❌ Error adding resources: {str(e)}")
            raise