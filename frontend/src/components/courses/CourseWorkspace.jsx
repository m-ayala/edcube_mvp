// src/components/courses/CourseWorkspace.jsx
import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import TopicBox from './TopicBox';
import Section from './Section';
import TopicDetailsModal from '../modals/TopicDetailsModal';
import BreakModal from '../modals/BreakModal';

const CourseWorkspace = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const { 
    formData, 
    generatedTopics, 
    existingSections,
    existingHandsOnResources,
    isEditing,
    curriculumId 
  } = location.state || {};
  
  const [courseName, setCourseName] = useState(formData?.courseName || '');
  const [topics, setTopics] = useState(generatedTopics || []);
  const [sections, setSections] = useState(existingSections || []);
  const [showBreakModal, setShowBreakModal] = useState(false);
  const [handsOnResources, setHandsOnResources] = useState({});
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [videosByTopic, setVideosByTopic] = useState({}); // Add this line

  // Load videos from sections when component mounts
  useEffect(() => {
    console.log('📦 CourseWorkspace loaded with:', {
      courseName,
      topicsCount: topics.length,
      sectionsCount: sections.length,
      isEditing,
      curriculumId
    });

    // Extract video_resources from loaded sections and populate videosByTopic state
    if (sections.length > 0) {
      const loadedVideos = {};
      
      sections.forEach(section => {
        if (section.topics) {
          section.topics.forEach(topic => {
            if (topic.video_resources && topic.video_resources.length > 0) {
              loadedVideos[topic.id] = topic.video_resources;
            }
          });
        }
      });

      if (Object.keys(loadedVideos).length > 0) {
        console.log('🎥 Loaded videos from saved course:', loadedVideos);
        setVideosByTopic(loadedVideos);
      }
    }
  }, []); // Empty dependency array - only run once on mount

  const saveToHistory = () => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({ sections: [...sections], handsOnResources: {...handsOnResources} });
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = () => {
    if (historyIndex > 0) {
      const previousState = history[historyIndex - 1];
      setSections(previousState.sections);
      setHandsOnResources(previousState.handsOnResources);
      setHistoryIndex(historyIndex - 1);
    }
  };

  const addSection = () => {
    const newSection = {
      id: `section-${Date.now()}`,
      name: `Section ${sections.filter(s => s.type !== 'break').length + 1}`,
      type: 'section',
      topics: []
    };
    setSections([...sections, newSection]);
  };

  const addBreak = () => {
    setShowBreakModal(true);
  };

  const handleBreakCreate = (duration, unit) => {
    const newBreak = {
      id: `break-${Date.now()}`,
      type: 'break',
      duration: `${duration} ${unit}`
    };
    setSections([...sections, newBreak]);
    setShowBreakModal(false);
  };

  const updateSectionName = (sectionId, newName) => {
    setSections(sections.map(section => 
      section.id === sectionId ? { ...section, name: newName } : section
    ));
  };

  const removeSection = (sectionId) => {
    setSections(sections.filter(s => s.id !== sectionId));
  };

  const handleTopicClick = (topic) => {
    setSelectedTopic(topic);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedTopic(null);
  };

  const handleDragStart = (e, topic) => {
    e.dataTransfer.setData('topic', JSON.stringify(topic));
  };

  const handleDrop = (e, sectionId) => {
    e.preventDefault();
    const topic = JSON.parse(e.dataTransfer.getData('topic'));
    
    setSections(sections.map(section => {
      if (section.id === sectionId) {
        // Check if topic already exists in this section
        if (section.topics.find(t => t.id === topic.id)) {
          return section;
        }
        return {
          ...section,
          topics: [...section.topics, topic]
        };
      }
      return section;
    }));
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const removeTopicFromSection = (sectionId, topicId) => {
    setSections(sections.map(section => {
      if (section.id === sectionId) {
        return {
          ...section,
          topics: section.topics.filter(t => t.id !== topicId)
        };
      }
      return section;
    }));
  };

  const generateResource = async (topicId, resourceType) => {
    // Find the topic to get its details
    const topic = topicsInSections.find(t => t.id === topicId);
    if (!topic) {
      console.error('Topic not found:', topicId);
      return;
    }

    try {
      console.log(`🔨 Generating ${resourceType} for topic:`, topic.title);
      
      const response = await fetch('http://localhost:8000/api/generate-resource', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicId: topicId,
          resourceType: resourceType, // 'worksheet' or 'activity'
          gradeLevel: formData.class,
          topicTitle: topic.title,
          topicDescription: topic.description || '',
          learningObjectives: topic.learningObjectives || []
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const resource = await response.json();
      console.log(`✅ ${resourceType} generated:`, resource);
      
      setHandsOnResources(prev => ({
        ...prev,
        [topicId]: [...(prev[topicId] || []), resource]
      }));
      
      alert(`${resourceType.charAt(0).toUpperCase() + resourceType.slice(1)} generated successfully!`);
    } catch (error) {
      console.error(`Error generating ${resourceType}:`, error);
      alert(`Failed to generate ${resourceType}`);
    }
  };

  const generateVideosFromBackend = async (topicId, topic, sectionId) => {
    try {
      console.log('🎬 Calling backend to generate videos...');
      
      const response = await fetch('http://localhost:8000/api/generate-videos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topicId: topicId,
          topicTitle: topic.title,
          topicData: {
            title: topic.title,
            duration: topic.duration,
            plaType: topic.plaType,
            learningObjectives: topic.learningObjectives,
            subtopics: topic.subtopics,
            subject: formData.subject,
            courseName: formData.courseName,
            courseTopic: formData.topic
          },
          sectionId: sectionId,
          gradeLevel: formData.class,
          courseId: curriculumId || 'new-course'
        })
      });

      const result = await response.json();

      if (result.success) {
        setVideosByTopic(prev => ({
          ...prev,
          [topicId]: result.videos
        }));
        console.log('✅ Videos received from backend:', result.videos.length);
      } else {
        console.error('❌ Failed to generate videos');
        alert('Failed to generate videos');
      }
    } catch (error) {
      console.error('❌ Error calling backend:', error);
      alert('Error generating videos');
    }
  };

  const saveCourse = async () => {
    try {
      const idToken = await currentUser.getIdToken();
      
      // Prepare sections with video_resources
      const sectionsWithVideos = sections.map(section => {
        const sectionData = {
          ...section,
          topics: section.topics || []
        };
        
        // Add video_resources to each topic that has generated videos
        if (section.topics) {
          sectionData.topics = section.topics.map(topic => ({
            ...topic,
            video_resources: videosByTopic[topic.id] || []
          }));
        }
        
        return sectionData;
      });
      
      // Prepare course data
      const courseData = {
        courseName,
        class: formData.class,
        subject: formData.subject,
        topic: formData.topic,
        timeDuration: formData.timeDuration,
        objectives: formData.objectives || '',
        sections: sectionsWithVideos,
        handsOnResources,
        generatedTopics: topics,
      };
      
      console.log('💾 Saving course:', {
        isEditing,
        curriculumId,
        sectionsCount: sectionsWithVideos.length,
        videosCount: Object.keys(videosByTopic).length
      });
      
      // ALWAYS use update-course if we have a curriculumId
      const hasExistingId = curriculumId && curriculumId !== 'new-course';
      
      if (hasExistingId) {
        courseData.courseId = curriculumId;
      }
      
      const endpoint = hasExistingId
        ? `http://localhost:8000/api/update-course?teacherUid=${currentUser.uid}`
        : `http://localhost:8000/api/save-course?teacherUid=${currentUser.uid}`;
      
      console.log('📡 Using endpoint:', endpoint, 'with courseId:', courseData.courseId);
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify(courseData)
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log('✅ Course saved successfully!');
        alert(hasExistingId ? 'Course updated!' : 'Course saved!');
      } else {
        console.error('❌ Save failed:', result);
        alert('Failed to save: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error saving course:', error);
      alert('Failed to save course');
    }
  };

  // Get all topics that have been added to sections
  const topicsInSections = sections
    .filter(s => s.type === 'section')
    .flatMap(s => s.topics || []);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Bar */}
      <div style={{ 
        padding: '15px 30px', 
        borderBottom: '1px solid #ddd',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: 'white'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <h2 style={{ margin: 0 }}>🎓 EdCube</h2>
          <input
            type="text"
            value={courseName}
            onChange={(e) => setCourseName(e.target.value)}
            style={{
              fontSize: '18px',
              padding: '8px 12px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              minWidth: '300px'
            }}
          />
        </div>
        
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <button
            onClick={undo}
            disabled={historyIndex <= 0}
            style={{
              padding: '8px 16px',
              backgroundColor: historyIndex <= 0 ? '#ccc' : '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: historyIndex <= 0 ? 'not-allowed' : 'pointer'
            }}
          >
            ↶ Undo
          </button>
          
          <button
            onClick={saveCourse}
            style={{
              padding: '10px 20px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            💾 Save Course
          </button>
          
          <span style={{ color: '#666' }}>
            {currentUser?.displayName}
          </span>
          
          <button
            onClick={() => navigate('/my-courses')}
            style={{
              padding: '8px 16px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* 4-Column Layout */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* FIRST COLUMN - Generated Topics */}
        <div style={{ 
          width: '20%', 
          borderRight: '1px solid #ddd', 
          padding: '20px',
          overflowY: 'auto',
          backgroundColor: '#fafafa'
        }}>
          <h3>📚 Generated Topics</h3>
          <p style={{ fontSize: '14px', color: '#666', marginBottom: '20px' }}>
            Click to view details • Drag to add to course
          </p>
          
          {topics.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#999' }}>
              <p>No topics generated yet</p>
            </div>
          ) : (
            topics.map(topic => (
              <TopicBox
                key={topic.id}
                topic={topic}
                onClick={handleTopicClick}
                onDragStart={handleDragStart}
              />
            ))
          )}
        </div>

        {/* SECOND COLUMN - Course Outline */}
        <div style={{ 
          width: '30%', 
          borderRight: '1px solid #ddd', 
          padding: '20px',
          overflowY: 'auto',
          backgroundColor: 'white'
        }}>
          <h3>Course Outline</h3>
          
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            <button
              onClick={addSection}
              style={{
                flex: 1,
                padding: '10px',
                backgroundColor: '#007bff',
                color: 'white',
                border: '1px dashed #007bff',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              ➕ Section
            </button>
            
            <button
              onClick={addBreak}
              style={{
                flex: 1,
                padding: '10px',
                backgroundColor: 'white',
                color: '#007bff',
                border: '1px dashed #007bff',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              ⏸️ Break
            </button>
          </div>

          {/* Sections List */}
          {sections.length === 0 ? (
            <div style={{ 
              textAlign: 'center', 
              padding: '40px 20px', 
              color: '#999',
              border: '2px dashed #ddd',
              borderRadius: '8px'
            }}>
              <p>No sections yet</p>
              <p style={{ fontSize: '14px' }}>Click "+ Section" to add your first section</p>
            </div>
          ) : (
            sections.map(section => (
              <Section
                key={section.id}
                section={section}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onUpdateName={updateSectionName}
                onRemove={removeSection}
                onRemoveTopic={removeTopicFromSection}
              />
            ))
          )}
        </div>

        {/* THIRD COLUMN - Video Resources (renamed from Hands-On Resources) */}
        <div style={{ 
          width: '25%', 
          borderRight: '1px solid #ddd',
          padding: '20px',
          overflowY: 'auto',
          backgroundColor: '#fafafa'
        }}>
          <h3>🎥 Video Resources</h3>
          
          {topicsInSections.length === 0 ? (
            <div style={{ 
              textAlign: 'center', 
              padding: '40px 20px', 
              color: '#999',
              backgroundColor: '#f5f5f5',
              borderRadius: '8px',
              marginTop: '20px'
            }}>
              <p style={{ fontSize: '18px', marginBottom: '10px' }}>📹</p>
              <p>Add topics to your course outline to generate videos here.</p>
            </div>
          ) : (
            topicsInSections.map(topic => (
            <div 
              key={topic.id}
              style={{
                border: '1px solid #ddd',
                borderRadius: '8px',
                padding: '15px',
                marginBottom: '20px',
                backgroundColor: '#f9f9f9'
              }}
            >
              <h4 style={{ margin: '0 0 10px 0' }}>{topic.title}</h4>
              <p style={{ fontSize: '14px', color: '#666', margin: '0 0 15px 0' }}>
                {topic.duration} • {topic.plaType}
              </p>
              
              {!videosByTopic[topic.id] ? (
                <button
                  onClick={() => {
                    const section = sections.find(s => 
                      s.topics && s.topics.some(t => t.id === topic.id)
                    );
                    generateVideosFromBackend(topic.id, topic, section?.id || 'unknown');
                  }}
                  style={{
                    width: '100%',
                    padding: '10px',
                    backgroundColor: '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    marginBottom: videosByTopic[topic.id] ? '10px' : '0'
                  }}
                >
                  {videosByTopic[topic.id] ? '🔄 Regenerate Videos' : '🎬 Generate Videos'}
                </button>
              ) : (
                <div>
                  <p style={{ fontSize: '12px', fontWeight: '600', color: '#666', marginBottom: '10px' }}>
                    📹 Videos ({videosByTopic[topic.id].length})
                  </p>
                  {videosByTopic[topic.id].map((video, idx) => (
                    <a
                      key={idx}
                      href={`https://www.youtube.com/watch?v=${video.videoId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'flex',
                        gap: '10px',
                        padding: '10px',
                        marginBottom: '8px',
                        backgroundColor: 'white',
                        border: '1px solid #e0e0e0',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        textDecoration: 'none',
                        color: 'inherit'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                    >
                      <img 
                        src={video.thumbnailUrl} 
                        alt={video.title}
                        style={{
                          width: '80px',
                          height: '60px',
                          objectFit: 'cover',
                          borderRadius: '4px'
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ 
                          fontSize: '13px', 
                          fontWeight: '500', 
                          margin: '0 0 4px 0',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {video.title}
                        </p>
                        <p style={{ fontSize: '11px', color: '#666', margin: '0' }}>
                          {video.channelName} • {video.duration}
                        </p>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))
          )}
        </div>

        {/* FOURTH COLUMN - Worksheets & Activities */}
        <div style={{ 
          width: '25%', 
          padding: '20px',
          overflowY: 'auto',
          backgroundColor: 'white'
        }}>
          <h3>📝 Hands-On Resources</h3>
          
          {topicsInSections.length === 0 ? (
            <div style={{ 
              textAlign: 'center', 
              padding: '40px 20px', 
              color: '#999',
              backgroundColor: '#f5f5f5',
              borderRadius: '8px',
              marginTop: '20px'
            }}>
              <p style={{ fontSize: '18px', marginBottom: '10px' }}>📚</p>
              <p>Add topics to your course outline to generate resources here.</p>
            </div>
          ) : (
            topicsInSections.map(topic => (
              <div 
                key={`handson-${topic.id}`}
                style={{
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  padding: '15px',
                  marginBottom: '20px',
                  backgroundColor: '#f9f9f9'
                }}
              >
                <h4 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>{topic.title}</h4>
                
                {/* Worksheets Section */}
                <div style={{ marginBottom: '15px' }}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginBottom: '10px'
                  }}>
                    <p style={{ fontSize: '13px', fontWeight: '600', color: '#666', margin: 0 }}>
                      📄 Worksheets
                    </p>
                    <button
                      onClick={() => generateResource(topic.id, 'worksheet')}
                      style={{
                        padding: '5px 10px',
                        backgroundColor: '#007bff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: '600'
                      }}
                    >
                      + Add
                    </button>
                  </div>
                  
                  {!handsOnResources[topic.id]?.filter(r => r.type === 'worksheet').length ? (
                    <p style={{ fontSize: '12px', color: '#999', fontStyle: 'italic' }}>
                      No worksheets yet
                    </p>
                  ) : (
                    handsOnResources[topic.id]
                      .filter(r => r.type === 'worksheet')
                      .map((worksheet, idx) => (
                        <div 
                          key={idx}
                          style={{
                            padding: '8px',
                            marginBottom: '6px',
                            backgroundColor: 'white',
                            border: '1px solid #e0e0e0',
                            borderRadius: '4px',
                            fontSize: '12px'
                          }}
                        >
                          <p style={{ margin: 0, fontWeight: '500' }}>{worksheet.title}</p>
                          {worksheet.sourceUrl && (
                            <a 
                              href={worksheet.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ fontSize: '11px', color: '#007bff' }}
                            >
                              View Source
                            </a>
                          )}
                        </div>
                      ))
                  )}
                </div>

                {/* Activities Section */}
                <div>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignments: 'center',
                    marginBottom: '10px'
                  }}>
                    <p style={{ fontSize: '13px', fontWeight: '600', color: '#666', margin: 0 }}>
                      🎯 Activities
                    </p>
                    <button
                      onClick={() => generateResource(topic.id, 'activity')}
                      style={{
                        padding: '5px 10px',
                        backgroundColor: '#28a745',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: '600'
                      }}
                    >
                      + Add
                    </button>
                  </div>
                  
                  {!handsOnResources[topic.id]?.filter(r => r.type === 'activity').length ? (
                    <p style={{ fontSize: '12px', color: '#999', fontStyle: 'italic' }}>
                      No activities yet
                    </p>
                  ) : (
                    handsOnResources[topic.id]
                      .filter(r => r.type === 'activity')
                      .map((activity, idx) => (
                        <div 
                          key={idx}
                          style={{
                            padding: '8px',
                            marginBottom: '6px',
                            backgroundColor: 'white',
                            border: '1px solid #e0e0e0',
                            borderRadius: '4px',
                            fontSize: '12px'
                          }}
                        >
                          <p style={{ margin: '0 0 4px 0', fontWeight: '500' }}>{activity.title}</p>
                          <p style={{ margin: 0, fontSize: '11px', color: '#666' }}>
                            {activity.description}
                          </p>
                        </div>
                      ))
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Topic Details Modal */}
      {isModalOpen && selectedTopic && (
        <TopicDetailsModal
          topic={selectedTopic}
          onClose={handleCloseModal}
        />
      )}

      {/* Break Modal */}
      {showBreakModal && (
        <BreakModal
          onConfirm={handleBreakCreate}
          onCancel={() => setShowBreakModal(false)}
        />
      )}
    </div>
  );
};

export default CourseWorkspace;