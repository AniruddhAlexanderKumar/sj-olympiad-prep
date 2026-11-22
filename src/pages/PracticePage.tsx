import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, CircleHelp, Clock3, FileCheck2, Lightbulb, LockKeyhole, RotateCcw, ShieldCheck, Sparkles, Timer, X } from 'lucide-react';
import { api, postJson } from '../api.js';
import type { Bootstrap, PracticeMode, PracticeResult, PracticeSession, Question } from '../types.js';
import { SymbolIcon } from '../components/SymbolIcon.js';

type Feedback = { correct: boolean; attemptNumber: number; feedback: string; hint?: string; explanation?: string; correctAnswer?: string; needsReview?: boolean; reviewerFeedback?: string; xpAwarded: number; mastery: number };

function parseAnswerSet(value: string) {
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch { /* Treat legacy comma-separated input as a selection list. */ }
  return value ? value.split(',').map((part) => part.trim()).filter(Boolean) : [];
}

const modes: { id: PracticeMode; title: string; subtitle: string; icon: string; detail: string; color: string }[] = [
  { id: 'topic', title: 'Topic practice', subtitle: 'Stay with one idea', icon: 'hash', detail: 'Choose a unit and build confidence with focused questions.', color: 'sage' },
  { id: 'mixed', title: 'Mixed set', subtitle: 'Connect the dots', icon: 'grid', detail: 'Switch between unlocked topics and practise making the first move.', color: 'blue' },
  { id: 'timed', title: 'Focus sprint', subtitle: '8 minutes · up to 6 questions', icon: 'timer', detail: 'Work at your own pace. Solutions appear after you submit.', color: 'amber' },
  { id: 'mock', title: 'Mini mock', subtitle: '20 minutes · original sample set', icon: 'target', detail: 'A short, original AMC-style assessment — not a full official exam.', color: 'plum' },
  { id: 'review', title: 'Retry missed', subtitle: 'Make an error useful', icon: 'rotate', detail: 'Revisit missed questions and scheduled ideas before they go cold.', color: 'rose' },
];

const formatTime = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.max(0, seconds % 60).toString().padStart(2, '0')}`;
const modeTitle = (mode: PracticeMode) => modes.find((item) => item.id === mode)?.title ?? 'Practice set';

export default function PracticePage({ bootstrap, refresh }: { bootstrap: Bootstrap; refresh: () => Promise<unknown> }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [mode, setMode] = useState<PracticeMode>('topic');
  const [unitId, setUnitId] = useState(bootstrap.units.find((unit) => unit.lessons.some((lesson) => lesson.status !== 'locked'))?.id ?? '');
  const [session, setSession] = useState<PracticeSession | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<Record<string, Feedback>>({});
  const [remaining, setRemaining] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const submitRef = useRef<((confirmed?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    const state = location.state as { mode?: PracticeMode } | null;
    if (state?.mode && modes.some((item) => item.id === state.mode)) setMode(state.mode);
  }, [location.state]);

  const applySession = (next: PracticeSession | null) => {
    setSession(next);
    setAnswers(next?.answers ?? {});
    setActiveIndex(0);
    setFeedback({});
    setTimedOut(false);
    setError('');
  };

  useEffect(() => {
    let active = true;
    api<{ session: PracticeSession | null }>('/practice/sessions/active').then((result) => {
      if (active && result.session) applySession(result.session);
    }).catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : 'Practice sessions could not be loaded.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!session || session.submitted || !session.timeLimitSeconds) { setRemaining(0); return; }
    const started = new Date(session.startedAt.includes('T') ? session.startedAt : `${session.startedAt.replace(' ', 'T')}Z`).getTime();
    const deadline = (Number.isFinite(started) ? started : Date.now()) + session.timeLimitSeconds * 1000;
    const update = () => {
      const next = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(next);
      if (next === 0) setTimedOut(true);
    };
    update();
    const interval = window.setInterval(update, 500);
    return () => window.clearInterval(interval);
  }, [session?.id, session?.startedAt, session?.timeLimitSeconds, session?.submitted]);

  const start = async () => {
    setError('');
    setLoading(true);
    try {
      const result = await postJson('/practice/sessions', { mode, unitId: mode === 'topic' ? unitId : undefined }) as { session: PracticeSession };
      applySession(result.session);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'This practice set could not be started.');
    } finally { setLoading(false); }
  };

  const saveAnswer = async (answer: string) => {
    if (!session || !currentQuestion) return;
    setSubmitting(true);
    setError('');
    try {
      const result = await postJson(`/practice/sessions/${session.id}/answer`, { questionId: currentQuestion.id, answer }) as Feedback & { saved: boolean };
      setAnswers((old) => ({ ...old, [currentQuestion.id]: answer }));
      setSession((old) => old ? { ...old, answers: { ...old.answers, [currentQuestion.id]: answer } } : old);
      if (session.mode !== 'timed' && session.mode !== 'mock') setFeedback((old) => ({ ...old, [currentQuestion.id]: result }));
      await refresh().catch(() => undefined);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Your answer could not be saved.');
      if (caught instanceof Error && 'code' in caught && (caught as { code?: string }).code === 'time_expired') setTimedOut(true);
    } finally { setSubmitting(false); }
  };

  const submitSession = useCallback(async (confirmed = false) => {
    if (!session || session.submitted || submitting) return;
    if (!confirmed && !timedOut && (session.mode === 'timed' || session.mode === 'mock')) {
      setShowSubmitConfirm(true);
      return;
    }
    setSubmitting(true);
    setShowSubmitConfirm(false);
    try {
      const result = await postJson(`/practice/sessions/${session.id}/submit`, {}) as { result: PracticeResult };
      const done = await api<{ session: PracticeSession }>(`/practice/sessions/${session.id}`);
      setSession({ ...done.session, submitted: true, score: result.result });
      await refresh().catch(() => undefined);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Your answers could not be submitted.');
    } finally { setSubmitting(false); }
  }, [session, submitting, timedOut, refresh]);
  useEffect(() => { submitRef.current = submitSession; }, [submitSession]);
  useEffect(() => { if (timedOut && session && !session.submitted) void submitRef.current?.(true); }, [timedOut, session?.id, session?.submitted]);

  const currentQuestion = session?.questions[activeIndex];
  const currentFeedback = currentQuestion ? feedback[currentQuestion.id] : undefined;
  const isAssessment = session?.mode === 'timed' || session?.mode === 'mock';
  const answeredCount = session ? session.questions.filter((question) => Boolean(answers[question.id])).length : 0;
  const unlockedUnits = useMemo(() => bootstrap.units.filter((unit) => unit.lessons.some((lesson) => lesson.status !== 'locked')), [bootstrap.units]);
  const timeLabel = session?.timeLimitSeconds ? formatTime(remaining) : '';

  if (loading && !session) return <div className="practice-loading"><span className="button-spinner" /><span>Preparing your practice space…</span></div>;
  if (session?.submitted && session.score) return <PracticeResults result={session.score} mode={session.mode} onAgain={() => applySession(null)} onReview={() => { applySession(null); setMode('review'); }} />;

  return (
    <div className="practice-page page-enter">
      {!session ? <>
        <div className="page-heading practice-heading"><div><span className="eyebrow">A PLACE TO TRY, NOT TO PERFORM</span><h1>Practice with purpose.</h1><p>Pick a focus. Work through the questions. Learn from what happens next.</p></div><div className="practice-heading-note"><ShieldCheck size={15} /><span>No hearts. No paywall. Mistakes are part of the work.</span></div></div>
        {error && <div className="inline-alert">{error}<button className="text-button" onClick={() => setError('')}>Dismiss</button></div>}
        <div className="practice-content-layout"><div className="practice-mode-grid">{modes.map((item) => {
          const disabled = item.id === 'review' && bootstrap.stats.dueReviews === 0;
          return <button key={item.id} className={`practice-mode-card practice-mode-${item.color} ${mode === item.id ? 'practice-mode-selected' : ''} ${disabled ? 'practice-mode-disabled' : ''}`} onClick={() => !disabled && setMode(item.id)} disabled={disabled}>
            <span className="mode-icon"><SymbolIcon name={item.icon} size={20} /></span><span className="mode-subtitle">{item.id === 'review' && bootstrap.stats.dueReviews > 0 ? `${bootstrap.stats.dueReviews} due to revisit` : item.subtitle}</span><strong>{item.title}</strong><p>{item.detail}</p><span className="mode-radio"><i /></span>
          </button>;
        })}</div>
          <aside className="practice-setup-panel"><span className="eyebrow">SET YOUR INTENTION</span><h2>{modeTitle(mode)}</h2><p>{modes.find((item) => item.id === mode)?.detail}</p>{mode === 'topic' && <label className="field-label">Choose a topic<select value={unitId} onChange={(event) => setUnitId(event.target.value)}>{unlockedUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.title}</option>)}{bootstrap.units.filter((unit) => !unlockedUnits.some((open) => open.id === unit.id)).map((unit) => <option key={unit.id} value={unit.id} disabled>{unit.title} · locked</option>)}</select></label>}
            <div className="practice-setup-summary"><div><Clock3 size={15} /><span>{mode === 'timed' ? '8 minutes' : mode === 'mock' ? '20 minutes' : 'At your pace'}</span></div><div><FileCheck2 size={15} /><span>{mode === 'mock' ? 'Original mini assessment' : mode === 'timed' ? 'Answers saved as you go' : 'Hints after a first try'}</span></div></div>
            <button className="button button-primary practice-start-button" onClick={() => void start()} disabled={loading || (mode === 'topic' && !unitId)}>{loading ? 'Preparing…' : 'Start this set'}<ArrowRight size={16} /></button>
            <div className="practice-small-print"><Sparkles size={13} /> Content in this starter journey is original practice material, not official past-paper content.</div>
          </aside>
        </div>
        <div className="practice-lower-grid"><div className="practice-week-card"><div><span className="eyebrow">YOUR PRACTICE SO FAR</span><h3>{bootstrap.stats.answeredQuestions} thoughtful attempts</h3><p>{bootstrap.stats.answeredQuestions ? `${Math.round(bootstrap.stats.accuracy * 100)}% accuracy across attempted questions. Accuracy is a signal, not the whole story.` : 'Your first attempt will give us something useful to build on.'}</p><button className="text-action" onClick={() => navigate('/journey')}>Review your learning path<ArrowRight size={13} /></button></div><div className="practice-stat-ring"><span>{bootstrap.stats.answeredQuestions ? `${Math.round(bootstrap.stats.accuracy * 100)}%` : '—'}</span><small>accuracy</small></div></div><div className="practice-missed-card"><span className="retry-icon"><RotateCcw size={17} /></span><div><strong>Missed something?</strong><p>Try it again later. Your wrong answers become a private revision list.</p><button className="text-action" disabled={bootstrap.stats.dueReviews === 0} onClick={() => { setMode('review'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Review missed questions<ArrowRight size={13} /></button></div></div></div>
      </> : <>
        <div className="practice-session-header"><button className="lesson-back-link" onClick={() => navigate('/practice')}><ArrowLeft size={15} /> Practice modes</button><span className="practice-session-type"><SymbolIcon name={session.mode === 'timed' || session.mode === 'mock' ? 'timer' : 'grid'} size={15} /> {modeTitle(session.mode)}{session.mode === 'mock' && <small> · original sample</small>}</span>{session.timeLimitSeconds > 0 && <span className={`practice-countdown ${remaining < 90 ? 'timer-warning' : ''}`}><Timer size={15} /> {timeLabel}</span>}</div>
        <div className="practice-session-layout"><main className="practice-question-area"><div className="practice-session-progress"><div><span>{session.mode === 'timed' || session.mode === 'mock' ? 'ASSESSMENT' : 'PRACTICE SET'}</span><strong>{session.mode === 'topic' ? session.questions[0]?.unitTitle : session.mode === 'mixed' ? 'Mixed topics' : session.mode === 'review' ? 'Your review list' : 'Original AMC-style questions'}</strong></div><div className="assessment-progress-track"><span style={{ width: `${answeredCount / session.questions.length * 100}%` }} /></div><small>{answeredCount} of {session.questions.length} answered</small></div>
            {currentQuestion && <PracticeQuestion key={currentQuestion.id} question={currentQuestion} value={answers[currentQuestion.id] ?? ''} feedback={currentFeedback} isAssessment={Boolean(isAssessment)} submitting={submitting} onSubmit={saveAnswer} />}
            {error && <div className="inline-alert practice-error-alert">{error}<button className="text-button" onClick={() => setError('')}>Dismiss</button></div>}
            {isAssessment && <div className="assessment-hint-bar"><LockKeyhole size={14} /><span>Assessment mode: explanations and correct answers are held until you submit.</span></div>}
            <div className="practice-session-footer"><button className="button button-secondary" onClick={() => setActiveIndex((value) => Math.max(0, value - 1))} disabled={activeIndex === 0}><ArrowLeft size={15} /> Previous</button>{activeIndex < session.questions.length - 1 ? <button className="button button-primary" onClick={() => setActiveIndex((value) => Math.min(session.questions.length - 1, value + 1))}>Next question<ArrowRight size={15} /></button> : <button className="button button-primary" onClick={() => void submitSession()} disabled={submitting}>{submitting ? 'Submitting…' : 'Submit set'}<Check size={15} /></button>}</div>
          </main><aside className="practice-question-nav"><div className="question-nav-heading"><div><span className="eyebrow">QUESTION NAVIGATION</span><h3>Keep your place.</h3></div><CircleHelp size={16} /></div><div className="question-nav-grid">{session.questions.map((question, index) => <button key={question.id} className={`${index === activeIndex ? 'question-nav-current' : ''} ${answers[question.id] ? 'question-nav-answered' : ''}`} onClick={() => setActiveIndex(index)} aria-label={`Go to question ${index + 1}`}><span>{index + 1}</span>{answers[question.id] && <i />}</button>)}</div><div className="question-nav-legend"><span><i className="legend-current" /> Current</span><span><i className="legend-answered" /> Answer saved</span></div><div className="practice-session-note"><span><Lightbulb size={14} /></span><p>{isAssessment ? 'You can change any response before submitting. Your work is saved as you go.' : 'Take your time. The first useful step is better than a rushed guess.'}</p></div><button className="button button-outline full-width" onClick={() => void submitSession()} disabled={submitting}>{submitting ? 'Submitting…' : 'Finish and see results'}<ArrowRight size={14} /></button></aside></div>
        {timedOut && <div className="timeout-banner"><Timer size={15} /> Time is up. Your answers have been saved; submitting your set now.</div>}
      </>}
      {showSubmitConfirm && session && <div className="modal-backdrop" role="presentation"><div className="submit-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="submit-confirm-title"><button className="modal-close icon-button" onClick={() => setShowSubmitConfirm(false)} aria-label="Close"><X size={17} /></button><span className="confirm-modal-icon"><FileCheck2 size={20} /></span><span className="eyebrow">READY WHEN YOU ARE</span><h2 id="submit-confirm-title">Submit this set?</h2><p>You’ve answered {answeredCount} of {session.questions.length} questions. Unanswered questions will be marked blank, and you can’t change answers after submission.</p><div className="confirm-modal-actions"><button className="button button-secondary" onClick={() => setShowSubmitConfirm(false)}>Keep working</button><button className="button button-primary" onClick={() => void submitSession(true)}>Submit and review<ArrowRight size={14} /></button></div></div></div>}
    </div>
  );
}

function PracticeQuestion({ question, value, feedback, isAssessment, submitting, onSubmit }: {
  question: Question;
  value: string;
  feedback?: Feedback;
  isAssessment: boolean;
  submitting: boolean;
  onSubmit: (answer: string) => Promise<void>;
}) {
  const [input, setInput] = useState(value);
  const [formError, setFormError] = useState('');
  useEffect(() => setInput(value), [question.id, value]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (question.type === 'multiple_select' ? parseAnswerSet(input).length === 0 : !input.trim()) { setFormError('Choose or enter an answer first.'); return; }
    setFormError('');
    await onSubmit(input.trim());
  };
  return <form className="practice-question-card" onSubmit={submit}><div className="practice-question-top"><span className="question-label"><span className="question-number">{String(question.objective || '01').slice(0, 2)}</span>{question.unitTitle ?? 'PRACTICE'}</span><span className="practice-question-count">Difficulty {question.difficulty}/5</span></div><h2>{question.prompt}</h2>{question.lessonTitle && <span className="practice-question-context">{question.unitTitle} <span>·</span> {question.lessonTitle}</span>}
    {question.type === 'single_choice' ? <div className="choice-list practice-choice-list" role="radiogroup" aria-label="Answer choices">{question.choices.map((choice) => <button type="button" key={choice.value} className={`choice-button ${input === choice.value ? 'choice-selected' : ''} ${feedback?.correct && input === choice.value ? 'choice-correct' : ''}`} onClick={() => setInput(choice.value)} disabled={submitting}><span className="choice-key">{choice.value}</span><span>{choice.label}</span>{input === choice.value && <Check size={15} className="choice-trailing-check" />}</button>)}</div> : question.type === 'multiple_select' ? <div className="choice-list practice-choice-list" role="group" aria-label="Select all answers that apply">{question.choices.map((choice) => { const selected = parseAnswerSet(input).includes(choice.value); return <button type="button" key={choice.value} className={`choice-button ${selected ? 'choice-selected' : ''} ${feedback?.correct && selected ? 'choice-correct' : ''}`} aria-pressed={selected} onClick={() => { const values = new Set(parseAnswerSet(input)); values.has(choice.value) ? values.delete(choice.value) : values.add(choice.value); setInput(JSON.stringify(question.choices.filter((item) => values.has(item.value)).map((item) => item.value))); }} disabled={submitting}><span className="choice-key">{choice.value}</span><span>{choice.label}</span>{selected && <Check size={15} className="choice-trailing-check" />}</button>; })}</div> : question.type === 'proof' || question.type === 'short_answer' ? <label className="answer-field-label">{question.type === 'proof' ? 'Write your proof' : 'Your short answer'}<textarea className="proof-answer-input" rows={5} maxLength={300} value={input} onChange={(event) => setInput(event.target.value)} placeholder={question.type === 'proof' ? 'Explain each step and why it follows…' : 'Write a concise response…'} disabled={submitting} /></label> : <label className="answer-field-label">Your answer<div className="number-answer-wrap"><input inputMode="decimal" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Type a number or fraction" /><span>NUMBER</span></div></label>}
    {feedback && !isAssessment && <div className={`answer-feedback ${feedback.correct ? 'answer-feedback-correct' : 'answer-feedback-hint'}`}><div className="feedback-heading">{feedback.correct ? <CheckCircle2 size={17} /> : <Lightbulb size={17} />}<strong>{feedback.feedback}</strong>{feedback.xpAwarded > 0 && <span className="feedback-xp">+{feedback.xpAwarded} XP</span>}</div>{feedback.hint && !feedback.correct && <p className="feedback-hint">Hint: {feedback.hint}</p>}{feedback.explanation && <div className="feedback-explanation"><span>{feedback.correct ? 'Why it works' : `The answer is ${feedback.correctAnswer}`}</span><p>{feedback.explanation}</p></div>}</div>}
    {formError && <span className="question-inline-error">{formError}</span>}
    {isAssessment && value && <span className="saved-answer-note"><CheckCircle2 size={13} /> Answer saved — you can change it before submitting.</span>}
    <button className="button button-primary practice-check-answer" type="submit" disabled={submitting || Boolean(feedback?.needsReview)}>{submitting ? 'Saving…' : feedback?.needsReview ? 'Submitted for review' : isAssessment ? 'Save answer' : feedback?.correct ? 'Try another question' : feedback ? 'Try another answer' : 'Check answer'}{!feedback?.needsReview && <ArrowRight size={15} />}</button>
  </form>;
}

function PracticeResults({ result, mode, onAgain, onReview }: { result: PracticeResult; mode: PracticeMode; onAgain: () => void; onReview: () => void }) {
  const percent = Math.round(result.accuracy * 100);
  return <div className="practice-results-page page-enter"><div className="results-topline"><span className="eyebrow">{modeTitle(mode).toUpperCase()} · REVIEW</span><span><Clock3 size={14} /> {formatTime(result.timeTakenSeconds)}</span></div><div className="results-hero"><div className="results-score-ring" style={{ '--score': `${percent * 3.6}deg` } as CSSProperties}><div><strong>{percent}<small>%</small></strong><span>accuracy</span></div></div><div className="results-hero-copy"><span className="eyebrow">THE WORK YOU PUT IN COUNTS</span><h1>{percent >= 80 ? 'A strong, steady set.' : percent >= 50 ? 'Good work finding your footing.' : 'Useful information for next time.'}</h1><p>You solved {result.correctCount} of {result.questionCount} questions with care. Here’s what to take forward.</p><div className="results-rewards"><span><ZapIcon /> +{result.xpAwarded} XP earned</span><span><Timer size={14} /> {formatTime(result.timeTakenSeconds)} spent</span></div></div></div>
      <div className="results-grid"><main className="results-review-list"><div className="results-section-heading"><div><span className="eyebrow">ANSWER REVIEW</span><h2>What happened, question by question</h2></div><span>{result.questionCount} questions</span></div>{result.results.map((item, index) => <article className={`result-question ${item.correct ? 'result-correct' : 'result-incorrect'}`} key={item.question.id}><div className="result-question-top"><span className={`result-status-icon ${item.correct ? 'result-status-correct' : 'result-status-incorrect'}`}>{item.correct ? <Check size={15} /> : <Lightbulb size={15} />}</span><span>QUESTION {String(index + 1).padStart(2, '0')}</span><span className="result-topic-tag">{item.unitTitle}</span></div><h3>{item.question.prompt}</h3><div className="result-answer-row"><span>Your answer</span><strong>{item.yourAnswer ?? 'Not answered'}</strong>{item.correct ? <span className="result-correct-label">Correct</span> : <span className="result-answer-correct">Answer: {item.correctAnswer}</span>}</div><div className="result-explanation"><span>Reasoning</span><p>{item.explanation}</p></div></article>)}</main><aside className="results-side-panel"><div className="results-topic-card"><span className="eyebrow">TOPIC BREAKDOWN</span><h3>Where to spend a little more time</h3>{result.topicPerformance.map((topic) => <div className="result-topic-row" key={topic.unitId}><div><strong>{topic.unitTitle}</strong><span>{topic.correct}/{topic.count} correct</span></div><span className={`result-topic-score ${topic.accuracy >= .7 ? 'result-topic-good' : ''}`}>{Math.round(topic.accuracy * 100)}%</span><div className="topic-progress-track"><span style={{ width: `${topic.accuracy * 100}%` }} /></div></div>)}{result.recommendations.length > 0 ? <div className="revision-recommendation"><Lightbulb size={14} /><span>Revisit {result.recommendations.join(' and ')} next.</span></div> : <div className="revision-recommendation"><CheckCircle2 size={14} /><span>Keep this momentum. You’re building a solid base.</span></div>}</div><div className="results-actions-card"><span className="eyebrow">KEEP GOING</span><button className="button button-primary full-width" onClick={onAgain}>Choose another set<ArrowRight size={14} /></button><button className="button button-outline full-width" onClick={onReview}><RotateCcw size={14} /> Retry missed questions</button></div></aside></div></div>;
}
function ZapIcon() { return <Sparkles size={14} />; }
