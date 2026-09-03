import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  getTeacherCurricula,
  getCourseFolders,
  deleteCourseFolder,
  removeCourseFromFolder,
  addCourseToFolder,
} from '../../firebase/dbService';
import CourseCard from './CourseCard';
import FolderCard from './FolderCard';
import CardRow from './CardRow';
import AddFolderModal from './AddFolderModal';
import DeleteConfirmModal from '../modals/DeleteConfirmModal';
import { Plus, FolderPlus, ChevronRight } from 'lucide-react';

const getCourseId = (curriculum) => curriculum.courseId || curriculum.id;

const MyCourses = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [curricula, setCurricula] = useState([]);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  // folderPath: array of folder IDs representing the navigation stack
  const [folderPath, setFolderPath] = useState([]);
  const [draggingCourseId, setDraggingCourseId] = useState(null);
  const [dragOverFolderId, setDragOverFolderId] = useState(null);
  const [deleteModalData, setDeleteModalData] = useState(null);
  const [deleteFolderData, setDeleteFolderData] = useState(null);
  // folderModal: null | { folder: <obj|null>, parentId: <id|null> }
  const [folderModal, setFolderModal] = useState(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadData(); }, [currentUser]);

  const loadData = async () => {
    try {
      setLoading(true);
      const curriculaResult = await getTeacherCurricula(currentUser.uid);
      setCurricula(curriculaResult.curricula);
    } catch (error) {
      console.error('Error loading curricula:', error);
      alert('Error loading your courses. Please try again.');
    } finally {
      setLoading(false);
    }
    try {
      const foldersResult = await getCourseFolders(currentUser.uid);
      setFolders(foldersResult);
    } catch (error) {
      console.error('Error loading folders:', error);
    }
  };

  // ─── Derived state ──────────────────────────────────────────────────────────
  const currentFolderId = folderPath.length > 0 ? folderPath[folderPath.length - 1] : null;
  const currentFolder = folders.find(f => f.id === currentFolderId) || null;
  const folderById = Object.fromEntries(folders.map(f => [f.id, f]));

  const currentLevelFolders = folders.filter(f => (f.parentId || null) === currentFolderId);

  const allFolderCourseIds = new Set(folders.flatMap(f => f.courseIds || []));
  const ungroupedCourses = curricula.filter(c => !allFolderCourseIds.has(getCourseId(c)));

  const displayedCourses = currentFolderId
    ? curricula.filter(c => (currentFolder?.courseIds || []).includes(getCourseId(c)))
    : ungroupedCourses;

  const publishedCourses = displayedCourses.filter(c => c.isPublic);
  const draftCourses = displayedCourses.filter(c => !c.isPublic);

  const isRoot = folderPath.length === 0;

  // ─── Navigation ─────────────────────────────────────────────────────────────
  const handleCardClick = (curriculum) => {
    const sections = (curriculum.outline?.sections || curriculum.sections || []).map(section => ({
      id: section.id,
      title: section.title,
      description: section.description || '',
      type: section.type,
      duration: section.duration,
      subsections: (section.subsections || []).map(sub => ({
        id: sub.id,
        title: sub.title,
        description: sub.description || '',
        learning_objectives: sub.learning_objectives || [],
        duration_minutes: sub.duration_minutes ?? 20,
        content_blocks: sub.content_blocks || [],
        worksheets: sub.worksheets || [],
        activities: sub.activities || [],
        video_resources: sub.video_resources || [],
      }))
    }));

    navigate('/course-view', {
      state: {
        formData: {
          courseName: curriculum.courseName,
          subject: curriculum.subject || '',
          topic: curriculum.topic || '',
          ageRangeStart: curriculum.ageRangeStart || '',
          ageRangeEnd: curriculum.ageRangeEnd || '',
          numStudents: curriculum.numStudents || '',
          timeDuration: curriculum.timeDuration,
          objectives: curriculum.objectives || ''
        },
        sections,
        curriculumId: getCourseId(curriculum),
        isPublic: curriculum.isPublic || false,
        isOwner: true
      }
    });
  };

  const handleAddCourse = () => {
    navigate('/course-designer', {
      state: currentFolderId ? { targetFolderId: currentFolderId } : undefined
    });
  };

  // ─── Course actions ─────────────────────────────────────────────────────────
  const handleDeleteClick = (curriculumId, courseName) => {
    setDeleteModalData({ id: curriculumId, name: courseName });
  };

  // ─── Folder actions ─────────────────────────────────────────────────────────
  const handleFolderSaved = (savedFolder) => {
    setFolders(prev => {
      const exists = prev.some(f => f.id === savedFolder.id);
      return exists
        ? prev.map(f => (f.id === savedFolder.id ? { ...f, ...savedFolder } : f))
        : [...prev, savedFolder];
    });
    setFolderModal(null);
  };

  const handleDeleteFolder = async (folderId) => {
    // Collect the folder and all its descendants recursively
    const toDelete = new Set();
    const collectDescendants = (id) => {
      toDelete.add(id);
      folders.filter(f => f.parentId === id).forEach(f => collectDescendants(f.id));
    };
    collectDescendants(folderId);

    try {
      await Promise.all([...toDelete].map(id => deleteCourseFolder(currentUser.uid, id)));
      setFolders(prev => prev.filter(f => !toDelete.has(f.id)));
      if (folderPath.some(id => toDelete.has(id))) setFolderPath([]);
    } catch (error) {
      console.error('Error deleting folder:', error);
    } finally {
      setDeleteFolderData(null);
    }
  };

  const handleRemoveCourseFromFolder = async (courseId) => {
    if (!currentFolderId) return;
    try {
      await removeCourseFromFolder(currentUser.uid, currentFolderId, courseId);
      setFolders(prev =>
        prev.map(f =>
          f.id === currentFolderId
            ? { ...f, courseIds: (f.courseIds || []).filter(id => id !== courseId) }
            : f
        )
      );
    } catch (error) {
      console.error('Error removing course from folder:', error);
    }
  };

  // ─── Drag and drop ──────────────────────────────────────────────────────────
  const handleDragStart = (courseId) => setDraggingCourseId(courseId);

  const handleDragEnd = () => {
    setDraggingCourseId(null);
    setDragOverFolderId(null);
  };

  const handleDropOnFolder = async (folderId) => {
    if (!draggingCourseId) return;
    setDragOverFolderId(null);

    const existingFolder = folders.find(f => (f.courseIds || []).includes(draggingCourseId));
    if (existingFolder && existingFolder.id !== folderId) {
      await removeCourseFromFolder(currentUser.uid, existingFolder.id, draggingCourseId);
      setFolders(prev =>
        prev.map(f =>
          f.id === existingFolder.id
            ? { ...f, courseIds: (f.courseIds || []).filter(id => id !== draggingCourseId) }
            : f
        )
      );
    }

    const targetFolder = folders.find(f => f.id === folderId);
    if (targetFolder && (targetFolder.courseIds || []).includes(draggingCourseId)) return;

    try {
      await addCourseToFolder(currentUser.uid, folderId, draggingCourseId);
      setFolders(prev =>
        prev.map(f =>
          f.id === folderId
            ? { ...f, courseIds: [...(f.courseIds || []), draggingCourseId] }
            : f
        )
      );
    } catch (error) {
      console.error('Error adding course to folder:', error);
    }
  };

  // ─── Render helpers ─────────────────────────────────────────────────────────
  const renderCourse = (curriculum) => (
    <CourseCard
      key={getCourseId(curriculum)}
      curriculum={curriculum}
      onCardClick={handleCardClick}
      onDelete={handleDeleteClick}
      draggable
      onDragStart={() => handleDragStart(getCourseId(curriculum))}
      onDragEnd={handleDragEnd}
      isDragging={draggingCourseId === getCourseId(curriculum)}
      onRemoveFromFolder={
        currentFolderId ? () => handleRemoveCourseFromFolder(getCourseId(curriculum)) : null
      }
    />
  );

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '30px 32px 48px' }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '20px',
        flexWrap: 'wrap', marginBottom: '30px',
      }}>
        {isRoot ? (
          <h1 style={{
            margin: 0, fontFamily: "'DM Serif Display', Georgia, serif", fontWeight: 400,
            fontSize: '42px', lineHeight: 1.05, letterSpacing: '-0.005em', color: '#0E1620',
          }}>
            My Courses
          </h1>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <button onClick={() => setFolderPath([])} style={breadcrumbBtn}>My Courses</button>
            {folderPath.map((id, i) => {
              const isLast = i === folderPath.length - 1;
              return (
                <span key={id} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ChevronRight size={14} color="#9CA3AF" />
                  {isLast ? (
                    <span style={{ fontSize: '18px', fontWeight: 600, color: '#111' }}>
                      {folderById[id]?.name || '…'}
                    </span>
                  ) : (
                    <button onClick={() => setFolderPath(folderPath.slice(0, i + 1))} style={breadcrumbBtn}>
                      {folderById[id]?.name || '…'}
                    </button>
                  )}
                </span>
              );
            })}
          </div>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '12px' }}>
          <button className="mc-btn" onClick={handleAddCourse} style={headerBtn}>
            <Plus size={18} /> Add Course
          </button>
          <button
            className="mc-btn"
            onClick={() => setFolderModal({ folder: null, parentId: currentFolderId })}
            style={headerBtn}
          >
            <FolderPlus size={18} /> Add Folder
          </button>
        </div>
      </div>

      {loading && <p style={{ color: '#6B7280' }}>Loading your courses…</p>}

      {!loading && (
        <>
          {currentLevelFolders.length > 0 && (
            <CardRow label={isRoot ? 'My Folders' : 'Folders'}>
              {currentLevelFolders.map(folder => (
                <FolderCard
                  key={folder.id}
                  folder={folder}
                  courseCount={(folder.courseIds || []).length}
                  subFolderCount={folders.filter(f => f.parentId === folder.id).length}
                  isDragOver={dragOverFolderId === folder.id}
                  onOpen={(id) => setFolderPath(prev => [...prev, id])}
                  onEdit={(f) => setFolderModal({ folder: f, parentId: f.parentId || null })}
                  onDelete={(id, name) => setDeleteFolderData({ id, name })}
                  onDragOver={setDragOverFolderId}
                  onDragLeave={() => setDragOverFolderId(null)}
                  onDrop={handleDropOnFolder}
                />
              ))}
            </CardRow>
          )}

          {publishedCourses.length > 0 && (
            <CardRow label="Published Courses" count={publishedCourses.length}>
              {publishedCourses.map(renderCourse)}
            </CardRow>
          )}

          {draftCourses.length > 0 && (
            <CardRow label="Draft Courses" count={draftCourses.length}>
              {draftCourses.map(renderCourse)}
            </CardRow>
          )}

          {/* Empty states */}
          {curricula.length === 0 && currentLevelFolders.length === 0 && isRoot && (
            <div style={emptyBox}>
              <h2 style={{ margin: '0 0 8px', fontSize: '20px', color: '#374151' }}>No courses yet</h2>
              <p style={{ margin: '0 0 18px', color: '#6B7280' }}>
                Create your first course to get started.
              </p>
              <button className="mc-btn" onClick={handleAddCourse} style={{ ...headerBtn, margin: '0 auto' }}>
                <Plus size={18} /> Add Course
              </button>
            </div>
          )}

          {displayedCourses.length === 0 && currentFolderId && (
            <p style={{ color: '#9CA3AF', fontSize: '14px', padding: '4px 4px 20px' }}>
              No courses in this folder yet. Drag a course here or use “Add Course”.
            </p>
          )}

          {displayedCourses.length === 0 && isRoot && curricula.length > 0 && (
            <p style={{ color: '#9CA3AF', fontSize: '14px', padding: '4px' }}>
              All your courses are inside folders.
            </p>
          )}
        </>
      )}

      {/* Add / Edit Folder Modal */}
      {folderModal && (
        <AddFolderModal
          folder={folderModal.folder}
          parentId={folderModal.parentId}
          onClose={() => setFolderModal(null)}
          onSaved={handleFolderSaved}
        />
      )}

      {/* Delete Folder Modal */}
      {deleteFolderData && (
        <div style={overlay}>
          <div style={modalBox}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '19.8px' }}>Delete Folder?</h3>
            <p style={{ color: '#333', marginBottom: '24px', fontSize: '15.4px', lineHeight: '1.5' }}>
              &quot;{deleteFolderData.name}&quot; and all its sub-folders will be deleted. Courses will return to Ungrouped.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button className="mc-btn" onClick={() => setDeleteFolderData(null)} style={cancelBtn}>Cancel</button>
              <button
                className="mc-btn"
                onClick={() => handleDeleteFolder(deleteFolderData.id)}
                style={{ ...cancelBtn, backgroundColor: '#EF4444', color: 'white', border: 'none', fontWeight: '600' }}
              >
                Delete Folder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Course Modal */}
      {deleteModalData && (
        <DeleteConfirmModal
          courseName={deleteModalData.name}
          onConfirm={async () => {
            try {
              const { deleteCurriculum } = await import('../../firebase/dbService');
              await deleteCurriculum(deleteModalData.id);
              setDeleteModalData(null);
              loadData();
            } catch (error) {
              console.error('Delete error:', error);
              alert('Error deleting course. Please try again.');
            }
          }}
          onCancel={() => setDeleteModalData(null)}
        />
      )}
    </div>
  );
};

const headerBtn = {
  display: 'inline-flex', alignItems: 'center', gap: '9px',
  padding: '12px 20px', borderRadius: '10px',
  background: '#F0F4FF', border: '1px solid #E4EAFF', color: '#3E62BC',
  fontFamily: "'DM Sans', sans-serif", fontWeight: 500, fontSize: '16px',
  cursor: 'pointer', whiteSpace: 'nowrap',
};

const breadcrumbBtn = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: '#6B7280', fontSize: '15px', padding: 0,
  fontFamily: "'DM Sans', sans-serif", textDecoration: 'underline',
};

const emptyBox = {
  textAlign: 'center', padding: '60px 20px', color: '#333',
  display: 'flex', flexDirection: 'column', alignItems: 'center',
};

const overlay = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
  justifyContent: 'center', alignItems: 'center', zIndex: 1000,
};

const modalBox = {
  backgroundColor: 'white', borderRadius: '12px', padding: '28px',
  maxWidth: '420px', width: '90%', textAlign: 'center',
  boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
};

const cancelBtn = {
  padding: '8px 20px', backgroundColor: '#f3f4f6', color: '#374151',
  border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer',
  fontSize: '15.4px', fontWeight: '500',
};

export default MyCourses;
