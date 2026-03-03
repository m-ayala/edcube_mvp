// frontend/src/components/pages/LandingPage.jsx

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginTeacher, resendVerificationEmail } from '../../firebase/authService';
import './LandingPage.css';

const API_BASE = `${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'}/api`;

export default function LandingPage() {
  const navigate = useNavigate();

  useEffect(() => { document.title = 'EdCube — A Studio for Educators'; }, []);

  const [modalOpen, setModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('login');

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [showResend, setShowResend] = useState(false);

  const [ctName, setCtName] = useState('');
  const [ctEmail, setCtEmail] = useState('');
  const [ctOrg, setCtOrg] = useState('');
  const [ctMsg, setCtMsg] = useState('');
  const [ctLoading, setCtLoading] = useState(false);
  const [ctSuccess, setCtSuccess] = useState(false);
  const [ctError, setCtError] = useState('');

  const openModal = useCallback((tab = 'login') => {
    setActiveTab(tab);
    setModalOpen(true);
    document.body.style.overflow = 'hidden';
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    document.body.style.overflow = '';
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') closeModal(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [closeModal]);

  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  const handleLogin = async () => {
    setLoginError('');
    setShowResend(false);
    if (!loginEmail || !loginPassword) { setLoginError('Please enter your email and password.'); return; }
    setLoginLoading(true);
    try {
      await loginTeacher(loginEmail, loginPassword);
      closeModal();
      navigate('/my-courses');
    } catch (err) {
      setLoginError(err.message || 'Login failed. Please try again.');
      if (err.message?.includes('verify your email')) setShowResend(true);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleResend = async () => {
    setLoginLoading(true);
    try {
      await resendVerificationEmail();
      setLoginError('Verification email sent — check your inbox.');
      setShowResend(false);
    } catch (err) {
      setLoginError(err.message);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleContact = async () => {
    setCtError('');
    if (!ctName.trim() || !ctEmail.trim() || !ctMsg.trim()) {
      setCtError('Please fill in your name, email, and message.');
      return;
    }
    setCtLoading(true);
    try {
      await fetch(`${API_BASE}/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: ctName, org: ctOrg, email: ctEmail, message: ctMsg, type: 'demo' }),
      });
      setCtSuccess(true);
    } catch {
      setCtError('Something went wrong. Please try again.');
    } finally {
      setCtLoading(false);
    }
  };

  const features = [
    {
      emoji: '📂',
      color: 'pink',
      title: 'Build from anything.',
      body: 'Start from a blank topic, paste in your existing agenda, or upload your Google Docs and Sheets. EdCube reads what you have and builds from there.',
    },
    {
      emoji: '✨',
      color: 'blue',
      title: 'AI does the heavy lifting.',
      body: 'EdCube generates a structured course with sections, subsections, and learning objectives grounded in a holistic pedagogical framework. You review and own every decision.',
    },
    {
      emoji: '🎯',
      color: 'green',
      title: 'Resources, curated.',
      body: 'For every section of your course, EdCube surfaces age-appropriate videos, worksheets, and activities. No more searching YouTube for an hour.',
    },
    {
      emoji: '📤',
      color: 'yellow',
      title: 'Share across your organization.',
      body: 'Publish a course to your org and any teacher can access it. Your best work does not stay in a folder on your laptop. It lives where your colleagues can find it.',
    },
    {
      emoji: '🤝',
      color: 'teal',
      title: 'Fork and collaborate.',
      body: 'See a course another teacher built? Fork it, make it yours, and build on it. Good curriculum compounds when teachers work together.',
    },
    {
      emoji: '🔖',
      color: 'purple',
      title: 'Save what matters.',
      body: 'Keep a personal resource library of links, videos, and references you want to revisit. Everything in one place for when you sit down to design your next course.',
    },
  ];

  return (
    <div className="lp-root">

      {/* NAV */}
      <nav className="lp-nav">
        <a className="lp-nav-brand" href="#hero" onClick={(e) => { e.preventDefault(); scrollTo('hero'); }}>
          <img className="lp-logo-icon" src="/edcube-logo.png" alt="EdCube logo" />
          <span className="lp-brand-name">EdCube</span>
        </a>
        <ul className="lp-nav-links">
          <li><button className="lp-nav-btn-ghost" onClick={() => openModal('contact')}>Request a Demo</button></li>
          <li><button className="lp-nav-btn" onClick={() => openModal('login')}>Log In</button></li>
        </ul>
      </nav>

      {/* HERO */}
      <section className="lp-hero" id="hero">
        <div className="lp-blob lp-blob-yellow" />
        <div className="lp-blob lp-blob-blue" />
        <div className="lp-blob lp-blob-pink" />
        <div className="lp-blob lp-blob-teal" />
        <img className="lp-hero-logo-img" src="/edcube-logo.png" alt="EdCube" />
        <div className="lp-hero-tag">A studio for creators</div>
        <h1 className="lp-hero-headline">EdCube</h1>
        <p className="lp-hero-tagline">Where great curriculum gets made.</p>
        <div className="lp-hero-actions">
          <button className="lp-btn lp-btn-dark"  onClick={() => openModal('login')}>Log In to EdCube</button>
          <button className="lp-btn lp-btn-ghost" onClick={() => openModal('contact')}>Request a Demo</button>
        </div>
      </section>

      <hr className="lp-rule" />

      {/* WHAT IT IS */}
      <section className="lp-section lp-what" id="what">
        <div>
          <div className="lp-sec-tag">What it is</div>
          <h2 className="lp-sec-title">A creative workspace for educators.</h2>
        </div>
        <p className="lp-what-body">
          You bring the knowledge of your students. EdCube gives you the tools to shape it into curriculum that actually develops the whole child: their knowledge, their critical thinking, their sense of self, and their ability to apply what they learn in the real world.
        </p>
      </section>

      <hr className="lp-rule" />

      {/* FEATURES */}
      <section className="lp-section lp-features" id="solution">
        <div className="lp-features-intro">
          <div>
            <div className="lp-sec-tag">What you can do</div>
            <h2 className="lp-sec-title">Built around how teachers actually work.</h2>
          </div>
          <p className="lp-features-subtext">
            Every feature exists to save time, raise the bar on curriculum quality, and keep teachers in control.
          </p>
        </div>

        {features.map((f, i) => (
          <div key={f.title} className={`lp-feature${i % 2 === 1 ? ' lp-feature-flip' : ''}`}>
            <div className={`lp-feature-img lp-img-${f.color}`}>{f.emoji}</div>
            <div className="lp-feature-text">
              <div className="lp-feature-accent" style={{ background: `var(--${f.color})` }} />
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </div>
          </div>
        ))}
      </section>

      {/* CTA */}
      <section className="lp-section lp-cta" id="cta">
        <div className="lp-blob lp-blob-yellow" />
        <div className="lp-blob lp-blob-pink" />
        <div className="lp-sec-tag">Get started</div>
        <h2 className="lp-sec-title">Your studio is ready.</h2>
        <p className="lp-cta-body">
          Already using EdCube at your organization? Log in. Want to bring EdCube to your program? We would love to hear from you.
        </p>
        <div className="lp-hero-actions">
          <button className="lp-btn lp-btn-dark"  onClick={() => openModal('login')}>Log In</button>
          <button className="lp-btn lp-btn-ghost" onClick={() => openModal('contact')}>Request a Demo</button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="lp-footer">
        <span className="lp-footer-brand">EdCube</span>
        <span>Built for teachers at the India Community Center, Milpitas.</span>
        <span>© 2026 EdCube</span>
      </footer>

      {/* MODAL */}
      <div
        className={`lp-overlay${modalOpen ? ' open' : ''}`}
        onClick={(e) => { if (e.target.classList.contains('lp-overlay')) closeModal(); }}
      >
        <div className="lp-modal">
          <button className="lp-modal-x" onClick={closeModal}>×</button>

          <div className="lp-modal-brand">
            <img style={{ width: 28, height: 28, objectFit: 'contain' }} src="/edcube-logo.png" alt="" />
            <span className="lp-modal-brand-name">EdCube</span>
          </div>

          <div className="lp-modal-tabs">
            <button className={`lp-tab-btn${activeTab === 'login'   ? ' active' : ''}`} onClick={() => setActiveTab('login')}>Log In</button>
            <button className={`lp-tab-btn${activeTab === 'contact' ? ' active' : ''}`} onClick={() => setActiveTab('contact')}>Request a Demo</button>
          </div>

          {/* LOGIN */}
          <div className={`lp-panel${activeTab === 'login' ? ' active' : ''}`}>
            <h3>Welcome back</h3>
            <p className="lp-sub">Log in with your organization's EdCube account.</p>
            {loginError && <div className="lp-error-msg">{loginError}</div>}
            <div className="lp-field">
              <label>Email</label>
              <input type="email" placeholder="you@indiacc.org" value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()} />
            </div>
            <div className="lp-field">
              <label>Password</label>
              <input type="password" placeholder="••••••••" value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()} />
            </div>
            {showResend && (
              <button className="lp-modal-submit" style={{ background: '#f0ad4e', marginBottom: '0.6rem' }}
                onClick={handleResend} disabled={loginLoading}>
                Resend Verification Email
              </button>
            )}
            <button className="lp-modal-submit" onClick={handleLogin} disabled={loginLoading}>
              {loginLoading ? 'Logging in…' : 'Log In'}
            </button>
            <div className="lp-divider-or">or</div>
            <p className="lp-panel-footer-text">
              Don't have an account?{' '}
              <button onClick={() => setActiveTab('contact')}>Request a demo</button>
            </p>
          </div>

          {/* DEMO REQUEST */}
          <div className={`lp-panel${activeTab === 'contact' ? ' active' : ''}`}>
            {ctSuccess ? (
              <div className="lp-success-state">
                <div className="lp-check-circle">✓</div>
                <h3>Message received!</h3>
                <p>We'll be in touch within a couple of days to set something up.</p>
              </div>
            ) : (
              <>
                <h3>Request a demo</h3>
                <p className="lp-sub">Tell us a bit about your program and we'll set up a session.</p>
                {ctError && <div className="lp-error-msg">{ctError}</div>}
                <div className="lp-field">
                  <label>Your Name</label>
                  <input type="text" placeholder="Jane Smith" value={ctName} onChange={(e) => setCtName(e.target.value)} />
                </div>
                <div className="lp-field">
                  <label>Email</label>
                  <input type="email" placeholder="jane@yourorg.org" value={ctEmail} onChange={(e) => setCtEmail(e.target.value)} />
                </div>
                <div className="lp-field">
                  <label>Organization</label>
                  <input type="text" placeholder="Your school or program" value={ctOrg} onChange={(e) => setCtOrg(e.target.value)} />
                </div>
                <div className="lp-field">
                  <label>Message</label>
                  <textarea placeholder="What are you teaching, and what would you love to do better?"
                    value={ctMsg} onChange={(e) => setCtMsg(e.target.value)} />
                </div>
                <button className="lp-modal-submit" onClick={handleContact} disabled={ctLoading}>
                  {ctLoading ? 'Sending…' : 'Send Request'}
                </button>
              </>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
