// frontend/src/components/pages/LandingPage.jsx

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const LandingPage = () => {
  const navigate = useNavigate();

  useEffect(() => { document.title = 'EdCube — A Studio for Educators'; }, []);

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: '#FAF8F4', color: '#1C1917', overflow: 'hidden' }}>

      {/* Google Fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=DM+Sans:wght@400;500&display=swap');

        .lp-nav-link { font-size: 15.4px; color: #6B6459; text-decoration: none; font-weight: 500; }
        .lp-nav-link:hover { color: #1C1917; }

        .lp-blob { position: absolute; border-radius: 50%; filter: blur(60px); opacity: 0.45; }
        .blob-pink  { width: 320px; height: 320px; background: #F9C0C8; top: -80px; left: -60px; }
        .blob-blue  { width: 280px; height: 280px; background: #A8CCEF; top: -40px; right: -40px; }
        .blob-yellow{ width: 240px; height: 240px; background: #F9E0A0; bottom: -60px; left: 10%; }
        .blob-green { width: 260px; height: 260px; background: #A8D8B0; bottom: -40px; right: 8%; }

        .feature-row { display: grid; grid-template-columns: 1fr 1fr; gap: 64px; align-items: center; max-width: 1100px; margin: 0 auto; }

        .feat-tag { display: inline-block; font-size: 12.1px; font-weight: 600; letter-spacing: 0.07em; text-transform: uppercase; padding: 4px 10px; border-radius: 100px; margin-bottom: 16px; }
        .tag-orange { background: #FDEEE6; color: #C05A2A; }
        .tag-blue   { background: #E4EFF9; color: #1E5F99; }
        .tag-green  { background: #E5F4E9; color: #2E7A43; }
        .tag-yellow { background: #FDF5DC; color: #8A6B00; }

        .feat-check { width: 16px; height: 16px; border-radius: 50%; background: #1C1917; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .feat-check::after { content: ''; width: 5px; height: 3px; border-left: 1.5px solid #FAF8F4; border-bottom: 1.5px solid #FAF8F4; transform: rotate(-45deg) translateY(-1px); }

        .play-icon { width: 20px; height: 20px; border-radius: 50%; background: #1C1917; display: flex; align-items: center; justify-content: center; }
        .play-icon::after { content: ''; border-style: solid; border-width: 4px 0 4px 7px; border-color: transparent transparent transparent #fff; margin-left: 2px; }

        .pla-pill { font-size: 11px; padding: 2px 7px; border-radius: 100px; font-weight: 500; }
        .pill-pk { background: #FDEEE6; color: #C05A2A; }
        .pill-cl { background: #E4EFF9; color: #1E5F99; }
        .pill-ct { background: #E5F4E9; color: #2E7A43; }
        .pill-ai { background: #FDF5DC; color: #8A6B00; }

        .comment-bubble { background: #F5F1EC; border-radius: 12px 12px 12px 0; padding: 10px 12px; margin-bottom: 8px; max-width: 85%; }
        .comment-bubble.right { background: #1C1917; color: #FAF8F4; border-radius: 12px 12px 0 12px; margin-left: auto; }
        .comment-bubble p { font-size: 13.2px; line-height: 1.5; margin: 0; }
        .comment-bubble span { font-size: 11px; opacity: 0.6; display: block; margin-top: 3px; }

        .ai-chip { display: inline-flex; align-items: center; gap: 5px; background: #1C1917; color: #FAF8F4; font-size: 12.1px; padding: 4px 10px; border-radius: 100px; margin: 3px; }

        .cta-blob-l { position: absolute; width: 300px; height: 300px; background: #E8845A; border-radius: 50%; filter: blur(80px); opacity: 0.25; top: -80px; left: -60px; }
        .cta-blob-r { position: absolute; width: 280px; height: 280px; background: #7BAFD4; border-radius: 50%; filter: blur(80px); opacity: 0.2; bottom: -60px; right: -40px; }

        .cta-get-started-btn { background: #FAF8F4 !important; color: #1C1917 !important; }
        .cta-get-started-btn:hover { background: #FAF8F4 !important; color: #1C1917 !important; }
      `}</style>

      {/* NAV */}
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '18px 48px', background: '#FAF8F4',
        borderBottom: '0.5px solid #E5E0D8', position: 'sticky', top: 0, zIndex: 10
      }}>
        <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: 20, color: '#1C1917', letterSpacing: '-0.5px' }}>
          EdCube
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            onClick={() => navigate('/login')}
            style={{ background: 'transparent', color: '#1C1917', padding: '10px 20px', borderRadius: 100, fontSize: 14, fontWeight: 500, border: '0.5px solid #D0CAC0', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
          >
            Log in
          </button>
          <button
            onClick={() => navigate('/contact')}
            style={{ background: 'transparent', color: '#1C1917', padding: '10px 20px', borderRadius: 100, fontSize: 14, fontWeight: 500, border: '0.5px solid #D0CAC0', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
          >
            Request a demo
          </button>
          <button
            onClick={() => navigate('/signup')}
            style={{ background: '#1C1917', color: '#FAF8F4', padding: '10px 22px', borderRadius: 100, fontSize: 14, fontWeight: 500, border: 'none', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
          >
            Sign up free
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section style={{
        position: 'relative', padding: '0 48px 100px', textAlign: 'center',
        overflow: 'hidden', minHeight: 'calc(100vh - 57px)', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 0
      }}>
        <div className="lp-blob blob-pink" />
        <div className="lp-blob blob-blue" />
        <div className="lp-blob blob-yellow" />
        <div className="lp-blob blob-green" />

        <img
          src="/edcube-logo.png"
          alt="EdCube"
          style={{ width: 132, height: 132, objectFit: 'contain', marginBottom: 52, position: 'relative' }}
        />

        <h1 style={{
          fontFamily: "'Sora', sans-serif", fontSize: 52, fontWeight: 300,
          lineHeight: 1.18, letterSpacing: '-1.5px', color: '#1C1917',
          maxWidth: 780, position: 'relative', marginBottom: 28
        }}>
          The{' '}
          <em style={{ fontStyle: 'normal', fontWeight: 800, fontSize: '1.18em', color: '#F4B8C8' }}>smarter</em>
          ,{' '}
          <em style={{ fontStyle: 'normal', fontWeight: 800, fontSize: '1.18em', color: '#A8CCEF' }}>faster</em>
          ,{' '}
          <em style={{ fontStyle: 'normal', fontWeight: 800, fontSize: '1.18em', color: '#A8D8B0' }}>easier</em>
          {' '}way to design{' '}
          <em style={{ fontStyle: 'normal', fontWeight: 800, fontSize: '1.18em', color: '#E8C84A' }}>holistic</em>
          {' '}K–12 curriculum.
        </h1>

        <p style={{
          fontSize: 18, color: '#6B6459', maxWidth: 540, lineHeight: 1.65,
          position: 'relative', marginBottom: 36
        }}>
          EdCube is the AI-powered platform where K–12 educators plan, build, and share complete courses — all in one place.
        </p>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          <button
            onClick={() => navigate('/signup')}
            style={{ background: '#1C1917', color: '#FAF8F4', padding: '14px 28px', borderRadius: 100, fontSize: 15, fontWeight: 500, border: 'none', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
          >
            Start for free
          </button>
          <button
            onClick={() => {/* open demo video */}}
            style={{ background: '#fff', color: '#1C1917', padding: '13px 28px', borderRadius: 100, fontSize: 15, fontWeight: 500, border: '0.5px solid #D0CAC0', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <span className="play-icon" />
            Watch demo
          </button>
        </div>
      </section>

      {/* SECTION LABEL */}
      <div style={{ textAlign: 'center', padding: '80px 48px 24px' }}>
        <p style={{ fontSize: 20, fontWeight: 600, color: '#6B6459', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          Everything a curriculum designer needs
        </p>
      </div>

      {/* FEATURES */}

        {/* Feature 1: Curriculum Design — warm peach */}
        <div style={{ background: '#FEF4EE', padding: '96px 48px' }}>
          <div className="feature-row">
            <div>
              <span className="feat-tag tag-orange">Curriculum Design</span>
              <h2 style={{ fontFamily: "'Sora', sans-serif", fontSize: 30, fontWeight: 700, letterSpacing: '-0.8px', lineHeight: 1.2, color: '#1C1917', marginBottom: 14 }}>
                Build complete courses, not just one-off lessons.
              </h2>
              <p style={{ fontSize: 15, color: '#6B6459', lineHeight: 1.7, maxWidth: 400 }}>
                Design structured K–12 courses from scratch — sections, topics, learning objectives, and resources all in one place. Share full courses with your school or district.
              </p>
              <ul style={{ marginTop: 16, listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {['Hierarchical course structure with sections & topics', 'Built-in PLA framework for balanced learning', 'Export and share with one click'].map(item => (
                  <li key={item} style={{ fontSize: 14, color: '#6B6459', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="feat-check" />{item}
                  </li>
                ))}
              </ul>
            </div>
            <MockCurriculumScreen />
          </div>
        </div>

        {/* Feature 2: Resource Hub — soft sky */}
        <div style={{ background: '#EEF5FD', padding: '96px 48px' }}>
          <div className="feature-row">
            <MockResourceScreen />
            <div>
              <span className="feat-tag tag-blue">Resource Hub</span>
              <h2 style={{ fontFamily: "'Sora', sans-serif", fontSize: 30, fontWeight: 700, letterSpacing: '-0.8px', lineHeight: 1.2, color: '#1C1917', marginBottom: 14 }}>
                All your videos, worksheets, and links — in one place.
              </h2>
              <p style={{ fontSize: 15, color: '#6B6459', lineHeight: 1.7, maxWidth: 400 }}>
                Stop hunting through bookmarks and Drive folders. Save YouTube videos, articles, PDFs, and hands-on activities directly to your course.
              </p>
              <ul style={{ marginTop: 16, listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {['Save YouTube videos with AI-powered relevance scoring', 'Attach worksheets and hands-on activities', 'Share your library across your school'].map(item => (
                  <li key={item} style={{ fontSize: 14, color: '#6B6459', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="feat-check" />{item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Feature 3: Collaboration — light mint */}
        <div style={{ background: '#EEF7F1', padding: '96px 48px' }}>
          <div className="feature-row">
            <div>
              <span className="feat-tag tag-green">Collaboration</span>
              <h2 style={{ fontFamily: "'Sora', sans-serif", fontSize: 30, fontWeight: 700, letterSpacing: '-0.8px', lineHeight: 1.2, color: '#1C1917', marginBottom: 14 }}>
                Co-design curriculum with your fellow teachers.
              </h2>
              <p style={{ fontSize: 15, color: '#6B6459', lineHeight: 1.7, maxWidth: 400 }}>
                Invite colleagues to contribute to your courses. Fork a peer's curriculum and adapt it to your class. Build a shared knowledge base across your entire department.
              </p>
              <ul style={{ marginTop: 16, listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {['Real-time collaborative editing', 'Fork & remix courses with attribution', 'Org-wide course discovery feed'].map(item => (
                  <li key={item} style={{ fontSize: 14, color: '#6B6459', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="feat-check" />{item}
                  </li>
                ))}
              </ul>
            </div>
            <MockCollabScreen />
          </div>
        </div>

        {/* Feature 4: AI Assistant — pale cream */}
        <div style={{ background: '#FEFBEE', padding: '96px 48px' }}>
          <div className="feature-row">
            <MockAIScreen />
            <div>
              <span className="feat-tag tag-yellow">AI Assistant</span>
              <h2 style={{ fontFamily: "'Sora', sans-serif", fontSize: 30, fontWeight: 700, letterSpacing: '-0.8px', lineHeight: 1.2, color: '#1C1917', marginBottom: 14 }}>
                Let AI draft the structure. You bring the expertise.
              </h2>
              <p style={{ fontSize: 15, color: '#6B6459', lineHeight: 1.7, maxWidth: 400 }}>
                Generate full course outlines, suggest topics, auto-find relevant YouTube videos and resources — all with a single prompt. EdCube AI checks PLA pillar coverage so your course stays balanced.
              </p>
              <ul style={{ marginTop: 16, listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {['Generate sections, topics, and subsections instantly', 'AI-sourced YouTube videos scored by grade level', 'PLA coverage checker built into every generation'].map(item => (
                  <li key={item} style={{ fontSize: 14, color: '#6B6459', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="feat-check" />{item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

      {/* CTA */}
      <div style={{
        background: '#1C1917', textAlign: 'center', position: 'relative', overflow: 'hidden',
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: '0 48px 80px'
      }}>
        {/* School doodle texture */}
        {[
          { e: '📚', t: '4%',  l: '2%',   r: -18, s: 34 },
          { e: '✏️', t: '9%',  l: '10%',  r:  22, s: 28 },
          { e: '🎓', t: '3%',  l: '22%',  r:  -6, s: 32 },
          { e: '📐', t: '14%', l: '35%',  r:  14, s: 26 },
          { e: '🔬', t: '5%',  l: '52%',  r: -20, s: 30 },
          { e: '📝', t: '11%', l: '65%',  r:  10, s: 28 },
          { e: '🎨', t: '4%',  l: '78%',  r: -12, s: 32 },
          { e: '🖊️', t: '8%',  l: '90%',  r:  18, s: 26 },
          { e: '📖', t: '22%', l: '5%',   r:  8,  s: 30 },
          { e: '🧪', t: '28%', l: '18%',  r: -16, s: 28 },
          { e: '💡', t: '20%', l: '45%',  r:  12, s: 30 },
          { e: '🔭', t: '25%', l: '72%',  r: -8,  s: 32 },
          { e: '✂️', t: '30%', l: '88%',  r:  20, s: 26 },
          { e: '📏', t: '42%', l: '1%',   r: -22, s: 28 },
          { e: '🖍️', t: '48%', l: '14%',  r:  16, s: 30 },
          { e: '📌', t: '40%', l: '82%',  r: -10, s: 26 },
          { e: '🧮', t: '55%', l: '6%',   r:  10, s: 32 },
          { e: '⭐', t: '60%', l: '25%',  r: -14, s: 28 },
          { e: '📋', t: '52%', l: '58%',  r:  18, s: 30 },
          { e: '🏫', t: '58%', l: '75%',  r:  -8, s: 34 },
          { e: '📎', t: '65%', l: '92%',  r:  12, s: 26 },
          { e: '🎯', t: '72%', l: '3%',   r: -20, s: 30 },
          { e: '📊', t: '78%', l: '20%',  r:  14, s: 28 },
          { e: '🖋️', t: '70%', l: '48%',  r:  -6, s: 30 },
          { e: '📚', t: '75%', l: '68%',  r:  22, s: 32 },
          { e: '✏️', t: '82%', l: '85%',  r: -16, s: 28 },
          { e: '🎓', t: '88%', l: '8%',   r:  10, s: 30 },
          { e: '🔬', t: '85%', l: '38%',  r: -12, s: 32 },
          { e: '💡', t: '90%', l: '60%',  r:  20, s: 28 },
          { e: '🧪', t: '93%', l: '80%',  r:  -8, s: 30 },
        ].map(({ e, t, l, r, s }, i) => (
          <span key={i} style={{
            position: 'absolute', top: t, left: l,
            fontSize: s, opacity: 0.12,
            transform: `rotate(${r}deg)`,
            pointerEvents: 'none', userSelect: 'none', lineHeight: 1
          }}>{e}</span>
        ))}

        <h2 style={{
          fontFamily: "'Sora', sans-serif", fontSize: 52, fontWeight: 300,
          lineHeight: 1.18, letterSpacing: '-1.5px', color: '#FAF8F4',
          position: 'relative', marginBottom: 28, maxWidth: 700
        }}>
          Start building{' '}
          <em style={{ fontStyle: 'normal', fontWeight: 800, fontSize: '1.18em', color: '#F4B8C8' }}>better</em>
          {' '}curriculum{' '}
          <em style={{ fontStyle: 'normal', fontWeight: 800, fontSize: '1.18em', color: '#A8D8B0' }}>today</em>
          .
        </h2>
        <p style={{ fontSize: 18, color: 'rgba(250,248,244,0.6)', maxWidth: 460, lineHeight: 1.65, position: 'relative', marginBottom: 40 }}>
          Join educators already using EdCube to design curriculum that develops the whole child.
        </p>
        <button
          onClick={() => navigate('/signup')}
          className="cta-get-started-btn"
          style={{
            padding: '16px 40px', borderRadius: 100, fontSize: 16, fontWeight: 600,
            border: 'none', cursor: 'pointer', fontFamily: "'Sora', sans-serif",
            position: 'relative', letterSpacing: '-0.3px'
          }}
        >
          Get started for free
        </button>
      </div>

      {/* FOOTER */}
      <div style={{ textAlign: 'center', padding: '24px 48px', fontSize: 13, color: '#A89F94', borderTop: '0.5px solid #E5E0D8' }}>
        © 2026 EdCube · A curriculum design studio for K–12 educators
      </div>

    </div>
  );
};

/* ─── Mock Screen Components ─────────────────────────────────── */

const MockTopbar = ({ title }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, paddingBottom: 12, borderBottom: '0.5px solid #F0EBE3' }}>
    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#F9C0C8' }} />
    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#F9E0A0' }} />
    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#A8D8B0' }} />
    <span style={{ fontSize: 13, fontWeight: 600, color: '#1C1917', marginLeft: 4 }}>{title}</span>
  </div>
);

const MockCard = ({ icon, iconBg, title, subtitle, pills, faded }) => (
  <div style={{ background: '#FAF8F4', border: '0.5px solid #E5E0D8', borderRadius: 12, padding: '12px 14px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10, opacity: faded ? 0.5 : 1 }}>
    <div style={{ width: 32, height: 32, borderRadius: 8, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{icon}</div>
    <div style={{ flex: 1 }}>
      <strong style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1C1917' }}>{title}</strong>
      <span style={{ fontSize: 11, color: '#A89F94' }}>{subtitle}</span>
      {pills && (
        <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
          {pills.map(p => <span key={p.label} className={`pla-pill ${p.cls}`}>{p.label}</span>)}
        </div>
      )}
    </div>
  </div>
);

const MockVisualWrapper = ({ children }) => (
  <div style={{ background: '#fff', borderRadius: 20, border: '0.5px solid #E5E0D8', overflow: 'hidden' }}>
    <div style={{ padding: 20, minHeight: 240 }}>{children}</div>
  </div>
);

const MockCurriculumScreen = () => (
  <MockVisualWrapper>
    <MockTopbar title="MLK Jr. — Grade 5" />
    <MockCard icon="📚" iconBg="#FDEEE6" title="Introduction to Civil Rights" subtitle="Section 1 · 25 min" pills={[{ label: 'Personal Growth', cls: 'pill-pk' }, { label: 'Core Learning', cls: 'pill-cl' }]} />
    <MockCard icon="🎯" iconBg="#E4EFF9" title="The Montgomery Bus Boycott" subtitle="Section 2 · 30 min" pills={[{ label: 'Critical Thinking', cls: 'pill-ct' }, { label: 'Application', cls: 'pill-ai' }]} />
    <MockCard icon="✏️" iconBg="#E5F4E9" title='"I Have a Dream" Analysis' subtitle="Section 3 · 35 min" faded />
  </MockVisualWrapper>
);

const MockResourceScreen = () => (
  <MockVisualWrapper>
    <MockTopbar title="Resource Library" />
    {[
      { bg: 'linear-gradient(135deg,#E4EFF9,#A8CCEF)', title: 'Bill of Rights — Explained for Kids', meta: 'YouTube · 8 min', tagBg: '#E4EFF9', tagColor: '#1E5F99', tag: 'Video' },
      { bg: 'linear-gradient(135deg,#E5F4E9,#A8D8B0)', title: 'Civil Rights Reading Worksheet', meta: 'PDF · Grade 5', tagBg: '#E5F4E9', tagColor: '#2E7A43', tag: 'Worksheet' },
      { bg: 'linear-gradient(135deg,#FDEEE6,#F9C0A8)', title: "Timeline Activity: MLK's Life", meta: 'Hands-on · 20 min', tagBg: '#FDEEE6', tagColor: '#C05A2A', tag: 'Activity' },
    ].map(r => (
      <div key={r.title} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '0.5px solid #F0EBE3' }}>
        <div style={{ width: 44, height: 30, borderRadius: 6, background: r.bg, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: '#1C1917' }}>{r.title}</div>
          <div style={{ fontSize: 11, color: '#A89F94' }}>{r.meta}</div>
        </div>
        <div style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: r.tagBg, color: r.tagColor }}>{r.tag}</div>
      </div>
    ))}
  </MockVisualWrapper>
);

const MockCollabScreen = () => (
  <MockVisualWrapper>
    <MockTopbar title="Grade 5 Science — shared" />
    <div style={{ display: 'flex', marginBottom: 14 }}>
      {[{ initials: 'SR', bg: '#F9C0C8', color: '#8B3A4A' }, { initials: 'MK', bg: '#A8CCEF', color: '#1E5F99' }, { initials: 'TL', bg: '#A8D8B0', color: '#2E7A43' }, { initials: '+2', bg: '#F9E0A0', color: '#8A6B00' }].map((a, i) => (
        <div key={a.initials} style={{ width: 32, height: 32, borderRadius: '50%', background: a.bg, color: a.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, border: '2px solid #fff', marginLeft: i === 0 ? 0 : -8 }}>{a.initials}</div>
      ))}
    </div>
    <div className="comment-bubble">
      <p>I added 2 new resources to Section 3 — check the photosynthesis activity!</p>
      <span>Ms. Kumar · just now</span>
    </div>
    <div className="comment-bubble right">
      <p>Love it. Can we fork this for the 6th grade version too?</p>
      <span>Mr. Lee · 2 min ago</span>
    </div>
  </MockVisualWrapper>
);

const MockAIScreen = () => (
  <MockVisualWrapper>
    <MockTopbar title="AI Curriculum Assistant" />
    <div style={{ background: '#F5F1EC', borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontSize: 12, color: '#6B6459' }}>
      Generate sections for: <strong style={{ color: '#1C1917' }}>"US History, Grade 6, 8 weeks"</strong>
    </div>
    <div style={{ marginBottom: 10 }}>
      {['Colonial America (3 topics)', 'The Revolution (4 topics)', 'Writing the Constitution', 'Westward Expansion'].map(chip => (
        <span key={chip} className="ai-chip">✦ {chip}</span>
      ))}
    </div>
    <div style={{ fontSize: 11, color: '#A89F94', marginTop: 8 }}>PLA coverage · 4/4 pillars ✓</div>
  </MockVisualWrapper>
);

export default LandingPage;
