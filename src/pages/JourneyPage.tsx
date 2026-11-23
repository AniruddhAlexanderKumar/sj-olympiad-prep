import { ArrowRight, Check, CircleHelp, LockKeyhole, Sparkles } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import type { Bootstrap, LessonStatus, LessonSummary } from '../types.js';

const statusLabel: Record<LessonStatus, string> = {
  locked: 'Locked',
  available: 'Ready',
  in_progress: 'In progress',
  completed: 'Complete',
  mastered: 'Mastered',
};

function LessonRow({ lesson, onOpen }: { lesson: LessonSummary; onOpen: (lesson: LessonSummary) => void }) {
  const done = lesson.status === 'completed' || lesson.status === 'mastered';
  const locked = lesson.status === 'locked';
  return (
    <li>
      <button
        type="button"
        className={`path-lesson path-lesson-${lesson.status}`}
        disabled={locked}
        onClick={() => onOpen(lesson)}
        aria-label={`${lesson.title}, ${statusLabel[lesson.status]}`}
      >
        <span className="path-lesson-number">
          {done ? <Check size={14} /> : locked ? <LockKeyhole size={13} /> : String(lesson.number).padStart(2, '0')}
        </span>
        <span className="path-lesson-copy">
          <strong>{lesson.title}</strong>
          <span>{lesson.summary}</span>
        </span>
        <span className="path-lesson-meta">{lesson.estimatedMinutes} min</span>
        <span className={`path-lesson-status path-status-${lesson.status}`}>{statusLabel[lesson.status]}</span>
        {!locked && <ArrowRight size={15} className="path-lesson-arrow" />}
      </button>
    </li>
  );
}

export default function JourneyPage({ bootstrap }: { bootstrap: Bootstrap }) {
  const navigate = useNavigate();
  const current = bootstrap.currentLesson;
  const progress = bootstrap.stats.totalLessons ? bootstrap.stats.completedLessons / bootstrap.stats.totalLessons : 0;
  const totalMinutes = bootstrap.units.reduce((sum, unit) => sum + unit.estimatedMinutes, 0);

  return (
    <div className="journey-page page-enter">
      <div className="page-heading journey-page-heading">
        <div>
          <span className="eyebrow">{bootstrap.competition.subject.toUpperCase()} · {bootstrap.competition.name.toUpperCase()}</span>
          <h1>Your learning journey</h1>
          <p>One lesson at a time, in order. Finish the practice in each lesson to unlock the next one.</p>
        </div>
        <div className="journey-overall-progress">
          <div className="journey-progress-number">{Math.round(progress * 100)}<small>%</small></div>
          <span>of this path complete</span>
          <div className="journey-progress-track"><span style={{ width: `${progress * 100}%` }} /></div>
          <strong>{bootstrap.stats.completedLessons} of {bootstrap.stats.totalLessons} lessons</strong>
        </div>
      </div>

      {current && (
        <section className="journey-next-card">
          <div className="journey-next-icon"><Sparkles size={18} /></div>
          <div>
            <span className="eyebrow">YOUR NEXT STEP</span>
            <strong>{current.title}</strong>
            <span>{current.summary}</span>
          </div>
          <Link className="button button-primary" to={`/lesson/${current.id}`}>
            {current.status === 'in_progress' ? 'Continue lesson' : 'Start lesson'}<ArrowRight size={15} />
          </Link>
        </section>
      )}

      <div className="simple-path">
        {bootstrap.units.map((unit, unitIndex) => {
          const complete = unit.lessonCount > 0 && unit.completedCount === unit.lessonCount;
          return (
            <section className={`path-unit ${complete ? 'path-unit-complete' : ''}`} key={unit.id}>
              <header className="path-unit-head">
                <span className="path-unit-index">{complete ? <Check size={14} /> : String(unitIndex + 1).padStart(2, '0')}</span>
                <div className="path-unit-title">
                  <h2>{unit.title}</h2>
                  <p>{unit.description}</p>
                </div>
                <span className="path-unit-progress">{unit.completedCount}/{unit.lessonCount} lessons</span>
              </header>
              <ol className="path-list">
                {unit.lessons.map((lesson) => <LessonRow key={lesson.id} lesson={lesson} onOpen={(next) => navigate(`/lesson/${next.id}`)} />)}
              </ol>
            </section>
          );
        })}
      </div>

      <div className="journey-footnote">
        <CircleHelp size={14} />
        <span>{bootstrap.stats.totalLessons} short lessons · about {totalMinutes} minutes of reading · go at your own pace. One correct answer completes a lesson; two build a stronger mastery signal.</span>
      </div>
    </div>
  );
}
