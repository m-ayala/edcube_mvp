import { 
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './config';

/**
 * Save a new curriculum or update existing one
 */
export const saveCurriculum = async (teacherUid, curriculumData, organizationId) => {
  try {
    // Generate curriculum ID (use existing ID if updating, otherwise create new)
    const curriculumId = curriculumData.id || doc(collection(db, 'curricula')).id;
    
    const curriculumDoc = {
      teacherUid: teacherUid,
      organizationId: organizationId,
      courseName: curriculumData.courseName,
      subject: curriculumData.subject,
      class: curriculumData.class,
      timeDuration: curriculumData.timeDuration,
      topic: curriculumData.topic,
      numWorksheets: curriculumData.numWorksheets || 0,
      numActivities: curriculumData.numActivities || 0,
      objectives: curriculumData.objectives || '',
      sections: curriculumData.sections || [],
      createdAt: curriculumData.createdAt || serverTimestamp(),
      lastModified: serverTimestamp()
    };

    await setDoc(doc(db, 'curricula', curriculumId), curriculumDoc);

    return {
      success: true,
      curriculumId: curriculumId,
      message: 'Curriculum saved successfully!'
    };
  } catch (error) {
    console.error('Save curriculum error:', error);
    throw error;
  }
};

/**
 * Get all curricula for a specific teacher
 */
export const getTeacherCurricula = async (teacherUid) => {
  try {
    const q = query(
      collection(db, 'curricula'),
      where('teacherUid', '==', teacherUid),
      orderBy('lastModified', 'desc')
    );

    const querySnapshot = await getDocs(q);
    const curricula = [];

    querySnapshot.forEach((doc) => {
      curricula.push({
        id: doc.id,
        ...doc.data()
      });
    });

    return {
      success: true,
      curricula: curricula
    };
  } catch (error) {
    console.error('Get curricula error:', error);
    throw error;
  }
};

/**
 * Get a specific curriculum by ID
 */
export const getCurriculumById = async (curriculumId) => {
  try {
    const docRef = doc(db, 'curricula', curriculumId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return {
        success: true,
        curriculum: {
          id: docSnap.id,
          ...docSnap.data()
        }
      };
    } else {
      throw new Error('Curriculum not found');
    }
  } catch (error) {
    console.error('Get curriculum error:', error);
    throw error;
  }
};

/**
 * Delete a curriculum
 */
export const deleteCurriculum = async (curriculumId) => {
  try {
    await deleteDoc(doc(db, 'curricula', curriculumId));
    
    return {
      success: true,
      message: 'Curriculum deleted successfully'
    };
  } catch (error) {
    console.error('Delete curriculum error:', error);
    throw error;
  }
};

/**
 * Get teacher profile
 */
export const getTeacherProfile = async (teacherUid) => {
  try {
    const docRef = doc(db, 'teachers', teacherUid);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return {
        success: true,
        teacher: docSnap.data()
      };
    } else {
      throw new Error('Teacher profile not found');
    }
  } catch (error) {
    console.error('Get teacher profile error:', error);
    throw error;
  }
};