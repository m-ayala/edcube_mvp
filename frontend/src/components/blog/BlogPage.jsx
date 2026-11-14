// frontend/src/components/blog/BlogPage.jsx
// Public blog: /blog lists every published post, /blog/:postId shows one. No login needed.
// Posts are written by the admin in Admin → Blog.
import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { listPosts, getPost } from '../../services/blogApi';
import { useAuth } from '../../contexts/AuthContext';
import { PostBody } from './blogText';
import { excerpt, plainText, postDate } from '../../utils/blogFormat';

const SORA = "'Sora', sans-serif";

const BlogPage = () => {
  const { postId } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [state, setState] = useState({ key: null, data: null, error: '' });
  const key = postId || '__list';

  useEffect(() => {
    let live = true;
    (postId ? getPost(postId) : listPosts(50))
      .then((data) => { if (live) setState({ key, data, error: '' }); })
      .catch((e) => { if (live) setState({ key, data: null, error: e.message }); });
    return () => { live = false; };
  }, [postId, key]);

  const loading = state.key !== key;
  const post = postId && !loading ? state.data : null;

  useEffect(() => {
    document.title = post ? `${post.title} — EdCube Blog` : 'Blog — EdCube';
  }, [post]);

  return (
    <div style={{ minHeight: '100vh', background: '#FAF8F4', color: '#1C1917', fontFamily: SORA }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;700&display=swap');`}</style>
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '0.5px solid #E5E0D8', maxWidth: 1100, margin: '0 auto' }}>
        <Link to="/" style={{ fontWeight: 700, fontSize: 20, letterSpacing: '-0.5px', color: '#1C1917', textDecoration: 'none' }}>EdCube</Link>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', fontSize: 14 }}>
          {isAdmin && <Link to="/admin?tab=blog" style={{ color: '#C05A2A', textDecoration: 'none', fontWeight: 700 }}>Write a post</Link>}
          <Link to="/blog" style={{ color: '#6B6459', textDecoration: 'none' }}>All posts</Link>
        </div>
      </nav>

      <main style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px 96px' }}>
        {loading && <p style={{ color: '#6B6459' }}>Loading…</p>}

        {!loading && state.error && (
          <div>
            <p style={{ color: '#6B6459', fontSize: 16 }}>{postId ? 'This post could not be found.' : 'The blog could not be loaded right now.'}</p>
            <button type="button" onClick={() => navigate(postId ? '/blog' : '/')} style={backBtn}>{postId ? '← All posts' : '← Home'}</button>
          </div>
        )}

        {/* One post */}
        {post && (
          <article>
            <Link to="/blog" style={{ color: '#6B6459', fontSize: 14, textDecoration: 'none' }}>← All posts</Link>
            <h1 style={{ fontSize: 40, fontWeight: 700, letterSpacing: '-1px', lineHeight: 1.15, margin: '20px 0 10px' }}>{post.title}</h1>
            {post.summary && (
              <p style={{ fontSize: 21, fontWeight: 300, color: '#6B6459', lineHeight: 1.45, margin: '0 0 18px' }}>{plainText(post.summary)}</p>
            )}
            <div style={{ fontSize: 14, color: '#A89F94', paddingBottom: 24, marginBottom: 32, borderBottom: '0.5px solid #E5E0D8' }}>
              {[post.author_name, postDate(post)].filter(Boolean).join(' · ')}
            </div>
            <PostBody text={post.body} style={{ fontSize: 17.5, lineHeight: 1.8, color: '#33302B', margin: '0 0 22px', fontWeight: 300 }} />
          </article>
        )}

        {/* All posts */}
        {!postId && !loading && !state.error && (
          <>
            <h1 style={{ fontSize: 40, fontWeight: 700, letterSpacing: '-1px', margin: '0 0 32px' }}>Blog</h1>
            {state.data.posts.length === 0 && <p style={{ color: '#6B6459' }}>No posts yet. Check back soon.</p>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {state.data.posts.map((p) => (
                <Link key={p.id} to={`/blog/${p.id}`} style={{ textDecoration: 'none', color: 'inherit', background: '#fff', border: '0.5px solid #E5E0D8', borderRadius: 18, padding: '24px 28px', display: 'block' }}>
                  <div style={{ fontSize: 13, color: '#A89F94', marginBottom: 6 }}>{postDate(p)}</div>
                  <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.4px', margin: '0 0 8px' }}>{p.title}</h2>
                  <p style={{ fontSize: 15, color: '#6B6459', lineHeight: 1.65, margin: 0 }}>{excerpt(p, 260)}</p>
                </Link>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
};

const backBtn = { marginTop: 12, background: 'transparent', border: '0.5px solid #D0CAC0', borderRadius: 100, padding: '10px 20px', fontFamily: SORA, fontSize: 14, cursor: 'pointer' };

export default BlogPage;
