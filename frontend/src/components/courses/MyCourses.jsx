import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  getTeacherCurricula,
  getCourseFolders,
  createCourseFolder,
  deleteCourseFolder,
  renameCourseFolder,
  addCourseToFolder,
  removeCourseFromFolder,
} from '../../firebase/dbService';
import CourseCard from './CourseCard';
import FolderCard from './FolderCard';
import DeleteConfirmModal from '../modals/DeleteConfirmModal';
import { FolderPlus, ChevronRight } from 'lucide-react';

const getCourseId = (curriculum) => curriculum.courseId || curriculum.id;

const MyCourses = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [curricula, setCurricula] = useState([]);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  // folderPath: array of folder IDs representing the navigation stack
  // [] = root, ['id1'] = inside folder1, ['id1','id2'] = inside subfolder
  const [folderPath, setFolderPath] = useState([]);
  const [draggingCourseId, setDraggingCourseId] = useState(null);
  const [dragOverFolderId, setDragOverFolderId] = useState(null);
  const [deleteModalData, setDeleteModalData] = useState(null);
  const [deleteFolderData, setDeleteFolderData] = useState(null);
  const [visibilityModalData, setVisibilityModalData] = useState(null);
  const [newFolderInput, setNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const newFolderRef = useRef(null);

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

  // Folders at the current navigation level
  const currentLevelFolders = folders.filter(f => (f.parentId || null) === currentFolderId);

  // All course IDs that live in any folder
  const allFolderCourseIds = new Set(folders.flatMap(f => f.courseIds || []));
  const ungroupedCourses = curricula.filter(c => !allFolderCourseIds.has(getCourseId(c)));

  const displayedCourses = currentFolderId
    ? curricula.filter(c => (currentFolder?.courseIds || []).includes(getCourseId(c)))
    : ungroupedCourses;

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
          ageRangeStart: curriculum.ageRangeStart || '',
          ageRangeEnd: curriculum.ageRangeEnd || '',
          numStudents: curriculum.numStudents || '',
          subject: curriculum.subject,
          topic: curriculum.topic,
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

  // ─── Course actions ─────────────────────────────────────────────────────────
  const handleDeleteClick = (curriculumId, courseName) => {
    setDeleteModalData({ id: curriculumId, name: courseName });
  };

  const handleToggleVisibility = (curriculum) => {
    setVisibilityModalData(curriculum);
  };

  const confirmToggleVisibility = async () => {
    const curriculum = visibilityModalData;
    if (!curriculum) return;
    const courseId = getCourseId(curriculum);
    const newIsPublic = !curriculum.isPublic;
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/curricula/${courseId}/visibility?teacherUid=${currentUser.uid}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isPublic: newIsPublic })
        }
      );
      const result = await response.json();
      if (result.success) {
        setCurricula(prev =>
          prev.map(c => getCourseId(c) === courseId ? { ...c, isPublic: newIsPublic } : c)
        );
      } else {
        alert('Failed to update visibility');
      }
    } catch (error) {
      console.error('Error toggling visibility:', error);
      alert('Failed to update visibility');
    } finally {
      setVisibilityModalData(null);
    }
  };

  // ─── Folder actions ─────────────────────────────────────────────────────────
  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    try {
      const newFolder = await createCourseFolder(currentUser.uid, name, currentFolderId);
      setFolders(prev => [...prev, newFolder]);
    } catch (error) {
      console.error('Error creating folder:', error);
    } finally {
      setNewFolderInput(false);
      setNewFolderName('');
    }
  };

  const handleRenameFolder = async (folderId, newName) => {
    try {
      await renameCourseFolder(currentUser.uid, folderId, newName);
      setFolders(prev => prev.map(f => f.id === folderId ? { ...f, name: newName } : f));
    } catch (error) {
      console.error('Error renaming folder:', error);
    }
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
      // If currently navigated inside a deleted folder, go back to root
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

    // Remove from any existing folder first
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

  // ─── Render ─────────────────────────────────────────────────────────────────
  const isRoot = folderPath.length === 0;

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>

      {/* Header + breadcrumb */}
      <div style={{ marginBottom: '20px' }}>
        {isRoot ? (
          <>
            <h1>My Courses</h1>
            <p style={{ color: '#333', margin: 0 }}>Welcome, {currentUser?.displayName || 'Teacher'}!</p>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setFolderPath([])}
              style={breadcrumbBtn}
            >
              My Courses
            </button>
            {folderPath.map((id, i) => {
              const isLast = i === folderPath.length - 1;
              return (
                <span key={id} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ChevronRight size={14} color="#9CA3AF" />
                  {isLast ? (
                    <span style={{ fontSize: '14px', fontWeight: '600', color: '#111' }}>
                      {folderById[id]?.name || '...'}
                    </span>
                  ) : (
                    <button
                      onClick={() => setFolderPath(folderPath.slice(0, i + 1))}
                      style={breadcrumbBtn}
                    >
                      {folderById[id]?.name || '...'}
                    </button>
                  )}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '30px' }}>
        <button
          onClick={() => navigate('/course-designer', {
            state: currentFolderId ? { targetFolderId: currentFolderId } : undefined
          })}
          style={{
            padding: '15px 30px',
            backgroundColor: '#007bff',
            color: 'white', border: 'none', borderRadius: '4px',
            cursor: 'pointer', fontSize: '17.6px',
          }}
        >
          + Create New Course
        </button>
        <button
          onClick={() => {
            setNewFolderInput(true);
            setTimeout(() => newFolderRef.current?.focus(), 50);
          }}
          style={{
            display: 'flex', alignItems: 'center', gap: '7px',
            padding: '14px 22px',
            backgroundColor: 'white',
            color: '#374151', border: '1.5px solid #D1D5DB', borderRadius: '4px',
            cursor: 'pointer', fontSize: '17.6px',
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          <FolderPlus size={18} /> New Folder
        </button>
      </div>

      {loading && <p>Loading your courses...</p>}

      {!loading && (
        <>
          {/* Folders section */}
          {(currentLevelFolders.length > 0 || newFolderInput) && (
            <div style={{ marginBottom: '36px' }}>
              <div style={{ marginBottom: '16px' }}>
                <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#374151' }}>Folders</h2>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-start' }}>
                {currentLevelFolders.map(folder => (
                  <FolderCard
                    key={folder.id}
                    folder={folder}
                    courseCount={(folder.courseIds || []).length}
                    subFolderCount={folders.filter(f => f.parentId === folder.id).length}
                    isDragOver={dragOverFolderId === folder.id}
                    onOpen={(id) => setFolderPath(prev => [...prev, id])}
                    onRename={handleRenameFolder}
                    onDelete={(id, name) => setDeleteFolderData({ id, name })}
                    onDragOver={setDragOverFolderId}
                    onDragLeave={() => setDragOverFolderId(null)}
                    onDrop={handleDropOnFolder}
                  />
                ))}

                {newFolderInput && (
                  <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    gap: '8px', padding: '20px 16px 14px', borderRadius: '12px',
                    background: 'rgba(255,255,255,0.72)', backdropFilter: 'blur(16px)',
                    border: '2px dashed #9CA3AF', width: '130px', minHeight: '110px',
                    justifyContent: 'center', boxSizing: 'border-box',
                  }}>
                    <FolderPlus size={36} color="#9CA3AF" />
                    <input
                      ref={newFolderRef}
                      value={newFolderName}
                      onChange={e => setNewFolderName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleCreateFolder();
                        if (e.key === 'Escape') { setNewFolderInput(false); setNewFolderName(''); }
                      }}
                      placeholder="Folder name"
                      style={{
                        width: '100%', padding: '4px 6px', fontSize: '12px',
                        borderRadius: '4px', border: '1px solid #2C5F3A',
                        outline: 'none', textAlign: 'center', boxSizing: 'border-box',
                        fontFamily: "'DM Sans', sans-serif",
                      }}
                    />
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={handleCreateFolder} style={createBtn}>Create</button>
                      <button
                        onClick={() => { setNewFolderInput(false); setNewFolderName(''); }}
                        style={cancelSmallBtn}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Courses section */}
          <div>
            {curricula.length > 0 && (
              <h2 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600', color: '#374151' }}>
                {currentFolderId ? 'Courses' : (folders.length > 0 ? 'Ungrouped' : 'All Courses')}
              </h2>
            )}

            {displayedCourses.length === 0 && curricula.length === 0 && isRoot && (
              <div style={{ textAlign: 'center', padding: '50px', color: '#333' }}>
                <h2>No courses yet</h2>
                <p>Click &quot;Create New Course&quot; to get started!</p>
              </div>
            )}

            {displayedCourses.length === 0 && currentFolderId && (
              <p style={{ color: '#9CA3AF', fontSize: '14px' }}>
                No courses in this folder yet. Drag courses here or create a new one above.
              </p>
            )}

            {displayedCourses.length === 0 && isRoot && curricula.length > 0 && (
              <p style={{ color: '#9CA3AF', fontSize: '14px' }}>
                All courses are inside folders.
              </p>
            )}

            {displayedCourses.length > 0 && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                gap: '16px',
              }}>
                {displayedCourses.map((curriculum) => (
                  <CourseCard
                    key={getCourseId(curriculum)}
                    curriculum={curriculum}
                    onCardClick={handleCardClick}
                    onDelete={handleDeleteClick}
                    onToggleVisibility={handleToggleVisibility}
                    draggable={true}
                    onDragStart={() => handleDragStart(getCourseId(curriculum))}
                    onDragEnd={handleDragEnd}
                    isDragging={draggingCourseId === getCourseId(curriculum)}
                    onRemoveFromFolder={
                      currentFolderId
                        ? () => handleRemoveCourseFromFolder(getCourseId(curriculum))
                        : null
                    }
                  />
                ))}
              </div>
            )}
          </div>
        </>
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
              <button onClick={() => setDeleteFolderData(null)} style={cancelBtn}>Cancel</button>
              <button
                onClick={() => handleDeleteFolder(deleteFolderData.id)}
                style={{ ...cancelBtn, backgroundColor: '#EF4444', color: 'white', border: 'none', fontWeight: '600' }}
              >
                Delete Folder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Visibility Modal */}
      {visibilityModalData && (
        <div style={overlay}>
          <div style={modalBox}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '19.8px' }}>
              {visibilityModalData.isPublic ? 'Make Course Private?' : 'Make Course Public?'}
            </h3>
            <p style={{ color: '#333', marginBottom: '24px', fontSize: '15.4px', lineHeight: '1.5' }}>
              {visibilityModalData.isPublic
                ? `"${visibilityModalData.courseName}" will no longer be visible to other teachers in your organization.`
                : `"${visibilityModalData.courseName}" will be visible to all teachers in your organization.`
              }
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button onClick={() => setVisibilityModalData(null)} style={cancelBtn}>Cancel</button>
              <button
                onClick={confirmToggleVisibility}
                style={{
                  ...cancelBtn,
                  backgroundColor: visibilityModalData.isPublic ? '#6b7280' : '#10B981',
                  color: 'white', border: 'none', fontWeight: '600'
                }}
              >
                {visibilityModalData.isPublic ? 'Make Private' : 'Make Public'}
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

const breadcrumbBtn = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: '#6B7280', fontSize: '14px', padding: '0',
  fontFamily: "'DM Sans', sans-serif",
  textDecoration: 'underline',
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

const createBtn = {
  padding: '3px 10px', fontSize: '12px',
  background: '#2C5F3A', color: 'white',
  border: 'none', borderRadius: '4px', cursor: 'pointer',
  fontFamily: "'DM Sans', sans-serif",
};

const cancelSmallBtn = {
  padding: '3px 8px', fontSize: '12px',
  background: 'rgba(0,0,0,0.05)', color: '#374151',
  border: '1px solid rgba(0,0,0,0.1)', borderRadius: '4px', cursor: 'pointer',
  fontFamily: "'DM Sans', sans-serif",
};

export default MyCourses;
