import { useState } from 'react';
import { ArrowRight, Check, Clock3, Sparkles } from 'lucide-react';
import { ApiError } from '../api.js';
import { Brand } from '../components/Brand.js';
import { SymbolIcon } from '../components/SymbolIcon.js';

const strands = [
  { title: 'Number Theory', detail: 'Patterns, primes & remainders', icon: 'hash', color: 'sage' },
  { title: 'Algebra', detail: 'Structure, equations & change', icon: 'sigma', color: 'blue' },
  { title: 'Geometry', detail: 'Shape, space & clear diagrams', icon: 'triangle', color: 'amber' },
  { title: 'Combinatorics', detail: 'Counting, cases & clever choices', icon: 'grid', color: 'plum' },
];

export default function WelcomePage({ onStart }: { onStart: () => Promise<void> }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  const start = async () => {
    setPending(true);
    setError('');
    try {
      await onStart();
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'competition_unavailable') {
        setError('The starter journey is temporarily unavailable. Please try again in a moment.');
      } else if (caught instanceof Error) {
        setError(caught.message);
      } else {
        setError('We could not start your journey. Please try again.');
      }
      setPending(false);
    }
  };

  return (
    <main className="welcome-page">
      <header className="welcome-header"><Brand /><span className="welcome-no-setup"><Sparkles size={14} /> START RIGHT AWAY</span></header>
      <div className="welcome-layout">
        <section className="welcome-hero">
          <span className="welcome-kicker"><span /> AMC 10 MATHEMATICS · A STARTER JOURNEY</span>
          <h1>A fresh start<br />for <em>big ideas.</em></h1>
          <p className="welcome-intro">Build the kind of problem-solving confidence that lasts. Begin with one clear lesson, get helpful feedback, and follow your curiosity from there.</p>
          <button className="button button-primary welcome-start-button" type="button" onClick={() => void start()} disabled={pending} aria-busy={pending}>
            {pending ? <><span className="button-spinner" /> Opening your study space…</> : <>Start my journey <ArrowRight size={17} /></>}
          </button>
          <p className="welcome-progress-note"><Check size={15} /> No account or password. Your progress is saved on this device.</p>
          {error && <div className="welcome-error" role="alert">{error}<button className="text-button" type="button" onClick={() => void start()} disabled={pending}>Try again</button></div>}
          <div className="welcome-promises"><div><span><Sparkles size={15} /></span><strong>Learn in steps</strong><small>Understand the idea before the practice.</small></div><div><span><Clock3 size={15} /></span><strong>Go at your pace</strong><small>Pick up whenever you’re ready.</small></div><div><span><Check size={15} /></span><strong>Keep your progress</strong><small>Your work stays in this browser.</small></div></div>
        </section>
        <aside className="welcome-journey-card" aria-label="AMC 10 starter journey preview">
          <div className="welcome-card-orbit welcome-card-orbit-one" /><div className="welcome-card-orbit welcome-card-orbit-two" />
          <div className="welcome-journey-top"><span className="welcome-journey-symbol"><SymbolIcon name="sigma" size={19} /></span><span>YOUR FIRST JOURNEY</span><i>READY</i></div>
          <div className="welcome-journey-copy"><span>MATHEMATICS · AMC 10</span><h2>Four ways to think.<br />One step at a time.</h2><p>A guided path through original sample material—not official past-paper content.</p></div>
          <div className="welcome-strands">{strands.map((strand, index) => <div className={`welcome-strand welcome-strand-${strand.color}`} key={strand.title}><span className="welcome-strand-number">0{index + 1}</span><span className="welcome-strand-icon"><SymbolIcon name={strand.icon} size={16} /></span><span className="welcome-strand-copy"><strong>{strand.title}</strong><small>{strand.detail}</small></span><ArrowRight size={14} className="welcome-strand-arrow" /></div>)}</div>
          <div className="welcome-first-step"><span className="welcome-first-step-icon"><Clock3 size={15} /></span><span><small>YOUR FIRST LESSON</small><strong>Remainders &amp; modular thinking</strong></span><i>8 MIN</i></div>
        </aside>
      </div>
      <footer className="welcome-footer"><span>AXIOM OLYMPIAD LEARNING</span><span>Original sample practice · Independent learning resource</span></footer>
    </main>
  );
}
