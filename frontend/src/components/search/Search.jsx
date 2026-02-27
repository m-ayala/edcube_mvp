// frontend/src/components/search/Search.jsx

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getAllTeachers } from '../../utils/teacherService';

const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const Search = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTeachers = async () => {
      try {
        setLoading(true);
        const all = await getAllTeachers(currentUser);
        // Exclude current user and sort alphabetically
        const filtered = all
          .filter((t) => t.teacher_uid !== currentUser?.uid)
          .sort((a, b) => a.display_name.localeCompare(b.display_name));
        setTeachers(filtered);
      } catch (err) {
        console.error('Error fetching teachers:', err);
        setError('Failed to load teachers');
      } finally {
        setLoading(false);
      }
    };

    if (currentUser) fetchTeachers();
  }, [currentUser]);

  const results = query.trim()
    ? teachers.filter((t) =>
        t.display_name.toLowerCase().includes(query.trim().toLowerCase())
      )
    : [];

  return (
    <div style={{ padding: '32px 40px', maxWidth: '720px', margin: '0 auto' }}>
      {/* Search bar */}
      <div style={{ position: 'relative' }}>
        <span style={{
          position: 'absolute',
          left: '16px',
          top: '50%',
          transform: 'translateY(-50%)',
          fontSize: '18px',
          color: '#8b7355',
          pointerEvents: 'none',
        }}>
          🔍
        </span>
        <input
          type="text"
          placeholder="Search teachers..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '14px 16px 14px 44px',
            fontSize: '16px',
            border: '1px solid #d4c4a8',
            borderRadius: '12px',
            backgroundColor: '#fffdf7',
            color: '#2c3e50',
            outline: 'none',
            boxSizing: 'border-box',
            transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
          }}
          onFocus={(e) => {
            e.target.style.borderColor = '#8b7355';
            e.target.style.boxShadow = '0 0 0 3px rgba(139, 115, 85, 0.1)';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = '#d4c4a8';
            e.target.style.boxShadow = 'none';
          }}
        />
      </div>

      {/* Results area */}
      <div style={{ marginTop: '24px' }}>
        {loading && (
          <p style={{ textAlign: 'center', color: '#8b7355', fontSize: '15px' }}>
            Loading teachers...
          </p>
        )}

        {error && (
          <p style={{ textAlign: 'center', color: '#d32f2f', fontSize: '15px' }}>
            {error}
          </p>
        )}

        {!loading && !error && query.trim() && results.length === 0 && (
          <p style={{ textAlign: 'center', color: '#8b7355', fontSize: '15px' }}>
            No teachers found matching "{query.trim()}"
          </p>
        )}

        {results.map((teacher) => (
          <div
            key={teacher.teacher_uid}
            onClick={() => navigate(`/profile/${teacher.teacher_uid}`)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              padding: '12px 16px',
              marginBottom: '8px',
              borderRadius: '10px',
              backgroundColor: '#fffdf7',
              border: '1px solid #e8dcc8',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f5f5dc';
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#fffdf7';
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            {/* Avatar */}
            {teacher.profile_picture_url ? (
              <img
                src={teacher.profile_picture_url}
                alt={teacher.display_name}
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  flexShrink: 0,
                }}
              />
            ) : (
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: '#8b7355',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: '600',
                fontSize: '15px',
                flexShrink: 0,
              }}>
                {getInitials(teacher.display_name)}
              </div>
            )}

            {/* Name */}
            <span style={{
              fontSize: '15px',
              fontWeight: '500',
              color: '#2c3e50',
            }}>
              {teacher.display_name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Search;
