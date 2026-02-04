import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ArrowLeft } from 'lucide-react';

const CourseDesigner = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ message: '', progress: 0 });
  const [formData, setFormData] = useState({
    courseName: '',
    class: '',
    timeDuration: '',
    timeUnit: 'hours',
    subject: '',
    topic: '',
    numWorksheets: 1,
    numActivities: 1,
    objectives: ''
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setProgress({ message: 'Starting...', progress: 0 });

    try {
      const response = await fetch('http://localhost:8000/api/generate-curriculum', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          course_name: formData.courseName,
          grade_level: formData.class,
          subject: formData.subject,
          topic: formData.topic,
          time_duration: `${formData.timeDuration} ${formData.timeUnit}`,
          num_worksheets: parseInt(formData.numWorksheets),
          num_activities: parseInt(formData.numActivities),
          objectives: formData.objectives,
          teacherUid: currentUser.uid
        })
      });

      // Handle Server-Sent Events stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let curriculumId = null;

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              setProgress({
                message: data.message || '',
                progress: data.progress || 0
              });

              if (data.done && data.curriculum_id) {
                curriculumId = data.curriculum_id;
              }

              if (data.error) {
                throw new Error(data.message || 'Generation failed');
              }
            } catch (err) {
              console.error('Error parsing SSE data:', err);
            }
          }
        }
      }

      // Flush any remaining data left in the buffer after the stream closes.
      // The final SSE event (done + curriculum_id) often lands here unparsed.
      if (buffer.trim().startsWith('data: ')) {
        try {
          const data = JSON.parse(buffer.trim().slice(6));
          setProgress({ message: data.message || '', progress: data.progress || 0 });
          if (data.done && data.curriculum_id) {
            curriculumId = data.curriculum_id;
          }
        } catch (err) {
          console.error('Error parsing final SSE buffer:', err);
        }
      }

      console.log('SSE complete. curriculumId =', curriculumId);

      // Fetch the generated curriculum — now sections with subsections
      let sections = [];

      if (curriculumId) {
        console.log('Fetching curriculum:', curriculumId);

        const curriculumResponse = await fetch(
          `http://localhost:8000/api/curricula/${curriculumId}?teacherUid=${currentUser.uid}`
        );
        const curriculumData = await curriculumResponse.json();

        console.log('Curriculum data received:', curriculumData);

        // outline.sections is the new shape: [{ id, title, description, subsections: [...] }]
        sections = (curriculumData.outline?.sections || []).map(section => ({
          id: section.id,
          title: section.title,
          description: section.description,
          subsections: (section.subsections || []).map(sub => ({
            id: sub.id,
            title: sub.title,
            description: sub.description,
            duration_minutes: sub.duration_minutes,
            pla_pillars: sub.pla_pillars || [],
            learning_objectives: sub.learning_objectives || [],
            content_keywords: sub.content_keywords || [],
            what_must_be_covered: sub.what_must_be_covered || '',
            video_resources: sub.video_resources || [],
            worksheets: sub.worksheets || [],
            activities: sub.activities || []
          }))
        }));

        console.log('Sections built:', sections);
      }

      // Navigate to workspace with the new sections shape
      navigate('/course-workspace', {
        state: {
          formData,
          sections,
          isEditing: true,
          curriculumId
        }
      });

    } catch (error) {
      console.error('Error generating course:', error);
      alert('Failed to generate course outline. Please try again.');
    } finally {
      setLoading(false);
      setProgress({ message: '', progress: 0 });
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px' }}>
    <button
        onClick={() => navigate('/course-designer')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'transparent',
          border: '1px solid #ddd',
          color: '#555',
          padding: '8px 16px',
          borderRadius: '8px',
          cursor: 'pointer',
          fontSize: '14px',
          marginBottom: '20px',
          transition: 'all 0.2s'
        }}
        onMouseEnter={(e) => {
          e.target.style.background = '#f5f5f5';
          e.target.style.borderColor = '#667eea';
          e.target.style.color = '#667eea';
        }}
        onMouseLeave={(e) => {
          e.target.style.background = 'transparent';
          e.target.style.borderColor = '#ddd';
          e.target.style.color = '#555';
        }}
      >
        <ArrowLeft size={16} />
        <span>Back</span>
      </button>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '30px' }}>
        <button
          onClick={() => navigate('/my-courses')}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '24px',
            cursor: 'pointer',
            marginRight: '15px'
          }}
        >
          ←
        </button>
        <div>
          <h1 style={{ margin: 0 }}>📝 Course Designer</h1>
          <p style={{ color: '#666', margin: '5px 0 0 0' }}>
            Welcome, {currentUser?.displayName}
          </p>
        </div>
      </div>

      {loading && (
        <div style={{
          marginBottom: '20px',
          padding: '20px',
          backgroundColor: '#e3f2fd',
          borderRadius: '8px',
          border: '1px solid #2196f3'
        }}>
          <div style={{ marginBottom: '10px', fontWeight: '500' }}>
            {progress.message}
          </div>
          <div style={{
            width: '100%',
            height: '20px',
            backgroundColor: '#fff',
            borderRadius: '10px',
            overflow: 'hidden'
          }}>
            <div style={{
              height: '100%',
              width: `${progress.progress}%`,
              backgroundColor: '#2196f3',
              transition: 'width 0.3s ease'
            }} />
          </div>
          <div style={{ marginTop: '5px', fontSize: '14px', color: '#666' }}>
            {progress.progress}%
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ backgroundColor: '#f9f9f9', padding: '30px', borderRadius: '8px' }}>
        
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
            Course Name
          </label>
          <input
            type="text"
            name="courseName"
            value={formData.courseName}
            onChange={handleChange}
            required
            disabled={loading}
            placeholder="e.g., Introduction to Fractions"
            style={{ width: '100%', padding: '10px', fontSize: '16px', border: '1px solid #ddd', borderRadius: '4px' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
              Class
            </label>
            <select
              name="class"
              value={formData.class}
              onChange={handleChange}
              required
              disabled={loading}
              style={{ width: '100%', padding: '10px', fontSize: '16px', border: '1px solid #ddd', borderRadius: '4px' }}
            >
              <option value="">Select Class</option>
              <option value="Class 1">Class 1</option>
              <option value="Class 2">Class 2</option>
              <option value="Class 3">Class 3</option>
              <option value="Class 4">Class 4</option>
              <option value="Class 5">Class 5</option>
            </select>
          </div>

          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
              Time Duration
            </label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="number"
                name="timeDuration"
                value={formData.timeDuration}
                onChange={handleChange}
                required
                disabled={loading}
                min="1"
                placeholder="e.g., 6"
                style={{ flex: 1, padding: '10px', fontSize: '16px', border: '1px solid #ddd', borderRadius: '4px' }}
              />
              <select
                name="timeUnit"
                value={formData.timeUnit}
                onChange={handleChange}
                disabled={loading}
                style={{ padding: '10px', fontSize: '16px', border: '1px solid #ddd', borderRadius: '4px' }}
              >
                <option value="minutes">minutes</option>
                <option value="hours">hours</option>
                <option value="weeks">weeks</option>
              </select>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
              Subject
            </label>
            <input
              type="text"
              name="subject"
              value={formData.subject}
              onChange={handleChange}
              required
              disabled={loading}
              placeholder="e.g., History"
              style={{ width: '100%', padding: '10px', fontSize: '16px', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>

          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
              Topic
            </label>
            <input
              type="text"
              name="topic"
              value={formData.topic}
              onChange={handleChange}
              required
              disabled={loading}
              placeholder="e.g., MLK and Civil Rights"
              style={{ width: '100%', padding: '10px', fontSize: '16px', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
              # of Worksheets
            </label>
            <input
              type="number"
              name="numWorksheets"
              value={formData.numWorksheets}
              onChange={handleChange}
              required
              disabled={loading}
              min="0"
              max="10"
              style={{ width: '100%', padding: '10px', fontSize: '16px', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>

          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
              # of Activities
            </label>
            <input
              type="number"
              name="numActivities"
              value={formData.numActivities}
              onChange={handleChange}
              required
              disabled={loading}
              min="0"
              max="10"
              style={{ width: '100%', padding: '10px', fontSize: '16px', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>
        </div>

        <div style={{ marginBottom: '30px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
            Objectives/Requirements/Comments
          </label>
          <textarea
            name="objectives"
            value={formData.objectives}
            onChange={handleChange}
            disabled={loading}
            placeholder="Any specific goals or requirements for this course..."
            rows="4"
            style={{ width: '100%', padding: '10px', fontSize: '16px', border: '1px solid #ddd', borderRadius: '4px', resize: 'vertical' }}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '15px',
            backgroundColor: loading ? '#ccc' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '18px',
            fontWeight: '600',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? '⏳ Generating Boxes...' : '✨ Generate Course'}
        </button>
      </form>
    </div>
  );
};

export default CourseDesigner;