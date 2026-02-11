"""
Firebase Service
Handles all Firestore database operations for curricula
"""

import os
from typing import Dict, List, Optional
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime
from schemas.curriculum_schema import CurriculumFields as F
import uuid


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
    
    # In firebase_service.py - save_curriculum method
    async def save_curriculum(self, teacherUid: str, curriculum_data: Dict, organizationId: str) -> str:
        """Save a new curriculum to Firestore (FLAT STRUCTURE)"""
        try:
            import uuid
            
            course_id = str(uuid.uuid4())
            
            # Prepare flat structure document
            doc_data = {
                'courseId': course_id,
                'teacherUid': teacherUid,
                'teacherEmail': curriculum_data.get('teacherEmail', ''),
                'organizationId': organizationId,
                'courseName': curriculum_data.get('course_name', ''),  # ← Check this
                'class': curriculum_data.get('grade_level', ''),  # ← Check this
                'subject': curriculum_data.get('subject', ''),
                'topic': curriculum_data.get('topic', ''),
                'timeDuration': curriculum_data.get('duration', ''),  # ← FIX: should get 'timeDuration'
                'objectives': curriculum_data.get('objectives', ''),  # ← Add this
                'sections': curriculum_data.get('sections', []),
                'generatedTopics': curriculum_data.get('boxes', []),
                'handsOnResources': curriculum_data.get('handsOnResources', {}),
                'outline': curriculum_data.get('outline', {}),  # ← Add this
                'isPublic': False,
                'sharedWith': [],
                'createdAt': datetime.utcnow().isoformat(),
                'lastModified': datetime.utcnow().isoformat()
            }
            
            self.curricula_collection.document(course_id).set(doc_data)
            
            print(f"✅ Saved curriculum to Firebase: {course_id}")
            return course_id
        except Exception as e:
            print(f"❌ Error saving curriculum: {str(e)}")
            raise
    
    async def get_curriculum(self, curriculum_id: str, teacherUid: str) -> Optional[Dict]:
        """
        Fetch a curriculum by ID
        
        Args:
            curriculum_id: Firestore document ID
            teacherUid: User ID for authorization
            
        Returns:
            Curriculum data or None if not found
        """
        try:
            doc = self.curricula_collection.document(curriculum_id).get()
            
            if not doc.exists:
                return None
            
            curriculum = doc.to_dict()
            
            # Verify ownership
            if curriculum.get('teacherUid') != teacherUid:
                print(f"⚠️  Authorization failed: User {teacherUid} tried to access curriculum owned by {curriculum.get('teacherUid')}")
                return None
            
            curriculum['id'] = doc.id
            return curriculum
        
        except Exception as e:
            print(f"❌ Error fetching curriculum: {str(e)}")
            raise
    
    async def list_teacher_curricula(self, teacherUid: str, organizationId: str = None) -> List[Dict]:
        """
        List all curricula for a teacher (FLAT STRUCTURE)
        
        Args:
            teacherUid: Firebase user ID
            
        Returns:
            List of curriculum summaries
        """
        try:
            # Build query step by step
            query = self.curricula_collection.where('teacherUid', '==', teacherUid)
            
            # Add org filter if specified
            if organizationId:
                query = query.where('organizationId', '==', organizationId)
            
            # Apply ordering and execute
            docs = query.order_by('createdAt', direction=firestore.Query.DESCENDING).stream()
            
            curricula = []
            for doc in docs:
                data = doc.to_dict()
                curricula.append({
                    'id': doc.id,
                    'courseId': data.get('courseId'),
                    'courseName': data.get('courseName'),
                    'subject': data.get('subject'),
                    'topic': data.get('topic'),
                    'class': data.get('class'),
                    'duration': data.get('duration'),
                    'createdAt': data.get('createdAt'),
                    'lastModified': data.get('lastModified')
                })
            
            return curricula
        
        except Exception as e:
            print(f"❌ Error listing curricula: {str(e)}")
            raise
    
    async def delete_curriculum(self, curriculum_id: str, teacherUid: str) -> bool:
        """
        Delete a curriculum
        
        Args:
            curriculum_id: Firestore document ID
            teacherUid: User ID for authorization
            
        Returns:
            True if deleted, False if not found
        """
        try:
            # First verify ownership
            curriculum = await self.get_curriculum(curriculum_id, teacherUid)
            
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
        teacherUid: str,
        section_ids: List[str],
        resources: list,
        resource_type: str
    ):
        """
        Add generated resources to specific sections in a curriculum
        
        Args:
            curriculum_id: Firestore document ID
            teacherUid: User ID for authorization
            section_ids: List of section IDs to update
            resources: List of resource dictionaries
            resource_type: "worksheets" or "activities"
        """
        try:
            # Fetch curriculum
            curriculum = await self.get_curriculum(curriculum_id, teacherUid)
            
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
    async def update_section(
        self,
        curriculum_id: str,
        section_id: str,
        section_data: dict
    ) -> bool:
        """
        Update a specific section within a curriculum document.
        
        Called after Phase 2 populates a section with videos.
        
        Args:
            curriculum_id: Firestore document ID
            section_id: Section ID within the curriculum
            section_data: Updated section data with video_resources
        
        Returns:
            bool: True if successful
        """
        try:
            doc_ref = self.curricula_collection.document(curriculum_id)
            doc = doc_ref.get()
            
            if not doc.exists:
                logger.error(f"Curriculum {curriculum_id} not found")
                return False
            
            # Get current data
            curriculum = doc.to_dict()
            sections = curriculum.get('outline', {}).get('sections', [])
            
            # Find and update the specific section
            updated = False
            for i, section in enumerate(sections):
                if section.get('id') == section_id or section.get('title') == section_data.get('title'):
                    # Update this section with populated data
                    sections[i] = section_data
                    updated = True
                    break
            
            if not updated:
                logger.error(f"Section {section_id} not found in curriculum")
                return False
            
            # Save back to Firestore
            doc_ref.update({
                'outline.sections': sections,
                'updated_at': firestore.SERVER_TIMESTAMP
            })
            
            logger.info(f"Updated section {section_id} in curriculum {curriculum_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error updating section: {e}", exc_info=True)
            return False


    async def get_section(
        self,
        curriculum_id: str,
        section_id: str,
        teacherUid: str
    ) -> dict:
        """
        Get a specific section's data from a curriculum.
        
        Called when teacher clicks on a populated box to view details.
        
        Args:
            curriculum_id: Firestore document ID
            section_id: Section ID within the curriculum
            teacherUid: User ID for authorization
        
        Returns:
            dict: Section data or None if not found
        """
        try:
            doc_ref = self.curricula_collection.document(curriculum_id)
            doc = doc_ref.get()
            
            if not doc.exists:
                logger.error(f"Curriculum {curriculum_id} not found")
                return None
            
            curriculum = doc.to_dict()
            
            # Verify teacher authorization
            if curriculum.get('teacherUid') != teacherUid:
                logger.warning(f"Unauthorized access attempt by {teacherUid}")
                return None
            
            # Find the specific section
            sections = curriculum.get('outline', {}).get('sections', [])
            for section in sections:
                if section.get('id') == section_id or section.get('title') == section_id:
                    return section
            
            logger.error(f"Section {section_id} not found")
            return None
            
        except Exception as e:
            logger.error(f"Error fetching section: {e}", exc_info=True)
            return None
        
    async def list_teacher_curricula(self, teacherUid: str) -> List[Dict]:
        """List all curricula for a teacher (FLAT STRUCTURE)"""
        try:
            docs = self.curricula_collection\
                .where(F.TEACHER_UID, '==', teacherUid)\
                .order_by(F.CREATED_AT, direction=firestore.Query.DESCENDING)\
                .stream()
            
            curricula = []
            for doc in docs:
                data = doc.to_dict()
                curricula.append({
                    'id': doc.id,
                    F.COURSE_ID: data.get(F.COURSE_ID),
                    F.COURSE_NAME: data.get(F.COURSE_NAME),
                    F.SUBJECT: data.get(F.SUBJECT),
                    F.TOPIC: data.get(F.TOPIC),
                    F.CLASS: data.get(F.CLASS),
                    F.TIME_DURATION: data.get(F.TIME_DURATION),  # ← FIX: was 'duration'
                    F.CREATED_AT: data.get(F.CREATED_AT),
                    F.LAST_MODIFIED: data.get(F.LAST_MODIFIED)
                })
            
            return curricula
        
        except Exception as e:
            print(f"❌ Error listing curricula: {str(e)}")
            raise

    async def update_curriculum(self, course_id: str, updates: Dict):
        """
        Update an existing curriculum.
        
        Args:
            course_id: Course ID
            updates: Fields to update
        
        Returns:
            dict: Success response
        """
        try:
            # Add lastModified timestamp
            updates['lastModified'] = datetime.utcnow().isoformat()
            
            # Update the document
            self.curricula_collection.document(course_id).update(updates)
            
            print(f"✅ Updated curriculum: {course_id}")
            return {
                'success': True,
                'message': 'Course updated successfully'
            }
            
        except Exception as e:
            print(f"❌ Error updating curriculum: {e}")
            raise

    async def get_public_courses(self, organizationId: str, limit: int = 20) -> List[Dict]:
        """Get public courses for an organization"""
        try:
            query = (self.curricula_collection
                    .where(F.ORGANIZATION_ID, '==', organizationId)
                    .where(F.IS_PUBLIC, '==', True)
                    .order_by(F.LAST_MODIFIED, direction=firestore.Query.DESCENDING)
                    .limit(limit))
            
            docs = query.stream()
            courses = []
            for doc in docs:
                course = doc.to_dict()
                course['id'] = doc.id
                courses.append(course)
            return courses
        except Exception as e:
            print(f"❌ Error fetching public courses: {str(e)}")
            raise