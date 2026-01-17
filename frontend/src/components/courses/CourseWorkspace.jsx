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
  
  const { formData, generatedTopics } = location.state || {};
  
  const [courseName, setCourseName] = useState(formData?.courseName || '');
  const [topics, setTopics] = useState(generatedTopics || []);
  const [sections, setSections] = useState([]);
  const [selectedTopicForModal, setSelectedTopicForModal] = useState(null);
  const [showBreakModal, setShowBreakModal] = useState(false);
  const [handsOnResources, setHandsOnResources] = useState({});
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Save to history whenever sections change
  useEffect(() => {
    if (sections.length > 0) {
      saveToHistory();
    }
  }, [sections]);

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

  const handleTopicClick = async (topic) => {
    // Run Phase 2 (Populator) for this topic
    setSelectedTopicForModal({ ...topic, loading: true });
    
    try {
      const response = await fetch('http://localhost:8000/api/populate-topic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicId: topic.id,
          topicTitle: topic.title,
          gradeLevel: formData.class
        })
      });
      
      const populatedData = await response.json();
      setSelectedTopicForModal({ ...topic, ...populatedData, loading: false });
    } catch (error) {
      console.error('Error populating topic:', error);
      alert('Failed to load topic details');
      setSelectedTopicForModal(null);
    }
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
    try {
      const response = await fetch('http://localhost:8000/api/generate-resource', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicId,
          resourceType, // 'worksheet' or 'activity'
          gradeLevel: formData.class
        })
      });
      
      const resource = await response.json();
      
      setHandsOnResources(prev => ({
        ...prev,
        [topicId]: [...(prev[topicId] || []), resource]
      }));
      
      alert(`${resourceType} generated successfully!`);
    } catch (error) {
      console.error('Error generating resource:', error);
      alert('Failed to generate resource');
    }
  };

  const saveCourse = async () => {
    try {
      // Save to Firebase
      const { saveCurriculum } = await import('../../firebase/dbService');
      await saveCurriculum(currentUser.uid, {
        courseName,
        ...formData,
        sections: sections.map(section => ({
          ...section,
          topics: section.topics || []
        })),
        handsOnResources,
        createdAt: new Date().toISOString()
      });
      
      alert('Course saved successfully!');
      navigate('/my-courses');
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

      {/* 3-Column Layout */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* LEFT COLUMN - Course Outline */}
        <div style={{ 
          width: '33%', 
          borderRight: '1px solid #ddd', 
          padding: '20px',
          overflowY: 'auto',
          backgroundColor: '#fafafa'
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

        {/* CENTER COLUMN - Hands-On Resources */}
        <div style={{ 
          width: '34%', 
          borderRight: '1px solid #ddd', 
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
              <p>Add topics to your course outline to generate worksheets and activities here.</p>
            </div>
          ) : (
            topicsInSections.map(topic => (
              <div 
                key={topic.id}
                style={{
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  padding: '15px',
                  marginBottom: '15px',
                  backgroundColor: '#f9f9f9'
                }}
              >
                <h4 style={{ margin: '0 0 10px 0' }}>{topic.title}</h4>
                <p style={{ fontSize: '14px', color: '#666', margin: '0 0 15px 0' }}>
                  {topic.duration} • {topic.plaType}
                </p>
                
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={() => generateResource(topic.id, 'worksheet')}
                    style={{
                      flex: 1,
                      padding: '8px',
                      backgroundColor: '#17a2b8',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    + Worksheet
                  </button>
                  
                  <button
                    onClick={() => generateResource(topic.id, 'activity')}
                    style={{
                      flex: 1,
                      padding: '8px',
                      backgroundColor: '#28a745',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    + Activity
                  </button>
                </div>

                {/* Show generated resources */}
                {handsOnResources[topic.id] && handsOnResources[topic.id].length > 0 && (
                  <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #ddd' }}>
                    <p style={{ fontSize: '12px', fontWeight: '600', color: '#666' }}>Generated:</p>
                    {handsOnResources[topic.id].map((resource, idx) => (
                      <div key={idx} style={{ fontSize: '13px', padding: '5px 0', color: '#333' }}>
                        • {resource.type}: {resource.title}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* RIGHT COLUMN - Topics Library */}
        <div style={{ 
          width: '33%', 
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
                onClick={() => handleTopicClick(topic)}
                onDragStart={handleDragStart}
              />
            ))
          )}
        </div>
      </div>

      {/* Topic Details Modal */}
      {selectedTopicForModal && (
        <TopicDetailsModal
          topic={selectedTopicForModal}
          onClose={() => setSelectedTopicForModal(null)}
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