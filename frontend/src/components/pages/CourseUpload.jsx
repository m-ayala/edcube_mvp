import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const CourseUpload = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [selectedFile, setSelectedFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = () => {
    // We'll implement this later
    alert('Upload functionality coming soon!');
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '2rem' }}>
      
      <button
        onClick={() => navigate('/course-designer')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(255, 255, 255, 0.2)',
          border: 'none',
          color: 'white',
          padding: '10px 20px',
          borderRadius: '8px',
          cursor: 'pointer',
          fontSize: '14px',
          marginBottom: '2rem'
        }}
      >
        <span>← Back</span>
      </button>

      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <h1 style={{ color: 'white', fontSize: '2.5rem', marginBottom: '1rem', textAlign: 'center' }}>
          Upload Your Course Material
        </h1>
        <p style={{ color: 'rgba(255, 255, 255, 0.9)', textAlign: 'center', marginBottom: '3rem', fontSize: '1.1rem' }}>
          Import your existing curriculum from files or Google Drive
        </p>

        <div style={{ background: 'white', borderRadius: '16px', padding: '3rem', boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)' }}>
          
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            style={{
              border: dragActive ? '3px dashed #667eea' : '3px dashed #ddd',
              borderRadius: '12px',
              padding: '4rem 2rem',
              textAlign: 'center',
              background: dragActive ? '#f0f4ff' : '#fafafa',
              transition: 'all 0.3s',
              marginBottom: '2rem'
            }}
          >
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📤</div>
            
            <p style={{ fontSize: '1.2rem', color: '#333', marginBottom: '0.5rem', fontWeight: '500' }}>
              Drag & drop your files here
            </p>
            <p style={{ color: '#666', marginBottom: '1.5rem' }}>or</p>
            
            <input
              type="file"
              id="file-upload"
              onChange={handleFileChange}
              accept=".xlsx,.xls,.docx,.doc"
              style={{ display: 'none' }}
            />
            
            <label
              htmlFor="file-upload"
              style={{
                display: 'inline-block',
                padding: '12px 24px',
                background: '#667eea',
                color: 'white',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
                transition: 'background 0.3s'
              }}
            >
              Browse Files
            </label>

            {selectedFile && (
              <div style={{ marginTop: '2rem', padding: '1rem', background: '#e8f5e9', borderRadius: '8px' }}>
                <p style={{ margin: 0, color: '#2e7d32', fontWeight: '500' }}>
                  ✓ Selected: {selectedFile.name}
                </p>
              </div>
            )}
          </div>

          <div style={{ marginBottom: '2rem' }}>
            <p style={{ textAlign: 'center', color: '#666', marginBottom: '1rem', fontSize: '0.9rem' }}>
              Supported formats:
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <span style={{ background: '#f0f0f0', padding: '6px 12px', borderRadius: '20px', fontSize: '0.85rem' }}>
                📊 Excel (.xlsx, .xls)
              </span>
              <span style={{ background: '#f0f0f0', padding: '6px 12px', borderRadius: '20px', fontSize: '0.85rem' }}>
                📝 Word (.docx, .doc)
              </span>
              <span style={{ background: '#f0f0f0', padding: '6px 12px', borderRadius: '20px', fontSize: '0.85rem' }}>
                📄 Google Sheets
              </span>
              <span style={{ background: '#f0f0f0', padding: '6px 12px', borderRadius: '20px', fontSize: '0.85rem' }}>
                📄 Google Docs
              </span>
            </div>
          </div>

          <button
            onClick={handleUpload}
            disabled={!selectedFile}
            style={{
              width: '100%',
              padding: '15px',
              background: selectedFile ? '#667eea' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1.1rem',
              fontWeight: '600',
              cursor: selectedFile ? 'pointer' : 'not-allowed',
              transition: 'background 0.3s'
            }}
          >
            {selectedFile ? 'Upload & Create Course Workspace' : 'Select a file to continue'}
          </button>

          <div style={{ marginTop: '2rem', textAlign: 'center', color: '#999', fontSize: '0.85rem' }}>
            <p style={{ margin: 0 }}>Google Drive integration coming soon</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CourseUpload;