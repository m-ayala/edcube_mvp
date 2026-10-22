// frontend/src/components/share/PublicSharePage.jsx
// /share/:token -- a read-only view of a course from a view-only link. No account, no app layout:
// it calls GET /api/share/{token} without a token and renders the outline with the existing read-only
// CourseViewer (plain data in, no auth calls). No edit, AI or Edo controls exist on this page.
import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import CourseViewer from '../courses/CourseViewer';
import { getPublicShare } from '../../services/sharingApi';
import { courseViewState } from '../../utils/courseNav';

const SANS = "'DM Sans', sans-serif";

const Message = ({ title, children }) => (
  <div style={{
    minHeight: '100vh', background: '#FAF8F4', display: 'flex', alignItems: 'center',
    justifyContent: 'center', flexDirection: 'column', gap: 14, fontFamily: SANS, padding: 24, textAlign: 'center',
  }}>
    <div style={{ fontWeight: 800, fontSize: 20, color: '#1C1917', letterSpacing: '-0.5px' }}>EdCube</div>
    <p role="alert" style={{ fontSize: 18, color: '#374151', margin: 0 }}>{title}</p>
    {children}
  </div>
);

// Blocks per subsection, from the three typed arrays the read-only viewer reads.
const blocksBySubsection = (sections) => {
  const out = {};
  sections.forEach((section) => (section.subsections || []).forEach((sub) => {
    const blocks = [
      ...(sub.content_blocks || []).map((b) => ({ ...b, type: 'content' })),
      ...(sub.worksheets || []).map((b) => ({ ...b, type: 'worksheet' })),
      ...(sub.activities || []).map((b) => ({ ...b, type: 'activity' })),
    ];
    if (blocks.length > 0) out[sub.id] = blocks;
  }));
  return out;
};

const PublicSharePage = () => {
  const { token } = useParams();
  const [state, setState] = useState({ status: 'loading' }); // loading | ok | unavailable | rate_limited | error

  useEffect(() => {
    let cancelled = false;
    getPublicShare(token)
      .then((data) => { if (!cancelled) setState({ status: 'ok', data }); })
      .catch((err) => {
        if (cancelled) return;
        if (err.status === 404) setState({ status: 'unavailable' });
        else if (err.status === 429) setState({ status: 'rate_limited' });
        else setState({ status: 'error' });
      });
    return () => { cancelled = true; };
  }, [token]);

  // A shared link is not for search engines.
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => { document.head.removeChild(meta); };
  }, []);

  const view = useMemo(() => {
    if (state.status !== 'ok') return null;
    const { course = {}, title, owner_display_name: owner } = state.data || {};
    const nav = courseViewState(course, { courseId: token });
    return { name: title || course.courseName || 'Course', owner, sections: nav.sections, blocks: blocksBySubsection(nav.sections) };
  }, [state, token]);

  if (state.status === 'loading') return <Message title="Loading course…" />;
  if (state.status === 'unavailable') {
    return (
      <Message title="This link is no longer available.">
        <Link to="/signup" style={{ color: '#3E62BC', fontWeight: 600 }}>Create your own courses free on EdCube</Link>
      </Message>
    );
  }
  if (state.status === 'rate_limited') return <Message title="Too many requests, try again shortly." />;
  if (state.status === 'error') return <Message title="Something went wrong loading this course. Please try again." />;

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: SANS }}>
      <CourseViewer
        courseName={view.name}
        sections={view.sections}
        handsOnResources={view.blocks}
        ownerName={view.owner}
        isOwner={false}
        isCollaborator={false}
        hideBack
        navigate={() => {}}
      />
      <div style={{
        flexShrink: 0, padding: '10px 28px', background: '#fff', borderTop: '1px solid #E7E5E4',
        textAlign: 'center', fontSize: 14,
      }}>
        <Link to="/signup" style={{ color: '#3E62BC', fontWeight: 600, textDecoration: 'none' }}>
          Create your own courses free on EdCube
        </Link>
      </div>
    </div>
  );
};

export default PublicSharePage;
