import { useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, Check, ChevronRight, Flame, LockKeyhole, Medal, Settings2, ShieldCheck, Sparkles, Target, Trophy, UsersRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { patchJson } from '../api.js';
import type { Bootstrap, User } from '../types.js';
import { SymbolIcon } from '../components/SymbolIcon.js';

export default function ProfilePage({ bootstrap, refresh, onUserUpdated }: { bootstrap: Bootstrap; refresh: () => Promise<unknown>; onUserUpdated: (user: User) => void }) {
  const [fullName, setFullName] = useState(bootstrap.user.fullName);
  const [grade, setGrade] = useState(bootstrap.user.grade);
  const [dailyGoal, setDailyGoal] = useState(bootstrap.user.dailyGoal);
  const [theme, setTheme] = useState(bootstrap.user.theme);
  const [leaderboardOptIn, setLeaderboardOptIn] = useState(bootstrap.user.leaderboardOptIn);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    setFullName(bootstrap.user.fullName);
    setGrade(bootstrap.user.grade);
    setDailyGoal(bootstrap.user.dailyGoal);
    setTheme(bootstrap.user.theme);
    setLeaderboardOptIn(bootstrap.user.leaderboardOptIn);
  }, [bootstrap.user]);
  const earned = bootstrap.achievements.filter((item) => item.earnedAt);
  const locked = bootstrap.achievements.filter((item) => !item.earnedAt);
  const accuracy = Math.round(bootstrap.stats.accuracy * 100);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSavedMessage('');
    try {
      const result = await patchJson('/profile', { fullName, grade, dailyGoal: Number(dailyGoal), theme, leaderboardOptIn }) as { user: User };
      onUserUpdated(result.user);
      await refresh();
      setSavedMessage('Your study preferences are saved.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Your settings could not be saved.');
    } finally { setSaving(false); }
  };

  return (
    <div className="profile-page page-enter">
      <div className="page-heading profile-heading"><div><span className="eyebrow">YOUR LEARNING, IN CONTEXT</span><h1>Progress worth keeping.</h1><p>Skills grow over time. Here’s a record of the work you’ve put in.</p></div><Link className="button button-secondary" to="/journey">View your journey<ArrowRight size={15} /></Link></div>
      <section className="profile-overview-card"><div className="profile-identity"><span className="profile-avatar">{bootstrap.user.fullName.trim().charAt(0).toUpperCase()}</span><div><span className="eyebrow">{bootstrap.competition.name} LEARNER</span><h2>{bootstrap.user.fullName}</h2><span>{bootstrap.user.grade ? `Grade ${bootstrap.user.grade} · ` : ''}{bootstrap.user.email}</span></div></div><div className="profile-level"><div className="profile-level-heading"><span>LEVEL {bootstrap.stats.level}</span><strong>{bootstrap.stats.xp} <small>XP</small></strong></div><div className="level-track"><span style={{ width: `${bootstrap.stats.xpIntoLevel / bootstrap.stats.xpToNextLevel * 100}%` }} /></div><span>{bootstrap.stats.xpToNextLevel - bootstrap.stats.xpIntoLevel} XP until level {bootstrap.stats.level + 1}</span></div><div className="profile-overview-metrics"><div><span><Flame size={15} /> STREAK</span><strong>{bootstrap.stats.currentStreak}<small> days</small></strong></div><div><span><BookIcon /> LESSONS</span><strong>{bootstrap.stats.completedLessons}<small> / {bootstrap.stats.totalLessons}</small></strong></div><div><span><Target size={15} /> ACCURACY</span><strong>{accuracy}<small>%</small></strong></div></div></section>

      <div className="profile-layout-grid">
        <main className="profile-main-column">
          <section className="panel profile-calendar-panel"><div className="panel-heading"><div><span className="eyebrow">SHOWING UP ADDS UP</span><h3>Your learning rhythm</h3></div><span className="calendar-legend"><i /> Active day</span></div><div className="activity-calendar-weekdays">{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => <span key={`${day}${index}`}>{day}</span>)}</div><div className="activity-calendar-grid">{Array.from({ length: ((bootstrap.calendar[0]?.weekday ?? 1) + 6) % 7 }, (_, index) => <span key={`blank-${index}`} className="activity-day activity-day-blank" />)}{bootstrap.calendar.map((day) => <span key={day.date} className={`activity-day ${day.active ? `activity-day-${Math.min(4, Math.max(1, Math.ceil(day.questions / 2)))}` : ''}`} title={`${day.date} · ${day.questions} question attempts · ${day.xp} XP`} aria-label={`${day.date}${day.active ? ', active' : ', no activity'}`}><span>{day.day}</span>{day.active && <i />}</span>)}</div><div className="calendar-caption"><span>PAST 28 DAYS</span><span>{bootstrap.calendar.filter((day) => day.active).length} active days <span>·</span> {bootstrap.stats.bestStreak} day best streak</span></div></section>

          <section className="panel profile-mastery-panel"><div className="panel-heading"><div><span className="eyebrow">HOW THE IDEAS ARE STICKING</span><h3>Topic mastery</h3></div><span className="mastery-caption">Estimates use accuracy, difficulty &amp; recency</span></div><div className="mastery-list">{bootstrap.units.map((unit) => <div className="mastery-row" key={unit.id}><div className="mastery-unit-icon" style={{ color: unit.color, background: `${unit.color}18` }}><SymbolIcon name={unit.icon} size={17} /></div><div className="mastery-unit-name"><strong>{unit.title}</strong><span>{unit.completedCount}/{unit.lessonCount} lessons complete · {unit.mastery === 0 ? 'Start to build a signal' : unit.mastery >= .8 ? 'Strong foundation' : 'Growing confidence'}</span></div><div className="mastery-row-track"><span style={{ width: `${Math.round(unit.mastery * 100)}%`, background: unit.color }} /></div><strong className="mastery-percent">{Math.round(unit.mastery * 100)}%</strong></div>)}</div><div className="mastery-explainer"><Sparkles size={14} /><span>Mastery isn’t time spent or questions clicked. It’s a changing estimate of how reliably you can use an idea.</span></div></section>

          <section className="panel profile-achievements-panel"><div className="panel-heading"><div><span className="eyebrow">EARNED THROUGH THE WORK</span><h3>Achievements <span className="achievement-count">{earned.length}/{bootstrap.achievements.length}</span></h3></div><span className="achievement-total-xp"><Medal size={14} /> {earned.reduce((sum, item) => sum + item.xpBonus, 0)} bonus XP</span></div>{earned.length ? <div className="profile-achievements-grid">{earned.map((item) => <div className="profile-achievement earned" key={item.slug}><span className="profile-achievement-icon"><SymbolIcon name={item.icon} size={18} /></span><span className="achievement-category">{item.category}</span><strong>{item.title}</strong><p>{item.description}</p><span className="achievement-earned-mark"><Check size={12} /> Earned</span></div>)}</div> : <div className="achievement-empty-message"><Trophy size={18} /><span>Your first achievement is just one finished lesson away.</span></div>}{locked.length > 0 && <details className="locked-achievements"><summary>See {locked.length} more milestones <ChevronRight size={14} /></summary><div className="profile-achievements-grid">{locked.map((item) => <div className="profile-achievement locked" key={item.slug}><span className="profile-achievement-icon"><LockKeyhole size={16} /></span><span className="achievement-category">{item.category}</span><strong>{item.title}</strong><p>{item.description}</p><span className="achievement-earned-mark">+{item.xpBonus} XP</span></div>)}</div></details>}</section>

          <section className="panel assessment-history-panel"><div className="panel-heading"><div><span className="eyebrow">REFLECTION, NOT JUST A SCORE</span><h3>Assessment history</h3></div><span className="assessment-history-count">{bootstrap.recentAssessments.length} completed</span></div>{bootstrap.recentAssessments.length ? <div className="assessment-history-list">{bootstrap.recentAssessments.map((assessment) => <div className="assessment-history-row" key={assessment.id}><span className="history-icon"><FileIcon /></span><div className="history-copy"><strong>{assessment.mode === 'mock' ? 'Mini mock' : 'Focus sprint'}</strong><span>{new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(assessment.submittedAt))} · {assessment.correctCount}/{assessment.questionCount} correct</span></div><span className="history-score">{Math.round(assessment.accuracy * 100)}%</span><span className="history-time">{Math.floor(assessment.timeTakenSeconds / 60)} min</span></div>)}</div> : <div className="assessment-history-empty"><span><Target size={17} /></span><div><strong>No timed sets yet.</strong><small>Try a focus sprint when you’re ready to work against a clock.</small></div><Link to="/practice">Explore practice<ArrowRight size={13} /></Link></div>}</section>
        </main>

        <aside className="profile-side-column">
          <section className="panel weekly-league-panel"><div className="panel-heading"><div><span className="eyebrow">GOOD WORK, SHARED</span><h3>Weekly league</h3></div><span className="league-week-badge">THIS WEEK</span></div>{bootstrap.leaderboard.enabled ? <>{bootstrap.leaderboard.entries.length > 0 ? <div className="league-list">{bootstrap.leaderboard.entries.map((entry) => <div className={`league-entry ${entry.isYou ? 'league-entry-you' : ''}`} key={`${entry.rank}-${entry.name}`}><span className={`league-rank ${entry.rank <= 3 ? 'league-rank-top' : ''}`}>{entry.rank}</span><span className="league-avatar">{entry.name.charAt(0).toUpperCase()}</span><span className="league-name">{entry.name}{entry.isYou && <small>YOU</small>}</span><strong>{entry.xp.toLocaleString()} <small>XP</small></strong></div>)}</div> : <div className="league-empty"><UsersRound size={18} /><strong>You’re in the league.</strong><span>As other students opt in, their weekly learning XP will appear here.</span></div>}<p className="league-privacy"><ShieldCheck size={13} /> Only learners who opt in appear by name. XP rewards thoughtful work, not endless repeats.</p></> : <div className="league-opt-in"><span className="league-opt-icon"><UsersRound size={20} /></span><strong>Join a small weekly league</strong><p>Compete on meaningful practice XP with other learners who choose to join. Your full name stays private until you opt in.</p><button type="button" className="button button-outline full-width" onClick={() => setLeaderboardOptIn(true)}>Turn on in preferences<ArrowRight size={13} /></button></div>}</section>
          <section className="panel profile-subject-panel"><span className="eyebrow">ACTIVE JOURNEY</span><div className="active-track-header"><span className="active-track-icon"><SymbolIcon name="sigma" size={18} /></span><div><strong>{bootstrap.competition.name}</strong><span>{bootstrap.competition.subject} · {bootstrap.competition.level}</span></div><span className="active-track-dot" /></div><p>{bootstrap.competition.description}</p><div className="active-track-progress"><span style={{ width: `${bootstrap.stats.totalLessons ? bootstrap.stats.completedLessons / bootstrap.stats.totalLessons * 100 : 0}%` }} /></div><div className="active-track-meta"><span>{bootstrap.stats.completedLessons}/{bootstrap.stats.totalLessons} lessons</span><Link to="/journey">View path<ArrowRight size={13} /></Link></div></section>
          <section className="panel profile-settings-panel"><div className="panel-heading"><div><span className="eyebrow">MAKE IT YOURS</span><h3>Study preferences</h3></div><Settings2 size={17} /></div><form className="profile-settings-form" onSubmit={save}><label className="field-label">Display name<input value={fullName} onChange={(event) => setFullName(event.target.value)} required minLength={2} maxLength={60} /></label><div className="settings-pair"><label className="field-label">Grade<select value={grade} onChange={(event) => setGrade(event.target.value)}><option value="">Not set</option>{['6', '7', '8', '9', '10', '11', '12', 'Other'].map((value) => <option key={value} value={value}>{value === 'Other' ? 'Other' : `Grade ${value}`}</option>)}</select></label><label className="field-label">Daily question goal<select value={dailyGoal} onChange={(event) => setDailyGoal(Number(event.target.value))}>{[1, 2, 3, 4, 5, 6, 8, 10].map((value) => <option key={value} value={value}>{value} {value === 1 ? 'question' : 'questions'}</option>)}</select></label></div><label className="field-label">Appearance<select value={theme} onChange={(event) => setTheme(event.target.value as User['theme'])}><option value="light">Light</option><option value="dark">Dark</option><option value="system">Use device setting</option></select></label><label className="privacy-toggle"><span className="privacy-toggle-copy"><strong>Appear on the weekly league</strong><small>Your name and learning XP are shared only with other opt-in learners.</small></span><input type="checkbox" checked={leaderboardOptIn} onChange={(event) => setLeaderboardOptIn(event.target.checked)} /><span className="toggle-visual" /></label>{error && <div className="form-error">{error}</div>}{savedMessage && <div className="form-success"><Check size={13} />{savedMessage}</div>}<button className="button button-primary full-width" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save preferences'}{!saving && <ArrowRight size={14} />}</button></form></section>
        </aside>
      </div>
      <div className="profile-content-note"><LockKeyhole size={13} /> Progress is saved to your account and can be revisited from another device when you sign in.</div>
    </div>
  );
}
function BookIcon() { return <SymbolIcon name="book-open-check" size={15} />; }
function FileIcon() { return <SymbolIcon name="timer" size={16} />; }
