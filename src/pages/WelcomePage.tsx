import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Clock3, LockKeyhole, Sparkles } from 'lucide-react';
import { ApiError, postJson } from '../api.js';
import { Brand } from '../components/Brand.js';
import { SymbolIcon } from '../components/SymbolIcon.js';
import type { User } from '../types.js';

const strands = [
  { title: 'Number Theory', detail: 'Patterns, primes & remainders', icon: 'hash', color: 'sage' },
  { title: 'Algebra', detail: 'Structure, equations & change', icon: 'sigma', color: 'blue' },
  { title: 'Geometry', detail: 'Shape, space & clear diagrams', icon: 'triangle', color: 'amber' },
  { title: 'Combinatorics', detail: 'Counting, cases & clever choices', icon: 'grid', color: 'plum' },
];

type Mode = 'guest' | 'create' | 'signin';

export default function WelcomePage({ onStart, onAuthenticated }: {
  onStart: () => Promise<void>;
  onAuthenticated: (user: User) => void;
}) {
  const [mode, setMode] = useState<Mode>('guest');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ fullName: '', email: '', password: '', grade: '' });

  const describe = (caught: unknown, fallback: string) => {
    if (caught instanceof ApiError && caught.code === 'competition_unavailable') {
      return 'The starter journey is temporarily unavailable. Please try again in a moment.';
    }
    return caught instanceof Error ? caught.message : fallback;
  };

  const start = async () => {
    setPending(true);
    setError('');
    try {
      await onStart();
    } catch (caught) {
      setError(describe(caught, 'We could not start your journey. Please try again.'));
      setPending(false);
    }
  };

  const authenticate = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError('');
    try {
      const payload = mode === 'create'
        ? { fullName: form.fullName, email: form.email, password: form.password, grade: form.grade, competitionSlug: 'amc-10' }
        : { email: form.email, password: form.password };
      const result = await postJson(mode === 'create' ? '/auth/register' : '/auth/login', payload) as { user?: User };
      if (!result?.user) throw new Error('We could not open your study space. Please try again.');
      onAuthenticated(result.user);
    } catch (caught) {
      setError(describe(caught, 'We could not sign you in. Please try again.'));
      setPending(false);
    }
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setError('');
  };

  return (
    <main className="welcome-page">
      <header className="welcome-header">
        <Brand />
        <span className="welcome-no-setup"><Sparkles size={14} /> START RIGHT AWAY</span>
      </header>
      <div className="welcome-layout">
        <section className="welcome-hero">
          <span className="welcome-kicker"><span /> AMC 10 MATHEMATICS · A STARTER JOURNEY</span>
          <h1>A fresh start<br />for <em>big ideas.</em></h1>
          <p className="welcome-intro">Build the kind of problem-solving confidence that lasts. Begin with one clear lesson, get helpful feedback, and follow your curiosity from there.</p>

          {mode === 'guest' ? (
            <>
              <button className="button button-primary welcome-start-button" type="button" onClick={() => void start()} disabled={pending} aria-busy={pending}>
                {pending ? <><span className="button-spinner" /> Opening your study space…</> : <>Start my journey <ArrowRight size={17} /></>}
              </button>
              <p className="welcome-progress-note"><Check size={15} /> No account needed. Add one later to keep your progress anywhere.</p>
            </>
          ) : (
            <form className="welcome-auth-form" onSubmit={authenticate}>
              <div className="welcome-auth-head">
                <strong>{mode === 'create' ? 'Create your account' : 'Welcome back'}</strong>
                <button type="button" className="text-button" onClick={() => switchMode('guest')}>Cancel</button>
              </div>
              {mode === 'create' && (
                <>
                  <label className="field-label">Your name
                    <input value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} required minLength={2} maxLength={60} autoComplete="name" placeholder="Jordan Learner" />
                  </label>
                  <label className="field-label">Grade (optional)
                    <select value={form.grade} onChange={(event) => setForm({ ...form, grade: event.target.value })}>
                      <option value="">Not set</option>
                      {['6', '7', '8', '9', '10', '11', '12', 'Other'].map((value) => <option key={value} value={value}>{value === 'Other' ? 'Other' : `Grade ${value}`}</option>)}
                    </select>
                  </label>
                </>
              )}
              <label className="field-label">Email
                <input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required maxLength={254} autoComplete="email" placeholder="you@example.com" />
              </label>
              <label className="field-label">Password
                <input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required minLength={8} maxLength={128} autoComplete={mode === 'create' ? 'new-password' : 'current-password'} placeholder={mode === 'create' ? 'At least 8 characters' : 'Your password'} />
              </label>
              <button className="button button-primary full-width" type="submit" disabled={pending}>
                {pending ? <><span className="button-spinner" /> One moment…</> : <>{mode === 'create' ? 'Create account' : 'Sign in'} <ArrowRight size={16} /></>}
              </button>
              <p className="welcome-auth-fineprint"><LockKeyhole size={12} /> {mode === 'create' ? 'Your password is stored as a salted hash.' : 'Your progress is waiting for you.'}</p>
            </form>
          )}

          {error && <div className="welcome-error" role="alert">{error}<button className="text-button" type="button" onClick={() => (mode === 'guest' ? void start() : undefined)} disabled={pending}>{mode === 'guest' ? 'Try again' : 'Dismiss'}</button></div>}

          {mode === 'guest' && (
            <div className="welcome-auth-switch">
              <span>Already have an account?</span>
              <button type="button" className="text-button" onClick={() => switchMode('signin')}>Sign in</button>
              <span className="welcome-auth-divider">·</span>
              <button type="button" className="text-button" onClick={() => switchMode('create')}>Create an account</button>
            </div>
          )}

          <div className="welcome-promises">
            <div><span><Sparkles size={15} /></span><strong>Learn in steps</strong><small>Understand the idea before the practice.</small></div>
            <div><span><Clock3 size={15} /></span><strong>Go at your pace</strong><small>Pick up whenever you’re ready.</small></div>
            <div><span><Check size={15} /></span><strong>Keep your progress</strong><small>Saved on this device, or to your account.</small></div>
          </div>
        </section>
        <aside className="welcome-journey-card" aria-label="AMC 10 starter journey preview">
          <div className="welcome-card-orbit welcome-card-orbit-one" /><div className="welcome-card-orbit welcome-card-orbit-two" />
          <div className="welcome-journey-top"><span className="welcome-journey-symbol"><SymbolIcon name="sigma" size={19} /></span><span>YOUR FIRST JOURNEY</span><i>READY</i></div>
          <div className="welcome-journey-copy"><span>MATHEMATICS · AMC 10</span><h2>Four ways to think.<br />One step at a time.</h2><p>A guided path through original sample material—not official past-paper content.</p></div>
          <div className="welcome-strands">{strands.map((strand, index) => <div className={`welcome-strand welcome-strand-${strand.color}`} key={strand.title}><span className="welcome-strand-number">0{index + 1}</span><span className="welcome-strand-icon"><SymbolIcon name={strand.icon} size={16} /></span><span className="welcome-strand-copy"><strong>{strand.title}</strong><small>{strand.detail}</small></span><ArrowRight size={14} className="welcome-strand-arrow" /></div>)}</div>
          <div className="welcome-first-step"><span className="welcome-first-step-icon"><Clock3 size={15} /></span><span><small>YOUR FIRST LESSON</small><strong>Remainders &amp; modular thinking</strong></span><i>8 MIN</i></div>
        </aside>
      </div>
      <footer className="welcome-footer">
        <span>AXIOM OLYMPIAD LEARNING</span>
        <span className="welcome-footer-links">
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
          <span>Original sample practice · Independent learning resource</span>
        </span>
      </footer>
    </main>
  );
}
