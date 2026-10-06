import {
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
import { orgCol, orgSubDoc, teacherSubCol, teacherSubDoc } from './paths';

// NOTE: every function here now takes `org` (the org_id resolved via
// `checkEmailOrg` / `useAuth().org` -- see contexts/AuthContext.jsx) and
// reads/writes under `Users/{org}/...` instead of the old top-level
// collections (tasks/firestore-reorg-spec.md, TASK-008). There is no default
// org -- callers must have a resolved org before calling any of these.
//
// `saveCurriculum` (the old direct-Firestore curriculum writer) was removed
// here: it had no importers (curriculum creation/update goes through the
// backend's /api/save-course and /api/update-course instead, which resolve
// the org server-side) and its old 'curricula' path would have silently
// written to the wrong place if it were ever called.

/**
 * Get a specific curriculum by ID
 */
export const getCurriculumById = async (curriculumId, org) => {
  try {
    const docRef = orgSubDoc(db, org, 'curricula', curriculumId);
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
 * Get all curricula for a specific teacher
 */
export const getTeacherCurricula = async (teacherUid, org) => {
  try {
    const q = query(
      orgCol(db, org, 'curricula'),
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
 * Delete a curriculum
 */
export const deleteCurriculum = async (curriculumId, org) => {
  try {
    await deleteDoc(orgSubDoc(db, org, 'curricula', curriculumId));

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
export const getLibraryFolders = async (teacherUid, org) => {
  const q = query(
    teacherSubCol(db, org, teacherUid, 'libraryFolders'),
    orderBy('createdAt', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

/**
 * Create a new library folder
 */
export const createLibraryFolder = async (teacherUid, org, name) => {
  const ref = doc(teacherSubCol(db, org, teacherUid, 'libraryFolders'));
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
export const deleteLibraryFolder = async (teacherUid, org, folderId) => {
  await deleteDoc(teacherSubDoc(db, org, teacherUid, 'libraryFolders', folderId));
};

/**
 * Add a link to a folder
 */
export const addLinkToFolder = async (teacherUid, org, folderId, linkData) => {
  const link = {
    id: `link-${Date.now()}`,
    title: linkData.title,
    url: linkData.url,
    description: linkData.description || '',
    addedAt: new Date().toISOString()
  };
  await updateDoc(teacherSubDoc(db, org, teacherUid, 'libraryFolders', folderId), {
    links: arrayUnion(link)
  });
  return link;
};

/**
 * Delete a link from a folder
 */
export const deleteLinkFromFolder = async (teacherUid, org, folderId, link) => {
  await updateDoc(teacherSubDoc(db, org, teacherUid, 'libraryFolders', folderId), {
    links: arrayRemove(link)
  });
};

/**
 * Rename a library folder
 */
export const renameLibraryFolder = async (teacherUid, org, folderId, newName) => {
  await updateDoc(teacherSubDoc(db, org, teacherUid, 'libraryFolders', folderId), {
    name: newName
  });
};

// ─── Course Folders ───────────────────────────────────────────────────────────

export const getCourseFolders = async (teacherUid, org) => {
  const q = query(
    teacherSubCol(db, org, teacherUid, 'courseFolders'),
    orderBy('createdAt', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const createCourseFolder = async (teacherUid, org, name, parentId = null, extras = {}) => {
  const {
    description = '',
    labels = [],
    collaborators = [],
    color = null,
  } = extras;
  const ref = doc(teacherSubCol(db, org, teacherUid, 'courseFolders'));
  const data = {
    name,
    courseIds: [],
    parentId,
    description,
    labels,
    collaborators,
    color,
    createdAt: serverTimestamp(),
  };
  await setDoc(ref, data);
  return { id: ref.id, ...data, createdAt: null };
};

export const deleteCourseFolder = async (teacherUid, org, folderId) => {
  await deleteDoc(teacherSubDoc(db, org, teacherUid, 'courseFolders', folderId));
};

export const renameCourseFolder = async (teacherUid, org, folderId, newName) => {
  await updateDoc(teacherSubDoc(db, org, teacherUid, 'courseFolders', folderId), { name: newName });
};

/**
 * Patch any editable fields on a course folder
 * (name, description, labels, collaborators, color).
 */
export const updateCourseFolder = async (teacherUid, org, folderId, patch) => {
  await updateDoc(teacherSubDoc(db, org, teacherUid, 'courseFolders', folderId), patch);
};

export const addCourseToFolder = async (teacherUid, org, folderId, courseId) => {
  await updateDoc(teacherSubDoc(db, org, teacherUid, 'courseFolders', folderId), {
    courseIds: arrayUnion(courseId)
  });
};

export const removeCourseFromFolder = async (teacherUid, org, folderId, courseId) => {
  await updateDoc(teacherSubDoc(db, org, teacherUid, 'courseFolders', folderId), {
    courseIds: arrayRemove(courseId)
  });
};

// ─── Teacher Profile ───────────────────────────────────────────────────────────

/**
 * Get teacher profile
 */
export const getTeacherProfile = async (teacherUid, org) => {
  try {
    const docRef = orgSubDoc(db, org, 'teachers', teacherUid);
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

