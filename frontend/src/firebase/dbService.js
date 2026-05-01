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
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  updateDoc
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

// ─── Resource Library ─────────────────────────────────────────────────────────

/**
 * Get all library folders for a teacher
 */
export const getLibraryFolders = async (teacherUid) => {
  const q = query(
    collection(db, 'teachers', teacherUid, 'libraryFolders'),
    orderBy('createdAt', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

/**
 * Create a new library folder
 */
export const createLibraryFolder = async (teacherUid, name) => {
  const ref = doc(collection(db, 'teachers', teacherUid, 'libraryFolders'));
  await setDoc(ref, {
    name,
    links: [],
    createdAt: serverTimestamp()
  });
  return ref.id;
};

/**
 * Delete a library folder and all its links
 */
export const deleteLibraryFolder = async (teacherUid, folderId) => {
  await deleteDoc(doc(db, 'teachers', teacherUid, 'libraryFolders', folderId));
};

/**
 * Add a link to a folder
 */
export const addLinkToFolder = async (teacherUid, folderId, linkData) => {
  const link = {
    id: `link-${Date.now()}`,
    title: linkData.title,
    url: linkData.url,
    description: linkData.description || '',
    addedAt: new Date().toISOString()
  };
  await updateDoc(doc(db, 'teachers', teacherUid, 'libraryFolders', folderId), {
    links: arrayUnion(link)
  });
  return link;
};

/**
 * Delete a link from a folder
 */
export const deleteLinkFromFolder = async (teacherUid, folderId, link) => {
  await updateDoc(doc(db, 'teachers', teacherUid, 'libraryFolders', folderId), {
    links: arrayRemove(link)
  });
};

/**
 * Rename a library folder
 */
export const renameLibraryFolder = async (teacherUid, folderId, newName) => {
  await updateDoc(doc(db, 'teachers', teacherUid, 'libraryFolders', folderId), {
    name: newName
  });
};

// ─── Course Folders ───────────────────────────────────────────────────────────

export const getCourseFolders = async (teacherUid) => {
  const q = query(
    collection(db, 'teachers', teacherUid, 'courseFolders'),
    orderBy('createdAt', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const createCourseFolder = async (teacherUid, name, parentId = null) => {
  const ref = doc(collection(db, 'teachers', teacherUid, 'courseFolders'));
  await setDoc(ref, { name, courseIds: [], parentId, createdAt: serverTimestamp() });
  return { id: ref.id, name, courseIds: [], parentId };
};

export const deleteCourseFolder = async (teacherUid, folderId) => {
  await deleteDoc(doc(db, 'teachers', teacherUid, 'courseFolders', folderId));
};

export const renameCourseFolder = async (teacherUid, folderId, newName) => {
  await updateDoc(doc(db, 'teachers', teacherUid, 'courseFolders', folderId), { name: newName });
};

export const addCourseToFolder = async (teacherUid, folderId, courseId) => {
  await updateDoc(doc(db, 'teachers', teacherUid, 'courseFolders', folderId), {
    courseIds: arrayUnion(courseId)
  });
};

export const removeCourseFromFolder = async (teacherUid, folderId, courseId) => {
  await updateDoc(doc(db, 'teachers', teacherUid, 'courseFolders', folderId), {
    courseIds: arrayRemove(courseId)
  });
};

// ─── Teacher Profile ───────────────────────────────────────────────────────────

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