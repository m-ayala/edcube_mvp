import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, Sparkles } from 'lucide-react';
import './CourseDesignerLanding.css';

const CourseDesignerLanding = () => {
  const navigate = useNavigate();

  return (
    <div className="course-designer-landing">
      <button className="back-button" onClick={() => navigate('/dashboard')}>
        <ArrowLeft size={20} />
        <span>Back</span>
      </button>

      <div className="landing-content">
        <h1>How would you like to design your course?</h1>
        <p className="subtitle">Choose an option to get started</p>

        <div className="options-container">
          <div 
            className="option-card upload-card"
            onClick={() => navigate('/course-designer/upload')}
          >
            <div className="icon-wrapper">
              <Upload size={48} />
            </div>
            <h2>Upload Your Material</h2>
            <p>Import your existing course from Google Drive or local files</p>
            <div className="supported-formats">
              <span>Excel</span>
              <span>Word</span>
              <span>Google Sheets</span>
              <span>Google Docs</span>
            </div>
          </div>

          <div 
            className="option-card ai-card"
            onClick={() => navigate('/course-designer/create')}
          >
            <div className="icon-wrapper">
              <Sparkles size={48} />
            </div>
            <h2>Create with EdCube AI</h2>
            <p>Design your course with AI-powered curriculum generation</p>
            <div className="features">
              <span>✓ Curated Resources</span>
              <span>✓ Worksheets & Activities</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CourseDesignerLanding;