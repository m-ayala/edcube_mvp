from firebase_admin import firestore
from datetime import datetime
import uuid

db = firestore.client()

def save_curriculum(curriculum_data):
    """
    Save curriculum to Firestore with flat structure.
    
    Args:
        curriculum_data (dict): Contains:
            - teacherUid (str)
            - teacherEmail (str)
            - courseName (str)
            - class (str)
            - subject (str)
            - sections (list)
            - handsOnResources (dict)
            - generatedTopics (list)
    
    Returns:
        dict: Success response with course_id
    """
    try:
        # Generate unique course ID
        course_id = str(uuid.uuid4())
        
        # Prepare document data
        doc_data = {
            'courseId': course_id,
            'teacherUid': curriculum_data.get('teacherUid'),
            'teacherEmail': curriculum_data.get('teacherEmail'),
            'courseName': curriculum_data.get('courseName'),
            'class': curriculum_data.get('class'),
            'subject': curriculum_data.get('subject'),
            'sections': curriculum_data.get('sections', []),
            'handsOnResources': curriculum_data.get('handsOnResources', {}),
            'generatedTopics': curriculum_data.get('generatedTopics', []),
            'isPublic': False,  # Default to private
            'sharedWith': [],   # Empty array for future sharing
            'createdAt': datetime.utcnow().isoformat(),
            'lastModified': datetime.utcnow().isoformat()
        }
        
        # Save to Firestore at flat path
        db.collection('curricula').document(course_id).set(doc_data)
        
        return {
            'success': True,
            'courseId': course_id,
            'message': 'Course saved successfully'
        }
        
    except Exception as e:
        print(f"Error saving curriculum: {e}")
        return {
            'success': False,
            'error': str(e)
        }


def get_teacher_curricula(teacher_uid):
    """
    Get all curricula for a specific teacher.
    
    Args:
        teacher_uid (str): Teacher's Firebase UID
    
    Returns:
        list: List of curriculum documents
    """
    try:
        curricula = []
        docs = db.collection('curricula').where('teacherUid', '==', teacher_uid).stream()
        
        for doc in docs:
            curriculum = doc.to_dict()
            curricula.append(curriculum)
        
        return curricula
        
    except Exception as e:
        print(f"Error fetching curricula: {e}")
        return []


def get_curriculum_by_id(course_id):
    """
    Get a specific curriculum by ID.
    
    Args:
        course_id (str): Course ID
    
    Returns:
        dict: Curriculum data or None
    """
    try:
        doc = db.collection('curricula').document(course_id).get()
        
        if doc.exists:
            return doc.to_dict()
        else:
            return None
            
    except Exception as e:
        print(f"Error fetching curriculum: {e}")
        return None


def update_curriculum(course_id, updates):
    """
    Update an existing curriculum.
    
    Args:
        course_id (str): Course ID
        updates (dict): Fields to update
    
    Returns:
        dict: Success response
    """
    try:
        updates['lastModified'] = datetime.utcnow().isoformat()
        
        db.collection('curricula').document(course_id).update(updates)
        
        return {
            'success': True,
            'message': 'Course updated successfully'
        }
        
    except Exception as e:
        print(f"Error updating curriculum: {e}")
        return {
            'success': False,
            'error': str(e)
        }


def delete_curriculum(course_id, teacher_uid):
    """
    Delete a curriculum (only if owned by teacher).
    
    Args:
        course_id (str): Course ID
        teacher_uid (str): Teacher's UID for verification
    
    Returns:
        dict: Success response
    """
    try:
        # Verify ownership first
        doc = db.collection('curricula').document(course_id).get()
        
        if not doc.exists:
            return {'success': False, 'error': 'Course not found'}
        
        curriculum = doc.to_dict()
        if curriculum.get('teacherUid') != teacher_uid:
            return {'success': False, 'error': 'Unauthorized'}
        
        # Delete the document
        db.collection('curricula').document(course_id).delete()
        
        return {
            'success': True,
            'message': 'Course deleted successfully'
        }
        
    except Exception as e:
        print(f"Error deleting curriculum: {e}")
        return {
            'success': False,
            'error': str(e)
        }