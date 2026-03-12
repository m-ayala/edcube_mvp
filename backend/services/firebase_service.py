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

    async def _get_user_org(self, uid: str) -> Optional[str]:
        """Get a user's organization ID from their teacher profile."""
        try:
            doc = self.db.collection('teacher_profiles').document(uid).get()
            if doc.exists:
                return doc.to_dict().get('org_id')
            return None
        except Exception:
            return None

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

            # Allow access if owner OR if course is public and user is in same org
            is_owner = curriculum.get('teacherUid') == teacherUid
            if not is_owner:
                is_public = curriculum.get('isPublic', False)
                if is_public:
                    # Check same org
                    requester_org = await self._get_user_org(teacherUid)
                    course_org = curriculum.get('organizationId', '')
                    if requester_org and requester_org == course_org:
                        curriculum['id'] = doc.id
                        return curriculum
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

    # ── Notifications ─────────────────────────────────────────────────────────

    async def create_notification(
        self,
        to_uid: str,
        from_uid: str,
        from_name: str,
        notif_type: str,
        course_id: str,
        course_name: str,
        access_type: str = None,
    ) -> str:
        """Create a notification document in Firestore."""
        notif_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()
        doc = {
            'id': notif_id,
            'toUid': to_uid,
            'fromUid': from_uid,
            'fromName': from_name,
            'type': notif_type,
            'courseId': course_id,
            'courseName': course_name,
            'status': 'unread',
            'createdAt': now,
        }
        if access_type:
            doc['accessType'] = access_type
        self.db.collection('notifications').document(notif_id).set(doc)
        print(f"✅ Notification created: {notif_id}")
        return notif_id

    async def add_shared_with(self, course_id: str, uid: str, access_type: str) -> None:
        """Add or update a user in the course's sharedWith list."""
        ref = self.curricula_collection.document(course_id)
        doc = ref.get()
        if not doc.exists:
            return
        data = doc.to_dict()
        shared = data.get('sharedWith', [])
        # Replace if already present, else append
        shared = [s for s in shared if s.get('uid') != uid]
        shared.append({'uid': uid, 'accessType': access_type})
        ref.update({'sharedWith': shared})
        print(f"✅ sharedWith updated for course {course_id}: {uid} → {access_type}")

    async def get_shared_courses(self, uid: str) -> List[Dict]:
        """Get all courses where this uid appears in sharedWith."""
        try:
            docs = self.curricula_collection.stream()
            results = []
            for doc in docs:
                data = doc.to_dict()
                shared = data.get('sharedWith', [])
                match = next((s for s in shared if s.get('uid') == uid), None)
                if match:
                    results.append({
                        'id': doc.id,
                        'courseId': data.get('courseId', doc.id),
                        'courseName': data.get('courseName', ''),
                        'subject': data.get('subject', ''),
                        'class': data.get('class', ''),
                        'topic': data.get('topic', ''),
                        'isPublic': data.get('isPublic', False),
                        'teacherUid': data.get('teacherUid', ''),
                        'sections': data.get('sections', []),
                        'outline': data.get('outline', {}),
                        'accessType': match.get('accessType', 'view'),
                        'lastModified': data.get('lastModified', ''),
                    })
            results.sort(key=lambda c: c.get('lastModified', ''), reverse=True)
            return results
        except Exception as e:
            print(f"❌ Error fetching shared courses: {e}")
            raise

    async def get_course_shared_with(self, course_id: str) -> List[Dict]:
        """Get the sharedWith list for a course, enriched with display names."""
        ref = self.curricula_collection.document(course_id)
        doc = ref.get()
        if not doc.exists:
            return []
        shared = doc.to_dict().get('sharedWith', [])
        result = []
        for entry in shared:
            uid = entry.get('uid')
            if not uid:
                continue
            profile_doc = self.db.collection('teacher_profiles').document(uid).get()
            display_name = profile_doc.to_dict().get('display_name', uid) if profile_doc.exists else uid
            result.append({
                'uid': uid,
                'display_name': display_name,
                'accessType': entry.get('accessType', 'view'),
            })
        return result

    async def remove_from_shared_with(self, course_id: str, uid: str) -> bool:
        """Remove a user from the course's sharedWith list."""
        ref = self.curricula_collection.document(course_id)
        doc = ref.get()
        if not doc.exists:
            return False
        data = doc.to_dict()
        shared = [s for s in data.get('sharedWith', []) if s.get('uid') != uid]
        ref.update({'sharedWith': shared})
        return True

    async def get_notifications(self, uid: str) -> List[Dict]:
        """Get all notifications for a user, newest first."""
        docs = self.db.collection('notifications').where('toUid', '==', uid).stream()
        notifs = []
        for doc in docs:
            data = doc.to_dict()
            data['id'] = doc.id
            notifs.append(data)
        notifs.sort(key=lambda n: n.get('createdAt', ''), reverse=True)
        return notifs

    async def mark_notification_read(self, notif_id: str, uid: str) -> bool:
        """Mark a notification as read. Verifies ownership."""
        ref = self.db.collection('notifications').document(notif_id)
        doc = ref.get()
        if not doc.exists:
            return False
        if doc.to_dict().get('toUid') != uid:
            return False
        ref.update({'status': 'read'})
        return True

    async def delete_notification(self, notif_id: str, uid: str) -> bool:
        """Delete a notification. Verifies ownership."""
        ref = self.db.collection('notifications').document(notif_id)
        doc = ref.get()
        if not doc.exists:
            return False
        if doc.to_dict().get('toUid') != uid:
            return False
        ref.delete()
        return True

    # ── Public Courses ────────────────────────────────────────────────────────

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