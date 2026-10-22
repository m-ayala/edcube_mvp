// frontend/src/components/pages/LandingPage.jsx

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { logoutTeacher } from '../../firebase/authService';

const SORA = "'Sora', sans-serif";

const LandingPage = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  useEffect(() => { document.title = 'EdCube — A Studio for Educators'; }, []);

  const handleLogout = async () => {
    await logoutTeacher();
  };

  const scrollToDemo = (e) => {
    e.preventDefault();
    document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="lp-root">
      <style>{LANDING_CSS}</style>

      {/* Scattered background blobs for the whole page */}
      <div className="blob-layer" aria-hidden="true">
        {PAGE_BLOBS.map((b, i) => (
          <div key={i} className="page-blob" style={{ background: b.c, width: b.s, height: b.s, top: b.t, left: b.l }} />
        ))}
      </div>

      {/* NAV */}
      <nav className="lp-nav">
        <div style={{ fontFamily: SORA, fontWeight: 700, fontSize: 20, letterSpacing: '-0.5px' }}>EdCube</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {currentUser ? (
            <>
              <span className="nav-hide" style={{ fontSize: 13, color: '#6B6459', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {currentUser.displayName || currentUser.email}
              </span>
              <button className="btn-outline nav-btn" onClick={() => navigate('/my-courses')}>My courses</button>
              <button className="btn-dark nav-btn" onClick={handleLogout}>Log out</button>
            </>
          ) : (
            <>
              <button className="btn-outline nav-btn nav-hide" onClick={() => navigate('/login')}>Log in</button>
              <button className="btn-outline nav-btn nav-hide" onClick={() => navigate('/contact')}>Request a demo</button>
              <button className="btn-dark nav-btn" onClick={() => navigate('/signup')}>Sign up free</button>
            </>
          )}
        </div>
      </nav>

      {/* 1. HERO */}
      <section className="hero">
        <div className="lp-blob blob-pink" />
        <div className="lp-blob blob-blue" />
        <div className="lp-blob blob-yellow" />
        <div className="lp-blob blob-green" />

        <img
          src="/edcube-logo.png"
          alt="EdCube"
          style={{ width: 132, height: 132, objectFit: 'contain', marginBottom: 52, position: 'relative' }}
        />

        <h1 className="hero-title">
          <em style={{ color: '#E0607E' }}>Holistic</em>
          {' '}and{' '}
          <em style={{ color: '#3D86CF' }}>innovative</em>
          {' '}education,<br />designed by{' '}
          <em style={{ color: '#3A9A57' }}>teachers</em>.
        </h1>

        <p className="hero-sub">
          Create, collaborate, and discover courses that reach every part of the student.
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', position: 'relative' }}>
          <button className="btn-dark" onClick={() => navigate('/signup')}>Start designing for free</button>
          <a href="#demo" className="btn-outline" onClick={scrollToDemo}>See how it works</a>
        </div>
      </section>

      {/* 2. DEMO VIDEO */}
      <div id="demo" className="demo-wrap">
        <h2 style={{ fontFamily: SORA, fontSize: 28, fontWeight: 700, letterSpacing: '-0.6px', marginBottom: 24, textAlign: 'center' }}>
          Watch the demo video here!
        </h2>
        <video
          src="/demo_vid.mp4"
          controls
          style={{
            width: '100%', maxWidth: 900, borderRadius: 20,
            border: '0.5px solid #E5E0D8',
            boxShadow: '0 8px 40px rgba(28,25,23,0.10)'
          }}
        />
      </div>

      {/* 3. FRAMEWORK */}
      <section className="sec-pad">
        <div className="wrap">
          <div className="sec-head">
            <p className="sec-label">Our framework</p>
            <h2 className="sec">Built on the MLA framework.</h2>
          </div>
          <div className="pillars">
            {PILLARS.map(p => (
              <div key={p.name} className="pillar" style={{ background: p.bg }}>
                <h3 style={{ color: p.color }}>{p.name}</h3>
                <div className="kw">{p.keywords.map(k => <span key={k}>{k}</span>)}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. WHY EDCUBE */}
      <section className="sec-pad" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="sec-head">
            <p className="sec-label">Why EdCube</p>
            <h2 className="sec">Holistic and innovative education, in every subject.</h2>
          </div>
          <div className="flips">
            {SUBJECTS.map(s => <FlipCard key={s.name} subject={s} />)}
          </div>
        </div>
      </section>

      {/* 5. WHAT EDCUBE DOES */}
      <div className="sec-head band-label">
        <p className="sec-label">What EdCube does</p>
      </div>

      <FeatureBand
        tag="Create" tagClass="tag-orange"
        title="Design courses that reach every pillar."
        body="Describe your course and EdCube builds the outline with you. Shape it by adding, removing, and reordering blocks, with content, worksheets, and activities for all four pillars."
        bullets={[
          'Course outlines built with you, block by block',
          'MLA framework built into every course',
          'Content, worksheets, and activities for every pillar',
        ]}
        visual={<Screenshot name="create" bar="EdCube · Course Designer" label="Create" note="The course designer at the outline stage, with a sample course whose blocks are tagged with the four pillars." />}
      />

      <FeatureBand
        reverse
        tag="Collaborate" tagClass="tag-green"
        title="Design courses together with your fellow teachers."
        body="Invite colleagues to build a course with you, or share a view-only link with anyone. Learn from more experienced teachers and from teachers working with a different group of students."
        bullets={[
          'Invite co-editors to build a course with you',
          'Share a view-only link, no account needed',
          'You decide who can view and who can edit',
        ]}
        visual={<Screenshot name="collaborate" bar="EdCube · Shared course" label="Collaborate" note="The invite-collaborators dialog with a collaborator list, or the share-link dialog, on the sample course." />}
      />

      <FeatureBand
        tag="Discover" tagClass="tag-blue"
        title="Find courses from teachers around you."
        body="Search the courses teachers in your school or organization have built, open their profiles, and ask to collaborate on the ones you like."
        bullets={[
          "Search your organization's courses",
          'Browse teacher profiles and their courses',
          'Request to collaborate on a course',
        ]}
        visual={<Screenshot name="discover" bar="EdCube · Search" label="Discover" note="The Search page showing several courses from teachers in an organization." />}
      />

      {/* 6. OUR APPROACH TO AI */}
      <FeatureBand
        reverse
        tag="Our approach to AI" tagClass="tag-yellow"
        title="The teacher drives. AI is the copilot."
        body="EdCube uses AI to help teachers shape their ideas and to connect them with the best of what people have already made: articles, research, videos, and activities tested in real classrooms. Resources come with their sources so you can check them. The teacher makes every decision."
        visual={<EdoPreview />}
      />

      {/* 7. MISSION AND VISION */}
      <section className="sec-pad">
        <div className="wrap">
          <div className="sec-head">
            <p className="sec-label">Mission and vision</p>
            <h2 className="sec">Why we exist.</h2>
          </div>
          <div className="mv">
            <div className="mv-card">
              <h3 style={{ color: '#C05A2A' }}>Mission</h3>
              <p>To give every educator the tools, framework, and community to create holistic and innovative education, so every learner grows into a confident global citizen.</p>
            </div>
            <div className="mv-card">
              <h3 style={{ color: '#1E5F99' }}>Vision</h3>
              <p>An education that keeps expanding in scope, reach, and impact, where every student graduates secure in their worth and ready to give back to society.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 8. WHO EDCUBE IS FOR */}
      <section className="sec-pad" style={{ paddingTop: 0, textAlign: 'center' }}>
        <div className="wrap">
          <div className="sec-head" style={{ marginBottom: 0 }}>
            <p className="sec-label">Who EdCube is for</p>
          </div>
          <div className="marquee">
            <div className="track">
              {[...AUDIENCES, ...AUDIENCES].map((a, i) => (
                <span key={i} className="aud" style={{ background: a.bg }} aria-hidden={i >= AUDIENCES.length ? 'true' : undefined}>
                  {a.label}
                </span>
              ))}
            </div>
          </div>
          <p className="body" style={{ marginTop: 20 }}>Currently designed for K through 8, growing into middle and high school.</p>
        </div>
      </section>

      {/* 9. MEET THE FOUNDER */}
      <section className="sec-pad" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="sec-head" style={{ marginBottom: 0 }}>
            <p className="sec-label">Meet the founder</p>
          </div>
          <div className="founder">
            <h3>Manaswini Ayalasomayajula</h3>
            <div className="role">Founder, EdCube</div>
            <p>Manaswini is a robotics engineer turned educator. She is pursuing an MBA in Executive Management at the California Institute of Advanced Management.</p>
            <p>As Technical Program Manager at the India Community Center, she designs and runs STEAM programs for children ages 4 to 13. Working alongside teachers every day, she saw how much they give and how little support they get to build innovative and holistic curriculum. EdCube is her answer.</p>
          </div>
        </div>
      </section>

      {/* 10. CTA */}
      <div className="cta">
        {DOODLES.map(({ e, t, l, r, s }, i) => (
          <span key={i} aria-hidden="true" style={{
            position: 'absolute', top: t, left: l,
            fontSize: s, opacity: 0.12,
            transform: `rotate(${r}deg)`,
            pointerEvents: 'none', userSelect: 'none', lineHeight: 1
          }}>{e}</span>
        ))}

        <h2 className="cta-title">
          Design your{' '}
          <em style={{ color: '#F4B8C8' }}>next course</em>
          {' '}with{' '}
          <em style={{ color: '#A8D8B0' }}>EdCube</em>.
        </h2>
        <p style={{ fontSize: 18, color: 'rgba(250,248,244,0.6)', maxWidth: 460, lineHeight: 1.65, position: 'relative', marginBottom: 40 }}>
          Free for every educator. Built with teachers, for students.
        </p>
        <button className="cta-btn" onClick={() => navigate('/signup')}>Start designing for free</button>
      </div>

      {/* FOOTER */}
      <div className="lp-footer">
        © 2026 EdCube · Holistic and innovative education for every educator
      </div>
    </div>
  );
};

/* ─── Sections ───────────────────────────────────────────────── */

const FeatureBand = ({ tag, tagClass, title, body, bullets, visual, reverse }) => (
  <div className="band">
    <div className={`feature-row${reverse ? ' reverse' : ''}`}>
      <div>
        <span className={`feat-tag ${tagClass}`}>{tag}</span>
        <h2 className="sec">{title}</h2>
        <p className="body" style={{ maxWidth: 400 }}>{body}</p>
        {bullets && (
          <ul className="feat-list">
            {bullets.map(item => (
              <li key={item}><span className="feat-check" />{item}</li>
            ))}
          </ul>
        )}
      </div>
      <div className="feature-visual">{visual}</div>
    </div>
  </div>
);

// Shows /landing/<name>.png once the file exists; until then, a placeholder card.
const Screenshot = ({ name, bar, label, note }) => {
  const [missing, setMissing] = useState(false);
  return (
    <div className={missing ? 'shot' : 'shot shot-real'}>
      <div className="shot-bar">
        <i style={{ background: '#F9C0C8' }} />
        <i style={{ background: '#F9E0A0' }} />
        <i style={{ background: '#A8D8B0' }} />
        <b>{bar}</b>
      </div>
      {missing ? (
        <div className="shot-body">
          <span className="lbl">Screenshot coming soon: {label}</span>
          <p>{note}</p>
        </div>
      ) : (
        <img
          src={`/landing/${name}.png`}
          alt={`EdCube ${label.toLowerCase()} screen`}
          loading="lazy"
          onError={() => setMissing(true)}
          style={{ display: 'block', width: '100%', height: 'auto' }}
        />
      )}
    </div>
  );
};

const FlipCard = ({ subject }) => {
  const [open, setOpen] = useState(false);
  const [imgMissing, setImgMissing] = useState(false);
  const toggle = () => setOpen(o => !o);
  return (
    <div
      className="flip"
      role="button"
      tabIndex={0}
      aria-pressed={open}
      aria-label={`${subject.name}: ${open ? 'hide' : 'show'} the four pillars`}
      onClick={toggle}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
      }}
    >
      <span className="flip-inner">
        <span className="face front">
          {imgMissing ? (
            <span className="front-img" style={{ background: subject.fallback }} />
          ) : (
            <img className="front-img" src={subject.img} alt={subject.alt} loading="lazy" onError={() => setImgMissing(true)} />
          )}
          <span className="front-text"><b>{subject.name}</b><small>{subject.sub}</small></span>
          <span className="turn" aria-hidden="true">↻</span>
        </span>
        <span className="face back">
          <span className="back-head"><b>{subject.name}</b><span className="turn back-turn" aria-hidden="true">↺</span></span>
          <ul>
            {subject.pillars.map((text, i) => (
              <li key={PILLARS[i].name} className={`pfill ${PILLARS[i].fill}`}>
                <b>{PILLARS[i].name}</b><span>{text}</span>
              </li>
            ))}
          </ul>
        </span>
      </span>
    </div>
  );
};

// Static look-alike of the in-app Edo panel (EdoChatbot.jsx): same colors, header and bubble shapes.
const EDO_ORANGE = '#E8761A';
const EDO_GREEN = '#2C5F3A';
const EDO_FONT = "'DM Sans', sans-serif";

const EdoAvatar = () => (
  <div style={{
    width: 24, height: 24, borderRadius: '50%', backgroundColor: EDO_GREEN, flexShrink: 0, marginTop: 2,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }}>
    <span style={{ color: 'white', fontSize: 11, fontWeight: 700, fontFamily: "'Fraunces', serif" }}>E</span>
  </div>
);

const EdoAiBubble = ({ children }) => (
  <div style={{ display: 'flex', gap: 7, alignItems: 'flex-start' }}>
    <EdoAvatar />
    <div style={{
      maxWidth: '82%', padding: '8px 12px', borderRadius: '14px 14px 14px 2px',
      backgroundColor: 'white', color: '#1C1917', fontSize: 14.3, lineHeight: 1.55, fontFamily: EDO_FONT,
      border: '1px solid #E7E5E4',
    }}>
      {children}
    </div>
  </div>
);

const EdoPreview = () => (
  <div style={{
    background: '#FAFAF8', border: '1px solid #E7E5E4', borderRadius: 20, overflow: 'hidden',
    boxShadow: '0 8px 30px rgba(28,25,23,0.08)', maxWidth: 420, margin: '0 auto', width: '100%',
  }}>
    <div style={{ backgroundColor: EDO_ORANGE, padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.22)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, fontSize: 16.5, color: 'white', fontFamily: "'Fraunces', serif",
      }}>E</div>
      <div>
        <div style={{ color: 'white', fontWeight: 700, fontSize: 15.4, fontFamily: EDO_FONT }}>Edo</div>
        <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12.1, fontFamily: EDO_FONT }}>EdCube AI</div>
      </div>
    </div>
    <div style={{ padding: '7px 11px', backgroundColor: '#F5F3EE', borderBottom: '1px solid #E7E5E4', fontSize: 12.7, color: '#78716C', fontFamily: EDO_FONT }}>
      📘 <span style={{ color: '#1C1917', fontWeight: 600 }}>Ecosystems, Grade 5</span>
    </div>
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <EdoAiBubble>Hi! I&apos;m Edo 👋 I&apos;m here to help you build &ldquo;Ecosystems, Grade 5&rdquo;. Ask me anything, let&apos;s think through it together.</EdoAiBubble>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{
          maxWidth: '82%', padding: '8px 12px', borderRadius: '14px 14px 2px 14px',
          backgroundColor: EDO_GREEN, color: 'white', fontSize: 14.3, lineHeight: 1.5, fontFamily: EDO_FONT,
        }}>
          Can you suggest an Application activity for week 3?
        </div>
      </div>
      <EdoAiBubble>How about a local pond study? Students observe a real ecosystem near school and share what they find with the class. I found a field guide from the National Wildlife Federation you can review before adding it.</EdoAiBubble>
    </div>
  </div>
);

/* ─── Content ────────────────────────────────────────────────── */

const PILLARS = [
  { name: 'Personal Growth', color: '#C05A2A', bg: '#FDEEE6', fill: 'pg',
    keywords: ['Self-reflection', 'Emotional intelligence', 'Communication', 'Resilience', 'Collaboration', 'Leadership'] },
  { name: 'Knowledge', color: '#1E5F99', bg: '#E4EFF9', fill: 'kn',
    keywords: ['Core subject', 'Global perspectives', 'The arts', 'Sports', 'Personalized learning'] },
  { name: 'Critical Thinking', color: '#2E7A43', bg: '#E5F4E9', fill: 'ct',
    keywords: ['Analysis', 'Evaluation', 'Patterns and systems', 'Ethics', 'Discourse'] },
  { name: 'Application', color: '#8A6B00', bg: '#FDF5DC', fill: 'ap',
    keywords: ['Community', 'Environment', 'Health', 'Entrepreneurship', 'Real-world impact'] },
];

const SUBJECTS = [
  { name: 'Science', sub: 'Biology and chemistry', img: '/landing/science.jpg', fallback: 'linear-gradient(135deg,#E5F4E9,#A8D8B0)',
    alt: 'Students working on a hands-on project at an ICC camp',
    pillars: ['Curiosity and patience through experiments', 'How ecosystems and batteries work', 'The ethics of waste and pollution', 'Climate action in our own community'] },
  { name: 'Technology', sub: 'Robotics and coding', img: '/landing/technology.jpg', fallback: 'linear-gradient(135deg,#E4EFF9,#A8CCEF)',
    alt: 'Students building a robot together at ICC',
    pillars: ['Teamwork and resilience while debugging', 'How robots sense, think, and move', 'Systems thinking and the ethics of technology', 'Robots that solve real problems around us'] },
  { name: 'Arts', sub: 'Visual art and design', img: '/landing/arts.jpg', fallback: 'linear-gradient(135deg,#FDEEE6,#F9C0C8)',
    alt: 'A student coloring a drawing at an ICC art class',
    pillars: ['Self-expression and confidence', 'Color, shape, and culture in art', 'Why patterns repeat across cultures', 'Public art made for the community'] },
  { name: 'Performing Arts', sub: 'Dance, music, and theater', img: '/landing/performing-arts.jpg', fallback: 'linear-gradient(135deg,#FDF5DC,#F9E0A0)',
    alt: 'A student in a handmade costume at an ICC performance',
    pillars: ['Collaboration and coordination', 'Rhythm, the math in music, and culture', 'Storytelling through movement and sound', 'Performing for community events'] },
];

const AUDIENCES = [
  { label: 'Teachers at private schools', bg: '#FDEEE6' },
  { label: 'After-school programs', bg: '#E4EFF9' },
  { label: 'Education organizations', bg: '#E5F4E9' },
  { label: 'Independent course and workshop teachers', bg: '#FDF5DC' },
];

const PAGE_BLOBS = [
  { c: '#F9C0C8', s: 320, t: '14%', l: '-6%' },
  { c: '#A8CCEF', s: 300, t: '22%', l: '78%' },
  { c: '#F9E0A0', s: 260, t: '33%', l: '4%' },
  { c: '#A8D8B0', s: 300, t: '41%', l: '70%' },
  { c: '#A8CCEF', s: 280, t: '50%', l: '-4%' },
  { c: '#F9C0C8', s: 300, t: '58%', l: '76%' },
  { c: '#A8D8B0', s: 260, t: '66%', l: '8%' },
  { c: '#F9E0A0', s: 300, t: '74%', l: '72%' },
  { c: '#F9C0C8', s: 260, t: '82%', l: '20%' },
];

const DOODLES = [
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
];

/* ─── Styles ─────────────────────────────────────────────────── */

const LANDING_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;700&display=swap');

  .lp-root { font-family: ${SORA}; background: #FAF8F4; color: #1C1917; position: relative; overflow-x: hidden; isolation: isolate; }
  .lp-root *, .lp-root *::before, .lp-root *::after { box-sizing: border-box; }
  .lp-root h1, .lp-root h2, .lp-root h3, .lp-root p, .lp-root ul { margin: 0; padding: 0; }
  .lp-root button { font-family: ${SORA}; cursor: pointer; }
  .lp-root a { color: inherit; text-decoration: none; }

  .blob-layer { position: absolute; inset: 0; overflow: hidden; z-index: -1; pointer-events: none; }
  .page-blob { position: absolute; border-radius: 50%; filter: blur(70px); opacity: 0.38; }

  .lp-nav { display: flex; align-items: center; justify-content: space-between; padding: 18px 48px; background: #FAF8F4; border-bottom: 0.5px solid #E5E0D8; position: sticky; top: 0; z-index: 10; }

  .btn-dark { background: #1C1917; color: #FAF8F4; padding: 14px 28px; border-radius: 100px; font-size: 15px; font-weight: 400; border: none; display: inline-block; }
  .btn-outline { background: transparent; color: #1C1917; padding: 14px 28px; border-radius: 100px; font-size: 15px; font-weight: 400; border: 0.5px solid #D0CAC0; display: inline-block; }
  .nav-btn { padding: 10px 20px; font-size: 14px; }

  .hero { position: relative; padding: 0 48px 100px; text-align: center; overflow: hidden; min-height: calc(100vh - 57px); display: flex; flex-direction: column; align-items: center; justify-content: center; }
  .lp-blob { position: absolute; border-radius: 50%; filter: blur(60px); opacity: 0.45; pointer-events: none; }
  .blob-pink  { width: 320px; height: 320px; background: #F9C0C8; top: -80px; left: -60px; }
  .blob-blue  { width: 280px; height: 280px; background: #A8CCEF; top: -40px; right: -40px; }
  .blob-yellow{ width: 240px; height: 240px; background: #F9E0A0; bottom: -60px; left: 10%; }
  .blob-green { width: 260px; height: 260px; background: #A8D8B0; bottom: -40px; right: 8%; }
  .lp-root .hero-title { font-size: 52px; font-weight: 300; line-height: 1.18; letter-spacing: -1.5px; max-width: 1040px; position: relative; margin-bottom: 28px; }
  .hero-title em, .cta-title em { font-style: normal; font-weight: 700; font-size: 1.18em; }
  .lp-root .hero-sub { font-size: 24px; color: #4A443C; max-width: 900px; line-height: 1.5; position: relative; margin-bottom: 40px; }

  .demo-wrap { padding: 0 48px 80px; display: flex; flex-direction: column; align-items: center; }

  .wrap { max-width: 1100px; margin: 0 auto; }
  .sec-pad { padding: 80px 48px; }
  .sec-head { text-align: center; margin-bottom: 40px; }
  .band-label { padding: 0 48px; margin-bottom: 0; }
  .lp-root .sec-label { font-size: 20px; font-weight: 700; color: #6B6459; letter-spacing: 0.04em; text-transform: uppercase; margin-bottom: 12px; }
  .lp-root h2.sec { font-size: 30px; font-weight: 700; letter-spacing: -0.8px; line-height: 1.2; color: #1C1917; margin-bottom: 14px; }
  .lp-root .sec-head h2.sec { font-size: 36px; margin-bottom: 0; }
  .body { font-size: 15px; color: #6B6459; line-height: 1.7; }

  .pillars { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
  .pillar { border-radius: 20px; padding: 28px 24px; text-align: left; }
  .lp-root .pillar h3 { font-size: 19px; font-weight: 700; margin-bottom: 16px; }
  .kw { display: flex; flex-wrap: wrap; gap: 8px; }
  .kw span { background: rgba(255,255,255,0.75); border-radius: 100px; padding: 6px 12px; font-size: 13px; line-height: 1.2; color: #1C1917; }

  .flips { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
  .flip { display: block; height: 430px; perspective: 1400px; cursor: pointer; border-radius: 22px; -webkit-tap-highlight-color: transparent; }
  .flip:focus-visible { outline: 3px solid #1C1917; outline-offset: 4px; }
  .flip-inner { position: relative; display: block; width: 100%; height: 100%; transform-style: preserve-3d; transition: transform .7s cubic-bezier(.2,.8,.2,1), box-shadow .35s; border-radius: 22px; box-shadow: 0 2px 10px rgba(28,25,23,.06); }
  .flip:hover .flip-inner { transform: translateY(-10px) rotateY(-8deg) scale(1.03); box-shadow: 0 22px 44px rgba(28,25,23,.16); }
  .flip[aria-pressed="true"] .flip-inner { transform: rotateY(180deg); }
  .flip[aria-pressed="true"]:hover .flip-inner { transform: translateY(-6px) rotateY(180deg); }
  .face { position: absolute; inset: 0; display: flex; flex-direction: column; border-radius: 22px; overflow: hidden; backface-visibility: hidden; -webkit-backface-visibility: hidden; text-align: left; background: #fff; border: 0.5px solid #E5E0D8; }
  .front-img { width: 100%; height: 72%; object-fit: cover; display: block; transition: transform .6s ease; flex-shrink: 0; }
  .flip:hover .front-img { transform: scale(1.07); }
  .front-text { padding: 18px 20px; display: flex; flex-direction: column; gap: 2px; }
  .front-text b { font-size: 20px; font-weight: 700; letter-spacing: -0.3px; }
  .front-text small { font-size: 13px; color: #A89F94; }
  .turn { position: absolute; right: 16px; bottom: 18px; width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; font-size: 17px; background: #F5F1EC; color: #1C1917; transition: transform .5s ease, background .3s, color .3s; }
  .flip:hover .front .turn { transform: rotate(180deg); background: #1C1917; color: #FAF8F4; }
  .back { transform: rotateY(180deg); padding: 14px; }
  .back-head { display: flex; align-items: center; justify-content: space-between; padding: 4px 6px 12px; }
  .back-head b { font-size: 18px; font-weight: 700; }
  .back-turn { position: static; width: 28px; height: 28px; font-size: 14px; }
  .lp-root .back ul { list-style: none; display: flex; flex-direction: column; gap: 8px; flex: 1; }
  .pfill { flex: 1; border-radius: 14px; padding: 12px 14px; display: flex; flex-direction: column; justify-content: center; gap: 3px; color: #1C1917; opacity: 0; transform: translateY(8px); transition: opacity .4s, transform .4s; }
  .pfill b { font-size: 13px; font-weight: 700; letter-spacing: 0.02em; }
  .pfill span { font-size: 13.5px; line-height: 1.4; }
  .pfill.pg { background: #F6B89B; } .pfill.kn { background: #A3CBF0; } .pfill.ct { background: #A6DAB5; } .pfill.ap { background: #F5D77E; }
  .flip[aria-pressed="true"] .pfill { opacity: 1; transform: none; }
  .flip[aria-pressed="true"] .pfill:nth-child(1) { transition-delay: .35s; }
  .flip[aria-pressed="true"] .pfill:nth-child(2) { transition-delay: .45s; }
  .flip[aria-pressed="true"] .pfill:nth-child(3) { transition-delay: .55s; }
  .flip[aria-pressed="true"] .pfill:nth-child(4) { transition-delay: .65s; }

  .band { padding: 40px 48px; }
  .feature-row { display: grid; grid-template-columns: 1fr 1fr; gap: 64px; align-items: center; max-width: 1100px; margin: 0 auto; }
  .feature-row.reverse > .feature-visual { order: -1; }
  .feat-tag { display: inline-block; font-size: 12.1px; font-weight: 700; letter-spacing: 0.07em; text-transform: uppercase; padding: 4px 10px; border-radius: 100px; margin-bottom: 16px; }
  .tag-orange { background: #FDEEE6; color: #C05A2A; }
  .tag-blue   { background: #E4EFF9; color: #1E5F99; }
  .tag-green  { background: #E5F4E9; color: #2E7A43; }
  .tag-yellow { background: #FDF5DC; color: #8A6B00; }
  .lp-root .feat-list { margin-top: 16px; list-style: none; display: flex; flex-direction: column; gap: 8px; }
  .feat-list li { font-size: 14px; color: #6B6459; line-height: 1.6; display: flex; align-items: center; gap: 8px; }
  .feat-check { width: 16px; height: 16px; border-radius: 50%; background: #1C1917; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .feat-check::after { content: ''; width: 5px; height: 3px; border-left: 1.5px solid #FAF8F4; border-bottom: 1.5px solid #FAF8F4; transform: rotate(-45deg) translateY(-1px); }

  .shot { background: rgba(255,255,255,0.8); border: 1.5px dashed #CFC6BA; border-radius: 20px; overflow: hidden; }
  .shot.shot-real { border: 0.5px solid #E5E0D8; box-shadow: 0 8px 30px rgba(28,25,23,0.08); background: #fff; }
  .shot-bar { display: flex; align-items: center; gap: 6px; padding: 12px 16px; border-bottom: 0.5px solid #E5E0D8; }
  .shot-bar i { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
  .shot-bar b { font-size: 12px; margin-left: 6px; color: #6B6459; font-weight: 700; }
  .shot-body { padding: 28px 24px; min-height: 260px; display: flex; flex-direction: column; justify-content: center; gap: 10px; text-align: left; }
  .shot-body .lbl { font-size: 11px; font-weight: 700; letter-spacing: 0.07em; text-transform: uppercase; color: #A89F94; }
  .shot-body p { font-size: 14px; line-height: 1.6; color: #4A443C; }

  .mv { display: grid; grid-template-columns: 1fr; gap: 20px; max-width: 880px; margin: 0 auto; text-align: left; }
  .mv-card { background: rgba(255,255,255,0.72); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border: 0.5px solid #E5E0D8; border-radius: 20px; padding: 44px 48px; }
  .lp-root .mv-card h3 { font-size: 15px; font-weight: 700; letter-spacing: 0.07em; text-transform: uppercase; margin-bottom: 16px; }
  .mv-card p { font-size: 30px; font-weight: 300; line-height: 1.35; letter-spacing: -0.3px; }

  .marquee { overflow: hidden; margin-top: 40px; -webkit-mask-image: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent); mask-image: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent); }
  .track { display: flex; gap: 14px; width: max-content; animation: lp-scroll 28s linear infinite; }
  .marquee:hover .track { animation-play-state: paused; }
  .aud { white-space: nowrap; font-size: 16px; font-weight: 400; padding: 14px 24px; border-radius: 100px; border: 0.5px solid #E5E0D8; }
  @keyframes lp-scroll { to { transform: translateX(calc(-50% - 7px)); } }

  .founder { max-width: 760px; margin: 40px auto 0; background: rgba(255,255,255,0.72); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border: 0.5px solid #E5E0D8; border-radius: 20px; padding: 44px; text-align: left; }
  .founder h3 { font-size: 26px; font-weight: 700; letter-spacing: -0.5px; }
  .founder .role { font-size: 14px; font-weight: 700; color: #C05A2A; margin: 4px 0 18px; }
  .lp-root .founder p { font-size: 15.5px; line-height: 1.75; color: #6B6459; margin-bottom: 14px; }

  .cta { background: #1C1917; text-align: center; position: relative; overflow: hidden; min-height: 80vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 80px 48px; }
  .lp-root .cta-title { font-size: 52px; font-weight: 300; line-height: 1.18; letter-spacing: -1.5px; color: #FAF8F4; position: relative; margin-bottom: 28px; max-width: 760px; }
  .cta-title em { font-size: 1.1em; }
  .cta-btn { background: #FAF8F4; color: #1C1917; padding: 16px 40px; border-radius: 100px; font-size: 16px; font-weight: 700; border: none; letter-spacing: -0.3px; position: relative; }

  .lp-footer { text-align: center; padding: 24px 48px; font-size: 13px; color: #A89F94; border-top: 0.5px solid #E5E0D8; background: #FAF8F4; }

  @media (max-width: 1000px) {
    .flips { grid-template-columns: 1fr 1fr; }
  }
  @media (max-width: 900px) {
    .pillars { grid-template-columns: 1fr 1fr; }
    .feature-row { grid-template-columns: 1fr; gap: 36px; }
    .feature-row > .feature-visual, .feature-row.reverse > .feature-visual { order: 2; }
  }
  @media (max-width: 600px) {
    .lp-nav { padding: 14px 16px; }
    .nav-hide { display: none; }
    .hero, .demo-wrap, .band, .band-label, .cta, .lp-footer { padding-left: 16px; padding-right: 16px; }
    .sec-pad { padding: 56px 16px; }
    .pillars { grid-template-columns: 1fr; }
    .lp-root .hero-title { font-size: 32px; letter-spacing: -0.8px; }
    .lp-root .hero-sub { font-size: 19px; }
    .lp-root .sec-head h2.sec { font-size: 28px; }
    .mv-card { padding: 28px 24px; }
    .mv-card p { font-size: 22px; }
    .founder { padding: 28px; }
    .lp-root .cta-title { font-size: 34px; letter-spacing: -0.8px; }
  }
  @media (max-width: 560px) {
    .flips { grid-template-columns: 1fr; }
    .flip { height: 420px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .flip-inner, .front-img, .turn, .pfill { transition: none; }
    .flip:hover .flip-inner, .flip:hover .front-img { transform: none; }
    .flip[aria-pressed="true"] .flip-inner, .flip[aria-pressed="true"]:hover .flip-inner { transform: rotateY(180deg); }
    .track { animation: none; flex-wrap: wrap; width: auto; justify-content: center; }
    .track [aria-hidden="true"] { display: none; }
  }
`;

export default LandingPage;
