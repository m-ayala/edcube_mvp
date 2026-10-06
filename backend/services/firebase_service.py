"""
Firebase Service
Handles all Firestore database operations for curricula
"""

import os
import asyncio
import uuid
import urllib.parse
from typing import Dict, List, Optional
import logging
import firebase_admin
from firebase_admin import credentials, firestore, storage as fb_storage
from datetime import datetime
from schemas.curriculum_schema import CurriculumFields as F
from firebase.paths import (
    org_col,
    afterschool_doc,
    afterschool_entries_col,
    summer_camps_doc,
    resolve_org as _resolve_org,
    DEFAULT_SYNOPSIS_ORG,
)

logger = logging.getLogger(__name__)

STORAGE_BUCKET = 'edcube-8fe7d.firebasestorage.app'


class FirebaseService:
    """Service for Firebase Firestore operations"""

    def __init__(self):
        """Initialize Firebase Admin SDK"""
        # Initialize Firebase if not already done
        if not firebase_admin._apps:
            # Use Application Default Credentials (from gcloud auth)
            firebase_admin.initialize_app()

        self.db = firestore.client()
        self.bucket = fb_storage.bucket(STORAGE_BUCKET)

    # ── Org-scoped path helpers ──────────────────────────────────────────────
    # All curricula/profile/notification access goes through these instead of
    # a flat top-level collection. See backend/firebase/paths.py.

    def curricula_col(self, org: str):
        """`Users/{org}/curricula`"""
        return org_col(self.db, org, 'curricula')

    def resolve_org(self, uid: str) -> str:
        """Resolve a uid to its org_id. See firebase.paths.resolve_org."""
        return _resolve_org(uid)

    # ── Synopsis path helpers ─────────────────────────────────────────────────
    # Synopsis/afterschool routes have no auth and are ICC-specific today
    # (tasks/firestore-reorg-spec.md, decision 4), so these default to
    # DEFAULT_SYNOPSIS_ORG. The `org` param exists for forward-compatibility
    # and keeps every existing call site working unchanged.

    def _weeks_col(self, org: str = DEFAULT_SYNOPSIS_ORG):
        return summer_camps_doc(self.db, org).collection('weeks')

    def _camps_col(self, week_id: str, org: str = DEFAULT_SYNOPSIS_ORG):
        return self._weeks_col(org).document(week_id).collection('camps')

    def _entries_col(self, week_id: str, camp_id: str, org: str = DEFAULT_SYNOPSIS_ORG):
        return self._camps_col(week_id, org).document(camp_id).collection('entries')

    async def upload_file(self, data: bytes, path: str, content_type: str) -> str:
        """Upload bytes to Firebase Storage and return a permanent download URL."""
        loop = asyncio.get_running_loop()
        bucket = self.bucket

        def _upload():
            blob = bucket.blob(path)
            download_token = str(uuid.uuid4())
            # Set metadata before upload so it's included in one API call (no patch needed)
            blob.metadata = {'firebaseStorageDownloadTokens': download_token}
            blob.upload_from_string(data, content_type=content_type)
            encoded = urllib.parse.quote(path, safe='')
            return (
                f"https://firebasestorage.googleapis.com/v0/b/{bucket.name}"
                f"/o/{encoded}?alt=media&token={download_token}"
            )

        return await loop.run_in_executor(None, _upload)

    # In firebase_service.py - save_curriculum method
    async def save_curriculum(self, teacherUid: str, curriculum_data: Dict, organizationId: str) -> str:
        """Save a new curriculum to Firestore (FLAT STRUCTURE)"""
        try:
            import uuid

            course_id = curriculum_data.get('preset_course_id') or str(uuid.uuid4())
            
            # Prepare flat structure document
            doc_data = {
                'courseId': course_id,
                'teacherUid': teacherUid,
                'teacherEmail': curriculum_data.get('teacherEmail', ''),
                'organizationId': organizationId,
                'courseName': curriculum_data.get('course_name', ''),
                'subject': curriculum_data.get('subject', ''),
                'topic': curriculum_data.get('topic', ''),
                'ageRangeStart': curriculum_data.get('age_range_start', ''),
                'ageRangeEnd': curriculum_data.get('age_range_end', ''),
                'numStudents': curriculum_data.get('num_students', 0),
                'numDays': curriculum_data.get('num_days', 0),
                'hoursPerDay': curriculum_data.get('hours_per_day', 0),
                'numWorksheets': curriculum_data.get('num_worksheets', 0),
                'numActivities': curriculum_data.get('num_activities', 0),
                'timeDuration': curriculum_data.get('duration', ''),
                'objectives': curriculum_data.get('objectives', ''),
                'courseAttachments': curriculum_data.get('course_attachments', []),
                'courseInfoNotes': curriculum_data.get('course_info_notes', ''),
                'sections': curriculum_data.get('sections', []),
                'generatedTopics': curriculum_data.get('boxes', []),
                'handsOnResources': curriculum_data.get('handsOnResources', {}),
                'outline': curriculum_data.get('outline', {}),
                'isPublic': False,
                'sharedWith': [],
                'createdAt': datetime.utcnow().isoformat(),
                'lastModified': datetime.utcnow().isoformat()
            }
            
            self.curricula_col(organizationId).document(course_id).set(doc_data)

            print(f"✅ Saved curriculum to Firebase: {course_id}")
            return course_id
        except Exception as e:
            print(f"❌ Error saving curriculum: {str(e)}")
            raise
    
    async def get_curriculum(self, curriculum_id: str, teacherUid: str, org: Optional[str] = None) -> Optional[Dict]:
        """
        Fetch a curriculum by ID

        Args:
            curriculum_id: Firestore document ID
            teacherUid: User ID for authorization
            org: Org the curriculum lives under. Resolved from teacherUid via
                resolve_org() if omitted -- pass it explicitly when the caller
                already has it (e.g. from a decoded token) to skip that lookup.

        Returns:
            Curriculum data or None if not found
        """
        try:
            org = org or _resolve_org(teacherUid)
            doc = self.curricula_col(org).document(curriculum_id).get()

            if not doc.exists:
                return None

            curriculum = doc.to_dict()

            # Allow access if owner OR if course is public.
            # Sharing/public courses are same-org only today (decision 3 in
            # tasks/firestore-reorg-spec.md), and this doc was only found
            # because it lives under the requester's own org subcollection,
            # so same-org is already guaranteed structurally -- no separate
            # Firestore org check needed here.
            is_owner = curriculum.get('teacherUid') == teacherUid
            if not is_owner:
                is_public = curriculum.get('isPublic', False)
                if is_public:
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
            # Org subcollection already scopes this; organizationId is kept as
            # an optional override for callers that already resolved it.
            org = organizationId or _resolve_org(teacherUid)
            query = self.curricula_col(org).where('teacherUid', '==', teacherUid)

            # Apply ordering and execute
            docs = query.order_by('createdAt', direction=firestore.Query.DESCENDING).stream()
            
            curricula = []
            for doc in docs:
                data = doc.to_dict()
                curricula.append({
                    'id': doc.id,
                    'courseId': data.get('courseId'),
                    'courseName': data.get('courseName'),
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
            org = _resolve_org(teacherUid)
            curriculum = await self.get_curriculum(curriculum_id, teacherUid, org=org)

            if not curriculum:
                return False

            # Delete document
            self.curricula_col(org).document(curriculum_id).delete()
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
            org = _resolve_org(teacherUid)
            curriculum = await self.get_curriculum(curriculum_id, teacherUid, org=org)

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
            self.curricula_col(org).document(curriculum_id).set(curriculum)
            
            print(f"✅ Added {len(resources)} {resource_type} to curriculum {curriculum_id}")
        
        except Exception as e:
            print(f"❌ Error adding resources: {str(e)}")
            raise
    async def update_section(
        self,
        curriculum_id: str,
        section_id: str,
        section_data: dict,
        org: str
    ) -> bool:
        """
        Update a specific section within a curriculum document.

        Called after Phase 2 populates a section with videos.

        Args:
            curriculum_id: Firestore document ID
            section_id: Section ID within the curriculum
            section_data: Updated section data with video_resources
            org: Org the curriculum lives under (required -- no cross-org
                collection_group lookup anymore, tasks/firestore-reorg-spec.md
                Round 2, section B).

        Returns:
            bool: True if successful
        """
        try:
            doc_ref = self.curricula_col(org).document(curriculum_id)
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
            org = _resolve_org(teacherUid)
            doc_ref = self.curricula_col(org).document(curriculum_id)
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
            org = _resolve_org(teacherUid)
            docs = self.curricula_col(org)\
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
                    F.SUBJECT: data.get(F.SUBJECT, ''),
                    F.TOPIC: data.get(F.TOPIC, ''),
                    F.CLASS: data.get(F.CLASS),
                    F.TIME_DURATION: data.get(F.TIME_DURATION),  # ← FIX: was 'duration'
                    F.CREATED_AT: data.get(F.CREATED_AT),
                    F.LAST_MODIFIED: data.get(F.LAST_MODIFIED)
                })
            
            return curricula
        
        except Exception as e:
            print(f"❌ Error listing curricula: {str(e)}")
            raise

    async def update_curriculum(self, course_id: str, updates: Dict, org: str):
        """
        Update an existing curriculum.

        Args:
            course_id: Course ID
            updates: Fields to update
            org: Org the curriculum lives under (required -- no cross-org
                collection_group lookup anymore, tasks/firestore-reorg-spec.md
                Round 2, section B).

        Returns:
            dict: Success response
        """
        try:
            # Add lastModified timestamp
            updates['lastModified'] = datetime.utcnow().isoformat()

            # Update the document
            self.curricula_col(org).document(course_id).update(updates)

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
        org: str,
        access_type: str = None,
    ) -> str:
        """
        Create a notification document in Firestore under Users/{org}/notifications.
        Notifications are delete-on-seen (tasks/firestore-reorg-spec.md, decision 6):
        there is no `status` field -- see delete_seen_notifications().
        """
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
            'createdAt': now,
        }
        if access_type:
            doc['accessType'] = access_type
        org_col(self.db, org, 'notifications').document(notif_id).set(doc)
        print(f"✅ Notification created: {notif_id}")
        return notif_id

    async def add_shared_with(self, course_id: str, uid: str, access_type: str, org: str) -> None:
        """
        Add or update a user in the course's sharedWith list, and keep
        sharedWithUids (a flat array of just the uids) in sync alongside it --
        array_contains on sharedWithUids is what powers the efficient
        "shared with me" query in get_shared_courses() below instead of
        streaming and filtering every course in the org (tasks/firestore-reorg-spec.md
        Round 2, section D). sharedWith itself is unchanged (list of
        {uid, accessType} objects, still the source of truth for accessType).
        """
        ref = self.curricula_col(org).document(course_id)
        doc = ref.get()
        if not doc.exists:
            return
        data = doc.to_dict()
        shared = data.get('sharedWith', [])
        # Replace if already present, else append
        shared = [s for s in shared if s.get('uid') != uid]
        shared.append({'uid': uid, 'accessType': access_type})
        shared_uids = sorted({s.get('uid') for s in shared if s.get('uid')})
        ref.update({'sharedWith': shared, 'sharedWithUids': shared_uids})
        print(f"✅ sharedWith updated for course {course_id}: {uid} → {access_type}")

    async def get_shared_courses(self, uid: str, org: str) -> List[Dict]:
        """
        Get all courses where this uid appears in sharedWith, via a direct
        array_contains query on sharedWithUids -- not a stream-and-filter scan
        of every course in the org (tasks/firestore-reorg-spec.md Round 2,
        section D).
        """
        try:
            docs = self.curricula_col(org).where('sharedWithUids', 'array_contains', uid).stream()
            results = []
            for doc in docs:
                data = doc.to_dict()
                shared = data.get('sharedWith', [])
                match = next((s for s in shared if s.get('uid') == uid), None)
                access_type = match.get('accessType', 'view') if match else 'view'
                results.append({
                    'id': doc.id,
                    'courseId': data.get('courseId', doc.id),
                    'courseName': data.get('courseName', ''),
                    'subject': data.get('subject', ''),
                    'topic': data.get('topic', ''),
                    'class': data.get('class', ''),
                    'isPublic': data.get('isPublic', False),
                    'teacherUid': data.get('teacherUid', ''),
                    'sections': data.get('sections', []),
                    'outline': data.get('outline', {}),
                    'accessType': access_type,
                    'lastModified': data.get('lastModified', ''),
                })
            results.sort(key=lambda c: c.get('lastModified', ''), reverse=True)
            return results
        except Exception as e:
            print(f"❌ Error fetching shared courses: {e}")
            raise

    async def get_course_shared_with(self, course_id: str, org: str) -> List[Dict]:
        """Get the sharedWith list for a course, enriched with display names."""
        ref = self.curricula_col(org).document(course_id)
        doc = ref.get()
        if not doc.exists:
            return []
        shared = doc.to_dict().get('sharedWith', [])
        result = []
        for entry in shared:
            uid = entry.get('uid')
            if not uid:
                continue
            profile_doc = org_col(self.db, org, 'teacher_profiles').document(uid).get()
            display_name = profile_doc.to_dict().get('display_name', uid) if profile_doc.exists else uid
            result.append({
                'uid': uid,
                'display_name': display_name,
                'accessType': entry.get('accessType', 'view'),
            })
        return result

    async def remove_from_shared_with(self, course_id: str, uid: str, org: str) -> bool:
        """Remove a user from the course's sharedWith list (and sharedWithUids
        alongside it, kept in sync per tasks/firestore-reorg-spec.md Round 2,
        section D)."""
        ref = self.curricula_col(org).document(course_id)
        doc = ref.get()
        if not doc.exists:
            return False
        data = doc.to_dict()
        shared = [s for s in data.get('sharedWith', []) if s.get('uid') != uid]
        shared_uids = sorted({s.get('uid') for s in shared if s.get('uid')})
        ref.update({'sharedWith': shared, 'sharedWithUids': shared_uids})
        return True

    async def get_notifications(self, uid: str, org: str) -> List[Dict]:
        """Get all notifications for a user, newest first."""
        docs = org_col(self.db, org, 'notifications').where('toUid', '==', uid).stream()
        notifs = []
        for doc in docs:
            data = doc.to_dict()
            if data is None:
                continue
            data['id'] = doc.id
            notifs.append(data)
        notifs.sort(key=lambda n: n.get('createdAt', ''), reverse=True)
        return notifs

    async def delete_notification(self, notif_id: str, uid: str, org: str) -> bool:
        """Delete a single notification. Verifies ownership."""
        ref = org_col(self.db, org, 'notifications').document(notif_id)
        doc = ref.get()
        if not doc.exists:
            return False
        if doc.to_dict().get('toUid') != uid:
            return False
        ref.delete()
        return True

    async def delete_seen_notifications(self, uid: str, org: str, notif_ids: List[str]) -> int:
        """
        Delete a batch of notifications once they've been shown in the bell
        (delete-on-seen, tasks/firestore-reorg-spec.md decision 6 -- replaces
        the old mark_notification_read / `status` field).

        Verifies ownership (toUid == uid) per doc; ids that don't exist or
        don't belong to this uid are silently skipped.

        Returns the number of notifications actually deleted.
        """
        col = org_col(self.db, org, 'notifications')
        deleted = 0
        for notif_id in notif_ids:
            ref = col.document(notif_id)
            doc = ref.get()
            if doc.exists and (doc.to_dict() or {}).get('toUid') == uid:
                ref.delete()
                deleted += 1
        return deleted

    # ── Public Courses ────────────────────────────────────────────────────────

    async def get_public_courses(self, organizationId: str, limit: int = 20) -> List[Dict]:
        """Get public courses for an organization"""
        try:
            query = (self.curricula_col(organizationId)
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

    # ── Synopsis Weeks ────────────────────────────────────────────────────────

    async def create_synopsis_week(self, data: Dict) -> str:
        week_id = str(uuid.uuid4())
        data['week_id'] = week_id
        self._weeks_col().document(week_id).set(data)
        print(f"✅ Created synopsis week: {week_id}")
        return week_id

    async def get_all_synopsis_weeks(self) -> List[Dict]:
        docs = self._weeks_col().order_by('created_at', direction=firestore.Query.DESCENDING).stream()
        return [{'id': d.id, **d.to_dict()} for d in docs]

    async def get_synopsis_week(self, week_id: str) -> Optional[Dict]:
        """Direct path lookup for a single week — no collection scan required."""
        doc = self._weeks_col().document(week_id).get()
        if not doc.exists:
            return None
        return {'id': doc.id, **doc.to_dict()}

    async def get_active_synopsis_week(self) -> Optional[Dict]:
        docs = list(self._weeks_col().where('is_active', '==', True).limit(1).stream())
        if not docs:
            return None
        return {'id': docs[0].id, **docs[0].to_dict()}

    async def get_visible_synopsis_weeks(self) -> List[Dict]:
        """Weeks the admin has flagged as visible to teachers, most recent start_date first."""
        docs = self._weeks_col().where('is_visible', '==', True).stream()
        weeks = [{'id': d.id, **d.to_dict()} for d in docs]
        weeks.sort(key=lambda w: w.get('start_date', ''), reverse=True)
        return weeks

    async def update_synopsis_week(self, week_id: str, updates: Dict) -> bool:
        ref = self._weeks_col().document(week_id)
        if not ref.get().exists:
            return False
        ref.update(updates)
        return True

    async def deactivate_all_synopsis_weeks(self) -> None:
        docs = self._weeks_col().where('is_active', '==', True).stream()
        for doc in docs:
            doc.reference.update({'is_active': False})

    async def delete_synopsis_week(self, week_id: str) -> bool:
        ref = self._weeks_col().document(week_id)
        if not ref.get().exists:
            return False
        # Cascade: delete all entries under each camp, then each camp, then the week
        for camp_doc in self._camps_col(week_id).stream():
            camp_data = camp_doc.to_dict() or {}
            camp_id = camp_data.get('camp_id', camp_doc.id)
            for entry_doc in self._entries_col(week_id, camp_id).stream():
                entry_doc.reference.delete()
            camp_doc.reference.delete()
        ref.delete()
        return True

    # ── Synopsis Camps ────────────────────────────────────────────────────────

    async def create_synopsis_camp(self, data: Dict) -> str:
        camp_id = str(uuid.uuid4())
        data['camp_id'] = camp_id
        week_id = data['week_id']
        self._camps_col(week_id).document(camp_id).set(data)
        print(f"✅ Created synopsis camp: {camp_id}")
        return camp_id

    async def get_synopsis_camps_for_week(self, week_id: str) -> List[Dict]:
        docs = self._camps_col(week_id).stream()
        results = [{'id': d.id, **d.to_dict()} for d in docs]
        results.sort(key=lambda c: c.get('created_at', ''))
        return results

    async def get_synopsis_camp_in_week(self, week_id: str, camp_id: str) -> Optional[Dict]:
        """Direct path lookup — no collection group query, no composite index required."""
        doc = self._camps_col(week_id).document(camp_id).get()
        if not doc.exists:
            return None
        return {'id': doc.id, **doc.to_dict()}

    async def update_synopsis_camp(self, week_id: str, camp_id: str, updates: Dict) -> bool:
        ref = self._camps_col(week_id).document(camp_id)
        if not ref.get().exists:
            return False
        ref.update(updates)
        return True

    async def delete_synopsis_camp(self, week_id: str, camp_id: str) -> bool:
        ref = self._camps_col(week_id).document(camp_id)
        if not ref.get().exists:
            return False
        for entry_doc in self._entries_col(week_id, camp_id).stream():
            entry_doc.reference.delete()
        ref.delete()
        return True

    # ── Synopsis Entries ──────────────────────────────────────────────────────

    async def upsert_synopsis_entry(self, camp_id: str, week_id: str, day: str, data: Dict) -> str:
        """Create or overwrite the entry for (camp_id, day). Returns entry_id."""
        entries_col = self._entries_col(week_id, camp_id)
        existing = list(entries_col.where('day', '==', day).limit(1).stream())
        if existing:
            entry_id = existing[0].id
            existing[0].reference.update(data)
        else:
            entry_id = str(uuid.uuid4())
            data['entry_id'] = entry_id
            data['camp_id'] = camp_id
            data['week_id'] = week_id
            data['day'] = day
            entries_col.document(entry_id).set(data)
        return entry_id

    async def get_synopsis_entries_for_camp_in_week(self, week_id: str, camp_id: str) -> List[Dict]:
        """Direct path lookup — no collection group query, no composite index required."""
        docs = self._entries_col(week_id, camp_id).stream()
        return [{'id': d.id, **d.to_dict()} for d in docs]

    async def get_synopsis_entry_in_week(self, week_id: str, camp_id: str, entry_id: str) -> Optional[Dict]:
        """Direct path lookup — replaces the old cross-camp collection_group
        lookup (tasks/firestore-reorg-spec.md Round 2, section B). Callers must
        supply week_id/camp_id; there is no cross-org/cross-camp fallback."""
        doc = self._entries_col(week_id, camp_id).document(entry_id).get()
        if not doc.exists:
            return None
        return {'id': doc.id, **doc.to_dict()}

    async def get_synopsis_entries_for_week(self, week_id: str) -> List[Dict]:
        """Direct path: iterate camps then their entries — no collection group, no composite index."""
        all_entries = []
        for camp_doc in self._camps_col(week_id).stream():
            camp_data = camp_doc.to_dict() or {}
            camp_id = camp_data.get('camp_id', camp_doc.id)
            for entry_doc in self._entries_col(week_id, camp_id).stream():
                all_entries.append({'id': entry_doc.id, **entry_doc.to_dict()})
        return all_entries

    # ── Synopsis Food ─────────────────────────────────────────────────────────

    async def get_synopsis_food(self, week_id: str) -> Optional[Dict]:
        doc = self._weeks_col().document(week_id).get()
        if not doc.exists:
            return None
        food = (doc.to_dict() or {}).get('food')
        if food is None:
            return None
        return {'week_id': week_id, **food}

    async def upsert_synopsis_food(self, week_id: str, data: Dict) -> None:
        self._weeks_col().document(week_id).set({'food': data}, merge=True)

    # ── Afterschool Synopsis Months ───────────────────────────────────────────
    # Users/{org}/synopsis/afterschool/months — separate from the camp-synopsis
    # Users/{org}/synopsis/summer_camps/weeks subcollection above. month_id is
    # always deterministic ("YYYY-MM"), so these use direct document-path
    # lookups (no composite index / collection scan needed), same posture as
    # the direct-path synopsis camp/entry lookups above.

    def _afterschool_months_col(self, org: str = DEFAULT_SYNOPSIS_ORG):
        return afterschool_doc(self.db, org).collection('months')

    async def get_month(self, month_id: str) -> Optional[Dict]:
        doc = self._afterschool_months_col().document(month_id).get()
        if not doc.exists:
            return None
        return {'id': doc.id, **doc.to_dict()}

    async def list_months(self) -> List[Dict]:
        docs = self._afterschool_months_col().stream()
        months = [{'id': d.id, **d.to_dict()} for d in docs]
        months.sort(key=lambda m: (m.get('year', 0), m.get('month', 0)))
        return months

    async def list_visible_months(self) -> List[Dict]:
        docs = self._afterschool_months_col().where('is_visible', '==', True).stream()
        months = [{'id': d.id, **d.to_dict()} for d in docs]
        months.sort(key=lambda m: (m.get('year', 0), m.get('month', 0)))
        return months

    async def get_active_month(self) -> Optional[Dict]:
        docs = list(self._afterschool_months_col().where('is_active', '==', True).limit(1).stream())
        if not docs:
            return None
        return {'id': docs[0].id, **docs[0].to_dict()}

    async def create_month(self, month_id: str, data: Dict) -> str:
        self._afterschool_months_col().document(month_id).set(data)
        print(f"✅ Created afterschool synopsis month: {month_id}")
        return month_id

    async def update_month(self, month_id: str, updates: Dict) -> bool:
        ref = self._afterschool_months_col().document(month_id)
        if not ref.get().exists:
            return False
        ref.update(updates)
        return True

    async def delete_month(self, month_id: str) -> bool:
        ref = self._afterschool_months_col().document(month_id)
        if not ref.get().exists:
            return False
        # Cascade: entries live nested under their month
        # (Users/{org}/synopsis/afterschool/months/{month_id}/entries), so
        # deleting a month must delete its entries too (tasks/firestore-reorg-spec.md
        # Round 2, section C -- replaces the old "no cascade" behaviour).
        for entry_doc in self._afterschool_entries_col(month_id).stream():
            entry_doc.reference.delete()
        ref.delete()
        return True

    async def deactivate_all_afterschool_months(self) -> None:
        docs = self._afterschool_months_col().where('is_active', '==', True).stream()
        for doc in docs:
            doc.reference.update({'is_active': False})

    # ── Afterschool Synopsis Entries ──────────────────────────────────────────
    # Users/{org}/synopsis/afterschool/months/{month_id}/entries — nested under
    # their month (tasks/firestore-reorg-spec.md Round 2, section C; replaces the
    # old flat Users/{org}/synopsis/afterschool/entries sibling collection).
    # Doc id is still the deterministic composite key
    # "{grade_slug}__{type_slug}__{month_id}", same last-write-wins upsert
    # posture as the camp feature's entries. Every call site already has
    # month_id on hand (it's part of the entry_id), so it's taken as an
    # explicit param rather than re-parsed out of entry_id.

    def _afterschool_entries_col(self, month_id: str, org: str = DEFAULT_SYNOPSIS_ORG):
        return afterschool_entries_col(self.db, org, month_id)

    async def get_afterschool_entry(self, entry_id: str, month_id: str) -> Optional[Dict]:
        doc = self._afterschool_entries_col(month_id).document(entry_id).get()
        if not doc.exists:
            return None
        return {'id': doc.id, **doc.to_dict()}

    async def upsert_afterschool_entry(self, entry_id: str, month_id: str, data: Dict) -> str:
        self._afterschool_entries_col(month_id).document(entry_id).set(data)
        return entry_id