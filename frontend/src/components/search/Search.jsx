// frontend/src/components/search/Search.jsx

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getAllTeachers, searchTeachers } from '../../utils/teacherService';

const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const PAGE_SIZE = 20;
const DEBOUNCE_MS = 300;

const Search = () => {
  const { currentUser, isPublicUser } = useAuth();
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Public users: server-side search (debounced prefix `q`, cursor paging).
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [nextCursor, setNextCursor] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (!isPublicUser) return undefined;
    const t = setTimeout(() => setDebouncedQuery(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query, isPublicUser]);

  useEffect(() => {
    if (!isPublicUser || !currentUser) return undefined;
    let cancelled = false;
    setLoading(true);
    setError(null);
    searchTeachers(currentUser, { q: debouncedQuery, limit: PAGE_SIZE })
      .then((page) => {
        if (cancelled) return;
        setTeachers(page.teachers);
        setNextCursor(page.next_cursor);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Error fetching teachers:', err);
        setTeachers([]);
        setNextCursor(null);
        setError('Failed to load teachers');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [isPublicUser, currentUser, debouncedQuery]);

  const handleLoadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await searchTeachers(currentUser, { q: debouncedQuery, limit: PAGE_SIZE, cursor: nextCursor });
      setTeachers((prev) => {
        const seen = new Set(prev.map((t) => t.teacher_uid));
        return [...prev, ...page.teachers.filter((t) => !seen.has(t.teacher_uid))];
      });
      setNextCursor(page.next_cursor);
    } catch (err) {
      console.error('Error loading more teachers:', err);
      setError('Failed to load more teachers');
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (isPublicUser) return;
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
  }, [currentUser, isPublicUser]);

  const results = isPublicUser
    ? teachers
    : query.trim()
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
          fontSize: '19.8px',
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
            fontSize: '17.6px',
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
          <p style={{ textAlign: 'center', color: '#8b7355', fontSize: '16.5px' }}>
            Loading teachers...
          </p>
        )}

        {error && (
          <p style={{ textAlign: 'center', color: '#d32f2f', fontSize: '16.5px' }}>
            {error}
          </p>
        )}

        {isPublicUser && !loading && !error && results.length === 0 && (
          <p style={{ textAlign: 'center', color: '#8b7355', fontSize: '16.5px' }}>
            {debouncedQuery
              ? `No teachers match '${debouncedQuery}'`
              : 'No teachers have published courses yet'}
          </p>
        )}

        {!isPublicUser && !loading && !error && query.trim() && results.length === 0 && (
          <p style={{ textAlign: 'center', color: '#8b7355', fontSize: '16.5px' }}>
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
                fontSize: '16.5px',
                flexShrink: 0,
              }}>
                {getInitials(teacher.display_name)}
              </div>
            )}

            {/* Name */}
            <span style={{
              fontSize: '16.5px',
              fontWeight: '500',
              color: '#2c3e50',
            }}>
              {teacher.display_name}
            </span>
          </div>
        ))}

        {isPublicUser && !error && nextCursor && (
          <div style={{ textAlign: 'center', marginTop: '12px' }}>
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              style={{
                padding: '10px 24px',
                borderRadius: '10px',
                border: '1px solid #d4c4a8',
                backgroundColor: '#fffdf7',
                color: '#8b7355',
                fontSize: '15.4px',
                fontWeight: '600',
                cursor: loadingMore ? 'default' : 'pointer',
              }}
            >
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Search;
