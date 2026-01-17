// src/components/courses/CourseDesigner.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const CourseDesigner = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    courseName: '',
    class: '',
    timeDuration: '',
    timeUnit: 'minutes',
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
            teacher_id: currentUser.uid
        })
        });

        const result = await response.json();
        
        navigate('/course-workspace', {
        state: {
            formData,
            generatedTopics: result.outline?.sections || []
        }
        });
    } catch (error) {
        console.error('Error generating course:', error);
        alert('Failed to generate course outline. Please try again.');
    } finally {
        setLoading(false);
    }
    };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px' }}>
      {/* Header */}
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

      {/* Form */}
      <form onSubmit={handleSubmit} style={{ backgroundColor: '#f9f9f9', padding: '30px', borderRadius: '8px' }}>
        
        {/* Course Name */}
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
            placeholder="e.g., Introduction to Fractions"
            style={{ width: '100%', padding: '10px', fontSize: '16px', border: '1px solid #ddd', borderRadius: '4px' }}
          />
        </div>

        {/* Class & Time Duration Row */}
        <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
          {/* Class */}
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
              Class
            </label>
            <select
              name="class"
              value={formData.class}
              onChange={handleChange}
              required
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

          {/* Time Duration */}
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
                min="1"
                placeholder="e.g., 2"
                style={{ flex: 1, padding: '10px', fontSize: '16px', border: '1px solid #ddd', borderRadius: '4px' }}
              />
              <select
                name="timeUnit"
                value={formData.timeUnit}
                onChange={handleChange}
                style={{ padding: '10px', fontSize: '16px', border: '1px solid #ddd', borderRadius: '4px' }}
              >
                <option value="minutes">minutes</option>
                <option value="hours">hours</option>
                <option value="weeks">weeks</option>
              </select>
            </div>
          </div>
        </div>

        {/* Subject & Topic Row */}
        <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
          {/* Subject */}
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
              placeholder="e.g., Math"
              style={{ width: '100%', padding: '10px', fontSize: '16px', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>

          {/* Topic */}
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
              placeholder="e.g., Fractions"
              style={{ width: '100%', padding: '10px', fontSize: '16px', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>
        </div>

        {/* # of Worksheets & Activities */}
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
              min="0"
              max="10"
              style={{ width: '100%', padding: '10px', fontSize: '16px', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>
        </div>

        {/* Objectives */}
        <div style={{ marginBottom: '30px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
            Objectives/Requirements/Comments
          </label>
          <textarea
            name="objectives"
            value={formData.objectives}
            onChange={handleChange}
            placeholder="Any specific goals or requirements for this course..."
            rows="4"
            style={{ width: '100%', padding: '10px', fontSize: '16px', border: '1px solid #ddd', borderRadius: '4px', resize: 'vertical' }}
          />
        </div>

        {/* Submit Button */}
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
          {loading ? '⏳ Generating Course...' : '✨ Generate Course'}
        </button>
      </form>
    </div>
  );
};

export default CourseDesigner;