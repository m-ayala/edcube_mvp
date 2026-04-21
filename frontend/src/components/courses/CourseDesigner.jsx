import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Paperclip, X, FileText, FileSpreadsheet, Image, Presentation } from 'lucide-react';
import { getOwnProfile } from '../../services/teacherService';

// Map file extension → icon + label
const FILE_TYPE_META = {
  pdf:  { icon: FileText,        color: '#e53e3e', label: 'PDF' },
  doc:  { icon: FileText,        color: '#2b6cb0', label: 'Word' },
  docx: { icon: FileText,        color: '#2b6cb0', label: 'Word' },
  xls:  { icon: FileSpreadsheet, color: '#276749', label: 'Excel' },
  xlsx: { icon: FileSpreadsheet, color: '#276749', label: 'Excel' },
  ppt:  { icon: Presentation,    color: '#c05621', label: 'PPT' },
  pptx: { icon: Presentation,    color: '#c05621', label: 'PPT' },
  jpg:  { icon: Image,           color: '#805ad5', label: 'Image' },
  jpeg: { icon: Image,           color: '#805ad5', label: 'Image' },
  png:  { icon: Image,           color: '#805ad5', label: 'Image' },
  gif:  { icon: Image,           color: '#805ad5', label: 'Image' },
  webp: { icon: Image,           color: '#805ad5', label: 'Image' },
};

const ACCEPTED_EXTENSIONS = Object.keys(FILE_TYPE_META);
const ACCEPT_ATTR = ACCEPTED_EXTENSIONS.map(e => `.${e}`).join(',');
const MAX_FILES = 5;

const getExt = (filename) => filename.split('.').pop().toLowerCase();

const CourseDesigner = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ message: '', progress: 0 });
  const [organizationId, setOrganizationId] = useState(null);
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);
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

  useEffect(() => {
    const fetchProfile = async () => {
      if (currentUser) {
        try {
          const profile = await getOwnProfile(currentUser);
          setOrganizationId(profile.org_id);
        } catch (error) {
          console.error('Error fetching teacher profile:', error);
          alert('Failed to load your profile. Please refresh the page.');
        }
      }
    };
    fetchProfile();
  }, [currentUser]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const addFiles = (fileList) => {
    const remaining = MAX_FILES - attachedFiles.length;
    const incoming = Array.from(fileList)
      .filter(f => ACCEPTED_EXTENSIONS.includes(getExt(f.name)))
      .slice(0, remaining);

    // Build preview URLs for images
    const newEntries = incoming.map(file => {
      const ext = getExt(file.name);
      const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
      return {
        file,
        name: file.name,
        ext,
        preview: isImage ? URL.createObjectURL(file) : null,
      };
    });
    setAttachedFiles(prev => [...prev, ...newEntries]);
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  };

  const handleFileSelect = (e) => {
    addFiles(e.target.files);
    e.target.value = '';
  };

  const removeFile = (index) => {
    setAttachedFiles(prev => {
      const copy = [...prev];
      if (copy[index].preview) URL.revokeObjectURL(copy[index].preview);
      copy.splice(index, 1);
      return copy;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!organizationId) {
      alert('Unable to generate course: Organization ID not found. Please refresh the page and try again.');
      return;
    }

    setLoading(true);
    setProgress({ message: 'Starting...', progress: 0 });

    try {
      // Build multipart/form-data so we can send files alongside form fields
      const body = new FormData();
      body.append('course_name',    formData.courseName);
      body.append('grade_level',    formData.class);
      body.append('subject',        formData.subject);
      body.append('topic',          formData.topic);
      body.append('time_duration',  `${formData.timeDuration} ${formData.timeUnit}`);
      body.append('num_worksheets', String(parseInt(formData.numWorksheets)));
      body.append('num_activities', String(parseInt(formData.numActivities)));
      body.append('objectives',     formData.objectives || '');
      body.append('teacherUid',     currentUser.uid);
      body.append('organizationId', organizationId);
      attachedFiles.forEach(({ file }) => body.append('files', file));

      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/generate-curriculum`,
        { method: 'POST', body }
      );

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
              setProgress({ message: data.message || '', progress: data.progress || 0 });
              if (data.done && data.curriculum_id) curriculumId = data.curriculum_id;
              if (data.error) throw new Error(data.message || 'Generation failed');
            } catch (err) {
              console.error('Error parsing SSE data:', err);
            }
          }
        }
      }

      // Flush remaining buffer
      if (buffer.trim().startsWith('data: ')) {
        try {
          const data = JSON.parse(buffer.trim().slice(6));
          setProgress({ message: data.message || '', progress: data.progress || 0 });
          if (data.done && data.curriculum_id) curriculumId = data.curriculum_id;
        } catch (err) {
          console.error('Error parsing final SSE buffer:', err);
        }
      }

      console.log('SSE complete. curriculumId =', curriculumId);

      let sections = [];
      if (curriculumId) {
        const curriculumResponse = await fetch(
          `${import.meta.env.VITE_API_BASE_URL}/api/curricula/${curriculumId}?teacherUid=${currentUser.uid}`
        );
        const curriculumData = await curriculumResponse.json();

        sections = (curriculumData.outline?.sections || []).map(section => ({
          id: section.id,
          title: section.title,
          description: section.description,
          subsections: (section.subsections || []).map(sub => ({
            id: sub.id,
            title: sub.title,
            description: sub.description,
            topicBoxes: [{
              id: `topic-${sub.id}-initial`,
              title: sub.title,
              description: sub.description || '',
              duration_minutes: sub.duration_minutes || 20,
              pla_pillars: sub.pla_pillars || [],
              learning_objectives: sub.learning_objectives || [],
              content_keywords: sub.content_keywords || [],
              video_resources: sub.video_resources || [],
              worksheets: sub.worksheets || [],
              activities: sub.activities || []
            }]
          }))
        }));
      }

      navigate('/course-workspace', {
        state: { formData, sections, isEditing: true, curriculumId }
      });

    } catch (error) {
      console.error('Error generating course:', error);
      alert('Failed to generate course outline. Please try again.');
    } finally {
      setLoading(false);
      setProgress({ message: '', progress: 0 });
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    fontSize: '15px',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    background: '#fff',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const labelStyle = {
    display: 'block',
    marginBottom: '6px',
    fontWeight: '600',
    fontSize: '14px',
    color: '#2d3748',
  };

  return (
    <div style={{ maxWidth: '760px', margin: '0 auto', padding: '36px 20px 60px' }}>

      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: '26px', fontWeight: '700', color: '#1a202c' }}>
          ✨ EdCube AI Course Designer
        </h1>
        <p style={{ margin: 0, color: '#718096', fontSize: '15px' }}>
          Fill in your course details — attach any materials you already have and the AI will use everything to build your course.
        </p>
      </div>

      {/* Progress bar */}
      {loading && (
        <div style={{
          marginBottom: '24px',
          padding: '16px 20px',
          backgroundColor: '#ebf8ff',
          borderRadius: '10px',
          border: '1px solid #90cdf4'
        }}>
          <div style={{ marginBottom: '8px', fontWeight: '500', color: '#2b6cb0', fontSize: '14px' }}>
            {progress.message}
          </div>
          <div style={{ width: '100%', height: '8px', backgroundColor: '#bee3f8', borderRadius: '999px', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${progress.progress}%`,
              backgroundColor: '#3182ce',
              borderRadius: '999px',
              transition: 'width 0.3s ease'
            }} />
          </div>
          <div style={{ marginTop: '4px', fontSize: '13px', color: '#4a90d9' }}>{progress.progress}%</div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '28px',
          marginBottom: '16px'
        }}>
          <h2 style={{ margin: '0 0 20px', fontSize: '16px', fontWeight: '700', color: '#2d3748' }}>Course Details</h2>

          {/* Course Name */}
          <div style={{ marginBottom: '18px' }}>
            <label style={labelStyle}>Course Name</label>
            <input
              type="text"
              name="courseName"
              value={formData.courseName}
              onChange={handleChange}
              required
              disabled={loading}
              placeholder="e.g., Introduction to Fractions"
              style={inputStyle}
            />
          </div>

          {/* Class + Duration */}
          <div style={{ display: 'flex', gap: '16px', marginBottom: '18px' }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Class / Grade</label>
              <select
                name="class"
                value={formData.class}
                onChange={handleChange}
                required
                disabled={loading}
                style={inputStyle}
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
              <label style={labelStyle}>Time Duration</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="number"
                  name="timeDuration"
                  value={formData.timeDuration}
                  onChange={handleChange}
                  required
                  disabled={loading}
                  min="1"
                  placeholder="e.g., 6"
                  style={{ ...inputStyle, flex: 1 }}
                />
                <select
                  name="timeUnit"
                  value={formData.timeUnit}
                  onChange={handleChange}
                  disabled={loading}
                  style={{ ...inputStyle, width: 'auto', paddingRight: '28px' }}
                >
                  <option value="minutes">minutes</option>
                  <option value="hours">hours</option>
                  <option value="weeks">weeks</option>
                </select>
              </div>
            </div>
          </div>

          {/* Subject + Topic */}
          <div style={{ display: 'flex', gap: '16px', marginBottom: '18px' }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Subject</label>
              <input
                type="text"
                name="subject"
                value={formData.subject}
                onChange={handleChange}
                required
                disabled={loading}
                placeholder="e.g., Science"
                style={inputStyle}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Topic</label>
              <input
                type="text"
                name="topic"
                value={formData.topic}
                onChange={handleChange}
                required
                disabled={loading}
                placeholder="e.g., The Water Cycle"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Worksheets + Activities */}
          <div style={{ display: 'flex', gap: '16px', marginBottom: '18px' }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}># of Worksheets</label>
              <input
                type="number"
                name="numWorksheets"
                value={formData.numWorksheets}
                onChange={handleChange}
                required
                disabled={loading}
                min="0"
                max="10"
                style={inputStyle}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}># of Activities</label>
              <input
                type="number"
                name="numActivities"
                value={formData.numActivities}
                onChange={handleChange}
                required
                disabled={loading}
                min="0"
                max="10"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Objectives */}
          <div>
            <label style={labelStyle}>Objectives / Requirements / Notes</label>
            <textarea
              name="objectives"
              value={formData.objectives}
              onChange={handleChange}
              disabled={loading}
              placeholder="Any specific goals, standards, or notes for this course..."
              rows={4}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: '1.5' }}
            />
          </div>
        </div>

        {/* Attach Materials */}
        <div style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '28px',
          marginBottom: '24px'
        }}>
          <h2 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: '700', color: '#2d3748' }}>
            Attach Your Materials
            <span style={{ fontWeight: '400', color: '#a0aec0', fontSize: '13px', marginLeft: '8px' }}>optional</span>
          </h2>
          <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#718096' }}>
            Syllabi, lesson plans, worksheets, notes — the AI will read everything and use it to shape your course.
          </p>

          {/* Drop zone */}
          {attachedFiles.length < MAX_FILES && (
            <div
              onClick={() => !loading && fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); if (!loading) setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleFileDrop}
              style={{
                border: `2px dashed ${dragOver ? '#667eea' : '#cbd5e0'}`,
                borderRadius: '10px',
                padding: '28px 20px',
                textAlign: 'center',
                cursor: loading ? 'not-allowed' : 'pointer',
                background: dragOver ? '#f0f0ff' : '#f7fafc',
                transition: 'all 0.18s',
                marginBottom: attachedFiles.length > 0 ? '16px' : '0',
              }}
            >
              <Paperclip size={22} style={{ color: '#a0aec0', marginBottom: '8px' }} />
              <p style={{ margin: '0 0 4px', color: '#4a5568', fontSize: '14px', fontWeight: '500' }}>
                Drag & drop files here, or <span style={{ color: '#667eea' }}>browse</span>
              </p>
              <p style={{ margin: 0, color: '#a0aec0', fontSize: '12px' }}>
                PDF, Word, Excel, PowerPoint, Images · up to {MAX_FILES - attachedFiles.length} more file{MAX_FILES - attachedFiles.length !== 1 ? 's' : ''}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT_ATTR}
                multiple
                style={{ display: 'none' }}
                onChange={handleFileSelect}
                disabled={loading}
              />
            </div>
          )}

          {/* Attached file list */}
          {attachedFiles.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {attachedFiles.map((f, idx) => {
                const meta = FILE_TYPE_META[f.ext] || FILE_TYPE_META['pdf'];
                const Icon = meta.icon;
                return (
                  <div key={idx} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 14px',
                    background: '#f7fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                  }}>
                    {f.preview ? (
                      <img
                        src={f.preview}
                        alt={f.name}
                        style={{ width: '36px', height: '36px', objectFit: 'cover', borderRadius: '4px', flexShrink: 0 }}
                      />
                    ) : (
                      <div style={{
                        width: '36px', height: '36px', borderRadius: '6px',
                        background: `${meta.color}18`, display: 'flex',
                        alignItems: 'center', justifyContent: 'center', flexShrink: 0
                      }}>
                        <Icon size={18} color={meta.color} />
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: '13px', fontWeight: '500', color: '#2d3748', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {f.name}
                      </p>
                      <p style={{ margin: 0, fontSize: '11px', color: '#a0aec0' }}>{meta.label}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(idx)}
                      disabled={loading}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        padding: '4px', borderRadius: '4px', color: '#a0aec0',
                        display: 'flex', alignItems: 'center'
                      }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '14px',
            background: loading ? '#a0aec0' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            fontSize: '16px',
            fontWeight: '700',
            cursor: loading ? 'not-allowed' : 'pointer',
            letterSpacing: '0.3px',
          }}
        >
          {loading ? '⏳ Generating Course...' : '✨ Generate Course with AI'}
        </button>
      </form>
    </div>
  );
};

export default CourseDesigner;
