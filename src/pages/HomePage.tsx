import { ArrowRight, ArrowUpRight, BookOpenCheck, Check, Clock3, Flame, Medal, Sparkles, Target, Zap } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import type { Bootstrap } from '../types.js';
import { SymbolIcon } from '../components/SymbolIcon.js';

function ProgressRing({ value, size = 54 }: { value: number; size?: number }) {
  const radius = 19;
  const circumference = 2 * Math.PI * radius;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className="progress-ring" role="img" aria-label={`${Math.round(value * 100)} percent complete`}>
      <circle cx="24" cy="24" r={radius} fill="none" stroke="currentColor" strokeWidth="4" opacity=".16" />
      <circle cx="24" cy="24" r={radius} fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - value)} transform="rotate(-90 24 24)" />
      <text x="24" y="26.5" textAnchor="middle" className="ring-text">{Math.round(value * 100)}%</text>
    </svg>
  );
}

function formatDate() {
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());
}

export default function HomePage({ bootstrap, loading }: { bootstrap: Bootstrap; refresh: () => Promise<unknown>; loading: boolean }) {
  const navigate = useNavigate();
  const firstName = bootstrap.user.fullName.trim().split(/\s+/)[0] || 'Learner';
  const lesson = bootstrap.currentLesson;
  const parentUnit = bootstrap.units.find((unit) => unit.lessons.some((item) => item.id === lesson?.id));
  const completedRatio = bootstrap.stats.totalLessons ? bootstrap.stats.completedLessons / bootstrap.stats.totalLessons : 0;
  const earned = bootstrap.achievements.filter((item) => item.earnedAt).slice(0, 3);
  const currentQuests = bootstrap.dailyQuests;
  const maxWeekXp = Math.max(20, ...bootstrap.week.map((day) => day.xp));

  return (
    <div className="dashboard-page page-enter">
      <div className="page-heading dashboard-heading">
        <div><span className="eyebrow">{bootstrap.competition.name.toUpperCase()} · YOUR STUDY SPACE</span><h1>Good morning, {firstName}.</h1><p>A little progress today makes the hard problems feel closer.</p></div>
        <div className="date-stamp"><span className="date-dot" />{formatDate()}</div>
      </div>

      <section className="continue-hero" aria-labelledby="continue-title">
        <div className="hero-copy">
          <div className="hero-overline"><span className="hero-pulse" /> YOUR NEXT STEP <span className="hero-separator">/</span> {parentUnit?.title ?? 'Your learning journey'}</div>
          <h2 id="continue-title">{lesson ? lesson.title : 'Your journey is ready.'}</h2>
          <p>{lesson?.summary ?? 'Choose a lesson and start building your Olympiad toolkit.'}</p>
          <div className="hero-meta"><span><Clock3 size={14} /> {lesson?.estimatedMinutes ?? 8} min</span><span className="hero-meta-dot">·</span><span>Lesson {lesson?.number ?? 1} of {bootstrap.stats.totalLessons}</span></div>
          <div className="hero-progress-row"><div className="hero-progress-track"><span style={{ width: `${Math.max(completedRatio * 100, lesson?.status === 'in_progress' ? 8 : 0)}%` }} /></div><span>{bootstrap.stats.completedLessons}/{bootstrap.stats.totalLessons} lessons</span></div>
          <button className="button button-cream" onClick={() => lesson && navigate(`/lesson/${lesson.id}`)} disabled={!lesson || loading}>
            {loading ? 'Loading…' : lesson?.status === 'in_progress' ? 'Pick up where you left off' : 'Start this lesson'}<ArrowRight size={16} />
          </button>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="hero-orbit orbit-a" /><div className="hero-orbit orbit-b" />
          <div className="hero-sun"><div className="hero-sun-center">{parentUnit?.title === 'Number theory' ? 'n' : parentUnit?.title === 'Algebra' ? 'x' : parentUnit?.title === 'Geometry' ? '△' : '∑'}</div><span className="hero-sun-orbit orbit-label-one">01</span><span className="hero-sun-orbit orbit-label-two">02</span></div>
          <div className="hero-side-note"><span>THINK</span><span>·</span><span>TRY</span><span>·</span><span>GROW</span></div>
          <div className="hero-floating-note"><Sparkles size={13} /> One idea at a time</div>
        </div>
      </section>

      <section className="dashboard-stats" aria-label="Your learning at a glance">
        <article className="stat-card"><div className="stat-icon stat-icon-amber"><Zap size={17} /></div><div className="stat-copy"><span>Total experience</span><strong>{bootstrap.stats.xp.toLocaleString()} <small>XP</small></strong><div className="level-track"><span style={{ width: `${bootstrap.stats.xpIntoLevel / bootstrap.stats.xpToNextLevel * 100}%` }} /></div><small className="stat-foot">Level {bootstrap.stats.level} <span>·</span> {bootstrap.stats.xpToNextLevel - bootstrap.stats.xpIntoLevel} XP to next</small></div></article>
        <article className="stat-card"><div className="stat-icon stat-icon-orange"><Flame size={17} /></div><div className="stat-copy"><span>Learning streak</span><strong>{bootstrap.stats.currentStreak} <small>{bootstrap.stats.currentStreak === 1 ? 'day' : 'days'}</small></strong><small className="stat-foot">Best: {bootstrap.stats.bestStreak} days</small></div><div className="stat-card-trailing">{bootstrap.stats.currentStreak ? 'Keep it going' : 'Start today'}</div></article>
        <article className="stat-card"><div className="stat-icon stat-icon-green"><Target size={17} /></div><div className="stat-copy"><span>Topic mastery</span><strong>{Math.round(bootstrap.stats.topicMastery * 100)}<small>%</small></strong><small className="stat-foot">Across your active journey</small></div><ProgressRing value={bootstrap.stats.topicMastery} /></article>
      </section>

      <div className="dashboard-grid">
        <div className="dashboard-main-column">
          <section className="panel daily-panel">
            <div className="panel-heading"><div><span className="eyebrow">AIM FOR A LITTLE, OFTEN</span><h3>Today’s rhythm</h3></div><span className="daily-goal-pill">{Math.min(bootstrap.today.uniqueQuestions, bootstrap.user.dailyGoal)} / {bootstrap.user.dailyGoal} questions</span></div>
            <div className="daily-progress"><span style={{ width: `${Math.min(100, bootstrap.today.uniqueQuestions / bootstrap.user.dailyGoal * 100)}%` }} /></div>
            <div className="quest-list">
              {currentQuests.map((quest) => (
                <div className="quest-row" key={quest.id}>
                  <div className={`quest-symbol ${quest.progress >= quest.target ? 'quest-symbol-done' : ''}`}>{quest.progress >= quest.target ? <Check size={15} /> : <SymbolIcon name={quest.icon} size={16} />}</div>
                  <div className="quest-copy"><strong>{quest.title}</strong><span>{quest.detail}</span></div>
                  <div className="quest-progress-wrap"><div className="quest-progress"><span style={{ width: `${Math.min(100, quest.progress / quest.target * 100)}%` }} /></div><span>{Math.min(quest.progress, quest.target)}/{quest.target}</span></div>
                  <span className="quest-xp">+{quest.reward} XP</span>
                </div>
              ))}
            </div>
            <Link to="/practice" className="panel-inline-link">Go to practice <ArrowRight size={14} /></Link>
          </section>

          <section className="panel focus-panel">
            <div className="focus-copy"><span className="eyebrow">A GOOD NEXT FOCUS</span><h3>{bootstrap.units.filter((unit) => unit.mastery > 0).sort((a, b) => a.mastery - b.mastery)[0]?.title ?? parentUnit?.title ?? 'Number theory'}</h3><p>{bootstrap.stats.answeredQuestions ? 'A few targeted problems here could make the next unit feel more familiar.' : 'Start with one approachable lesson, then let your progress guide what comes next.'}</p><button className="text-action" onClick={() => navigate(parentUnit ? `/lesson/${parentUnit.lessons.find((item) => item.status === 'available' || item.status === 'in_progress')?.id ?? lesson?.id}` : '/journey')}>See your next step <ArrowRight size={14} /></button></div>
            <div className="focus-illustration"><div className="focus-arc focus-arc-one" /><div className="focus-arc focus-arc-two" /><span>{bootstrap.stats.answeredQuestions ? `${Math.round(bootstrap.stats.accuracy * 100)}%` : '01'}</span><small>{bootstrap.stats.answeredQuestions ? 'accuracy so far' : 'begin here'}</small></div>
          </section>

          <section className="panel achievements-panel">
            <div className="panel-heading"><div><span className="eyebrow">MILESTONES, NOT MEDALS</span><h3>Recent achievements</h3></div><Link to="/profile" className="icon-link" aria-label="View profile achievements"><ArrowUpRight size={17} /></Link></div>
            {earned.length ? <div className="achievement-row">{earned.map((item) => <div className="achievement-item" key={item.slug}><div className="achievement-icon"><SymbolIcon name={item.icon} size={19} /></div><div><strong>{item.title}</strong><span>{item.description}</span></div></div>)}</div> : <div className="empty-achievements"><span className="empty-medal"><Medal size={19} /></span><div><strong>Your first milestone is waiting.</strong><span>Finish a lesson to earn your first badge.</span></div><ArrowRight size={15} /></div>}
          </section>
        </div>

        <aside className="dashboard-side-column">
          <section className="panel week-panel">
            <div className="panel-heading"><div><span className="eyebrow">CONSISTENCY OVER INTENSITY</span><h3>This week</h3></div><span className="week-xp">{bootstrap.week.reduce((sum, day) => sum + day.xp, 0)} XP</span></div>
            <div className="week-chart" role="img" aria-label={`XP earned this week: ${bootstrap.week.reduce((sum, day) => sum + day.xp, 0)}`}>
              {bootstrap.week.map((day, index) => <div className="week-column" key={day.date}><div className="week-bar-wrap"><span className={`week-bar ${day.active ? 'week-bar-active' : ''} ${index === 6 ? 'week-bar-today' : ''}`} style={{ height: `${Math.max(8, (day.xp / maxWeekXp) * 100)}%` }} title={`${day.xp} XP`} /></div><span className={day.active ? 'week-label week-label-active' : 'week-label'}>{day.label.slice(0, 1)}</span></div>)}
            </div>
            <div className="week-caption"><span><i className="week-legend-dot" /> Learning activity</span><span>{bootstrap.week.filter((day) => day.active).length}/7 active days</span></div>
          </section>

          <section className="assessment-card">
            <span className="assessment-badge"><Clock3 size={13} /> COMING UP</span>
            <h3>Try a timed focus sprint</h3>
            <p>A short, original AMC-style set. Your answers wait until the end.</p>
            <div className="assessment-meta"><span>8 min</span><span>·</span><span>up to 6 questions</span></div>
            <button onClick={() => navigate('/practice', { state: { mode: 'timed' } })}>Explore practice <ArrowRight size={14} /></button>
            <span className="assessment-watermark">∑</span>
          </section>

          <section className="mini-unit-panel">
            <div className="mini-unit-heading"><span className="eyebrow">YOUR JOURNEY</span><Link to="/journey" className="text-action">View path <ArrowRight size={13} /></Link></div>
            <div className="mini-unit-list">{bootstrap.units.map((unit, index) => <div className="mini-unit" key={unit.id}><span className="mini-unit-dot" style={{ backgroundColor: unit.color }}><span>{index + 1}</span></span><div className="mini-unit-copy"><strong>{unit.shortTitle}</strong><span>{unit.completedCount}/{unit.lessonCount} lessons</span></div><div className="mini-unit-meter"><span style={{ width: `${unit.lessonCount ? unit.completedCount / unit.lessonCount * 100 : 0}%`, backgroundColor: unit.color }} /></div></div>)}</div>
          </section>
        </aside>
      </div>
      <div className="dashboard-disclaimer"><BookOpenCheck size={14} /> Sample AMC 10 learning path and questions are original, educational content — not official syllabus or exam material.</div>
    </div>
  );
}
