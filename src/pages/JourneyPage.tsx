import { ArrowRight, Check, CircleHelp, LockKeyhole, Sparkles } from 'lucide-react';
import type { CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Bootstrap, LessonSummary, LessonStatus } from '../types.js';
import { SymbolIcon } from '../components/SymbolIcon.js';

function LessonNode({ lesson, unitColor }: { lesson: LessonSummary; unitColor: string }) {
  const navigate = useNavigate();
  const isLocked = lesson.status === 'locked';
  const statusLabel: Record<LessonStatus, string> = {
    locked: 'Locked', available: 'Ready to start', in_progress: 'In progress', completed: 'Completed', mastered: 'Mastered',
  };
  const statusIcon = lesson.status === 'locked' ? <LockKeyhole size={15} />
    : lesson.status === 'completed' || lesson.status === 'mastered' ? <Check size={17} />
      : lesson.status === 'in_progress' ? <Sparkles size={16} /> : <span>{String(lesson.number).padStart(2, '0')}</span>;
  return (
    <div className={`lesson-node-row lesson-node-${lesson.status}`}>
      <div className="lesson-node-column"><button className="journey-node" style={{ '--node-color': unitColor } as CSSProperties} disabled={isLocked} onClick={() => navigate(`/lesson/${lesson.id}`)} aria-label={`${lesson.title}, ${statusLabel[lesson.status]}`}><span>{statusIcon}</span></button><span className="journey-node-line" /></div>
      <button className="journey-lesson-card" disabled={isLocked} onClick={() => navigate(`/lesson/${lesson.id}`)}>
        <span className="journey-lesson-status">{statusLabel[lesson.status]}{lesson.status === 'mastered' && <span className="mastery-check"> · {Math.round(lesson.mastery * 100)}% mastery</span>}</span>
        <strong>{lesson.title}</strong><span className="journey-lesson-summary">{lesson.summary}</span>
        <span className="journey-lesson-meta">{lesson.estimatedMinutes} min <span>·</span> Difficulty {lesson.difficulty}/5</span>
        {!isLocked && <span className="journey-card-arrow"><ArrowRight size={15} /></span>}
      </button>
    </div>
  );
}

export default function JourneyPage({ bootstrap }: { bootstrap: Bootstrap }) {
  const current = bootstrap.currentLesson;
  const progress = bootstrap.stats.totalLessons ? bootstrap.stats.completedLessons / bootstrap.stats.totalLessons : 0;
  const allUnitsDone = bootstrap.units.length > 0 && bootstrap.units.every((unit) => unit.completedCount === unit.lessonCount);
  return (
    <div className="journey-page page-enter">
      <div className="page-heading journey-page-heading">
        <div><span className="eyebrow">{bootstrap.competition.subject.toUpperCase()} · {bootstrap.competition.name.toUpperCase()}</span><h1>Your learning journey</h1><p>A guided path through the ideas behind the problems. Move forward when you’re ready; come back whenever you need.</p></div>
        <div className="journey-overall-progress"><div className="journey-progress-number">{Math.round(progress * 100)}<small>%</small></div><span>of this path complete</span><div className="journey-progress-track"><span style={{ width: `${progress * 100}%` }} /></div><strong>{bootstrap.stats.completedLessons} of {bootstrap.stats.totalLessons} lessons</strong></div>
      </div>

      {current && <section className="journey-next-card"><div className="journey-next-icon"><Sparkles size={18} /></div><div><span className="eyebrow">YOUR NEXT STEP</span><strong>{current.title}</strong><span>{current.summary}</span></div><Link className="button button-primary" to={`/lesson/${current.id}`}>{current.status === 'in_progress' ? 'Continue lesson' : 'Start lesson'}<ArrowRight size={15} /></Link></section>}

      <div className="journey-content-grid">
        <section className="journey-path-column" aria-label="Lesson path">
          <div className="journey-path-intro"><div><span className="eyebrow">THE PATH</span><h2>Build your toolkit</h2></div><span className="journey-duration">{bootstrap.stats.totalLessons} short lessons <span>·</span> go at your pace</span></div>
          {bootstrap.units.map((unit, index) => {
            const complete = unit.completedCount === unit.lessonCount;
            return (
              <article className={`unit-path-card ${complete ? 'unit-path-complete' : ''}`} key={unit.id} style={{ '--unit-color': unit.color } as CSSProperties}>
                <div className="unit-path-heading">
                  <div className="unit-number-badge">{complete ? <Check size={17} /> : String(index + 1).padStart(2, '0')}</div>
                  <div className="unit-path-title"><span className="eyebrow">UNIT {String(index + 1).padStart(2, '0')}</span><h3>{unit.title}</h3><p>{unit.description}</p></div>
                  <div className="unit-path-score"><span>{Math.round(unit.mastery * 100)}%</span><small>topic mastery</small><div className="unit-mini-progress"><span style={{ width: `${unit.lessonCount ? unit.completedCount / unit.lessonCount * 100 : 0}%` }} /></div></div>
                </div>
                <div className="unit-lesson-path">
                  {unit.lessons.map((lesson) => <LessonNode key={lesson.id} lesson={lesson} unitColor={unit.color} />)}
                </div>
                {complete && <div className="unit-completion-note"><span><Check size={13} /></span> Unit complete — revisit any lesson to keep the ideas fresh.</div>}
              </article>
            );
          })}
          {allUnitsDone && <div className="journey-finish-card"><span><Sparkles size={18} /></span><div><strong>That’s a thoughtful foundation.</strong><small>Your next chapter will be ready here as this curriculum grows.</small></div></div>}
          <div className="journey-footnote"><CircleHelp size={14} /><span>Progress follows lesson prerequisites. Complete each lesson’s practice check to unlock the next one; completed lessons stay open for review.</span></div>
        </section>

        <aside className="journey-side-column">
          <div className="journey-side-card journey-side-highlight"><div className="journey-side-icon"><SymbolIcon name="target" size={18} /></div><span className="eyebrow">MASTERY, NOT MILEAGE</span><h3>Practice until it feels clear.</h3><p>One correct answer completes a lesson. Two correct answers build a stronger mastery signal — and your topic estimates improve with every attempt.</p><div className="mastery-legend"><span><i className="legend-dot legend-dot-complete" /> Completed</span><span><i className="legend-dot legend-dot-mastered" /> Mastered</span></div></div>
          <div className="journey-side-card"><span className="eyebrow">TODAY’S TARGET</span><div className="journey-daily-target"><strong>{bootstrap.today.uniqueQuestions}</strong><span>of {bootstrap.user.dailyGoal} questions</span></div><div className="daily-progress"><span style={{ width: `${Math.min(100, bootstrap.today.uniqueQuestions / bootstrap.user.dailyGoal * 100)}%` }} /></div><p>Small, regular practice is more useful than a big burst once in a while.</p><Link to="/practice" className="text-action">Choose a practice set <ArrowRight size={14} /></Link></div>
          <div className="journey-source-note"><BookOpenTextIcon /><div><strong>Original sample content</strong><span>This AMC 10 pathway is a starter curriculum, not an official syllabus or set of official questions.</span></div></div>
        </aside>
      </div>
    </div>
  );
}

function BookOpenTextIcon() { return <span className="source-note-icon"><SymbolIcon name="book-open-text" size={16} /></span>; }
