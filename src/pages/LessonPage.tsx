import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronLeft, ChevronRight, CircleHelp, Clock3, Lightbulb, LockKeyhole, RotateCcw, Sparkles, Trophy } from 'lucide-react';
import { api, postJson } from '../api.js';
import type { Bootstrap, LessonData, Question } from '../types.js';
import { SymbolIcon } from '../components/SymbolIcon.js';

type AnswerFeedback = { correct: boolean; attemptNumber: number; feedback: string; hint?: string; explanation?: string; correctAnswer?: string; needsReview?: boolean; reviewerFeedback?: string; xpAwarded: number; mastery: number };

function parseAnswerSet(value: string) {
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch { /* Treat legacy comma-separated input as a selection list. */ }
  return value ? value.split(',').map((part) => part.trim()).filter(Boolean) : [];
}

const steps = [
  { label: 'Start', sub: 'Why it matters' },
  { label: 'Understand', sub: 'The idea' },
  { label: 'Walk through', sub: 'An example' },
  { label: 'Explore', sub: 'Try a model' },
  { label: 'Practice', sub: 'Make it stick' },
];

function LessonExplorer({ lesson }: { lesson: LessonData['lesson'] }) {
  const explorer = lesson.body.explorer;
  const [first, setFirst] = useState(Number(explorer.defaults.number ?? 23));
  const [second, setSecond] = useState(Number(explorer.defaults.divisor ?? 5));
  const [choices, setChoices] = useState(Number(explorer.defaults.choices ?? 3));
  const [options, setOptions] = useState(Number(explorer.defaults.options ?? 4));
  const safe = (value: number, min = 1, max = 999) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
  const kind = explorer.kind;
  let result = '';
  let formula = '';
  if (kind === 'remainder') {
    const divisor = safe(second);
    const remainder = safe(first, 0) % divisor;
    result = `${safe(first, 0)} = ${Math.floor(safe(first, 0) / divisor)} × ${divisor} + ${remainder}`;
    formula = `Remainder: ${remainder}`;
  } else if (kind === 'equation') {
    const coefficient = explorer.title.toLowerCase().includes('square') ? 1 : 3;
    const value = (first - second) / coefficient;
    result = `(${first} − ${second}) ÷ ${coefficient} = ${Number.isInteger(value) ? value : value.toFixed(2)}`;
    formula = explorer.title.toLowerCase().includes('square') ? `After removing the middle term: ${first * first - second}` : `So x = ${Number.isInteger(value) ? value : value.toFixed(2)}`;
  } else if (kind === 'percent') {
    const remaining = first * (1 - safe(second, 0, 100) / 100);
    result = `${first} × (1 − ${safe(second, 0, 100)} ÷ 100)`;
    formula = `Amount left: ${Number.isInteger(remaining) ? remaining : remaining.toFixed(2)}`;
  } else if (kind === 'area' && explorer.title.toLowerCase().includes('triangle angle')) {
    const angle = Math.max(0, 180 - safe(first, 0, 180) - safe(second, 0, 180));
    result = `180° − ${first}° − ${second}°`;
    formula = `The missing angle is ${angle}°`;
  } else if (kind === 'area' && explorer.title.toLowerCase().includes('scale')) {
    const scale = safe(first, 1, 12);
    result = `${scale}²`;
    formula = `Area multiplier: ${scale * scale}×`;
  } else if (kind === 'area') {
    const distance = Math.sqrt(first * first + second * second);
    result = `√(${first}² + ${second}²)`;
    formula = `Distance: ${Number.isInteger(distance) ? distance : distance.toFixed(2)}`;
  } else {
    const title = explorer.title.toLowerCase();
    if (title.includes('shared multiple')) {
      const step = safe(options);
      const count = Math.floor(safe(choices, 0) / step);
      result = `⌊${choices} ÷ ${step}⌋`;
      formula = `${count} shared multiples`;
    } else if (title.includes('factorial')) {
      const prime = safe(options);
      let count = 0;
      for (let power = prime; power <= safe(choices, 0); power *= prime) count += Math.floor(safe(choices, 0) / power);
      result = `⌊${choices} ÷ ${prime}⌋ + ⌊${choices} ÷ ${prime}²⌋ + …`;
      formula = `${count} factors of ${prime}`;
    } else if (title.includes('group selector')) {
      const n = safe(choices, 1, 18);
      const r = Math.min(n, safe(options, 0, n));
      let value = 1;
      for (let i = 1; i <= r; i += 1) value = value * (n - r + i) / i;
      result = `C(${n}, ${r})`;
      formula = `${Math.round(value)} different groups`;
    } else if (title.includes('pigeonhole')) {
      result = `${safe(options)} categories + 1`;
      formula = `${safe(options) + 1} picks guarantee a match`;
    } else {
      result = `${safe(choices)} × ${safe(options)}`;
      formula = `${safe(choices) * safe(options)} possible outcomes`;
    }
  }
  const numericControl = (value: number, setValue: (value: number) => void, label: string, max = 999) => (
    <label className="explorer-control"><span>{label}</span><div className="explorer-stepper"><button type="button" onClick={() => setValue(safe(value - 1, 0, max))} aria-label={`Decrease ${label}`}>−</button><output>{value}</output><button type="button" onClick={() => setValue(safe(value + 1, 0, max))} aria-label={`Increase ${label}`}>+</button></div></label>
  );
  return (
    <div className="explorer-card">
      <div className="explorer-card-head"><span className="explorer-icon"><Sparkles size={16} /></span><div><strong>{explorer.title}</strong><p>{explorer.prompt}</p></div></div>
      <div className="explorer-controls">
        {kind === 'counting' ? <>{numericControl(choices, setChoices, explorer.title.toLowerCase().includes('factorial') ? 'n' : explorer.title.toLowerCase().includes('shared') ? 'Range' : 'Choices', explorer.title.toLowerCase().includes('factorial') ? 60 : 999)}{numericControl(options, setOptions, explorer.title.toLowerCase().includes('factorial') ? 'Prime' : explorer.title.toLowerCase().includes('shared') ? 'Step' : 'Options', 30)}</>
          : <>{numericControl(first, setFirst, kind === 'remainder' ? 'Number' : kind === 'percent' ? 'Starting amount' : 'First value', kind === 'percent' ? 1000 : 999)}{numericControl(second, setSecond, kind === 'remainder' ? 'Divisor' : kind === 'percent' ? 'Percent change' : 'Second value', kind === 'percent' ? 100 : 999)}</>}
      </div>
      <div className="explorer-result"><span>{result}</span><strong>{formula}</strong><span className="explorer-live"><i /> Updates as you explore</span></div>
    </div>
  );
}

function QuestionCard({ question, onSubmit, submitting, previousAttempts, everCorrect }: {
  question: Question;
  onSubmit: (answer: string) => Promise<AnswerFeedback>;
  submitting: boolean;
  previousAttempts: number;
  everCorrect: boolean;
}) {
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(null);
  const [error, setError] = useState('');
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (question.type === 'multiple_select' ? parseAnswerSet(answer).length === 0 : !answer.trim()) { setError('Choose or enter an answer to continue.'); return; }
    setError('');
    try {
      const result = await onSubmit(answer.trim());
      setFeedback(result);
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Your answer could not be saved.');
    }
  };
  return <QuestionCardInner question={question} onSubmit={submit} answer={answer} setAnswer={setAnswer} feedback={feedback} setFeedback={setFeedback} error={error} submitting={submitting} previousAttempts={previousAttempts} everCorrect={everCorrect} />;
}

function QuestionCardInner({ question, onSubmit, answer, setAnswer, feedback, setFeedback, error, submitting, previousAttempts, everCorrect }: {
  question: Question;
  onSubmit: (event: FormEvent) => void;
  answer: string;
  setAnswer: (value: string) => void;
  feedback: AnswerFeedback | null;
  setFeedback: (result: AnswerFeedback | null) => void;
  error: string;
  submitting: boolean;
  previousAttempts: number;
  everCorrect: boolean;
}) {
  const attemptNumber = feedback?.attemptNumber ?? previousAttempts;
  return (
    <form className="lesson-question" onSubmit={onSubmit}>
      <div className="question-topline"><span className="question-label"><span className="question-number">{String(question.id).slice(-1).padStart(2, '0')}</span> YOUR TURN</span><span className="difficulty-dots" aria-label={`Difficulty ${question.difficulty} of 5`}>{Array.from({ length: 5 }, (_, i) => <i key={i} className={i < question.difficulty ? 'difficulty-on' : ''} />)}</span></div>
      <h3>{question.prompt}</h3>
      {question.type === 'single_choice' ? <div className="choice-list" role="radiogroup" aria-label="Answer choices">{question.choices.map((choice) => <button type="button" key={choice.value} className={`choice-button ${answer === choice.value ? 'choice-selected' : ''} ${feedback?.correct && answer === choice.value ? 'choice-correct' : ''}`} onClick={() => { setAnswer(choice.value); setFeedback(null); }} disabled={submitting || question.reviewPending}><span className="choice-key">{choice.value}</span><span>{choice.label}</span>{answer === choice.value && <span className="choice-check"><Check size={15} /></span>}</button>)}</div>
        : question.type === 'multiple_select' ? <div className="choice-list" role="group" aria-label="Select all answers that apply">{question.choices.map((choice) => { const selected = parseAnswerSet(answer).includes(choice.value); return <button type="button" key={choice.value} className={`choice-button ${selected ? 'choice-selected' : ''} ${feedback?.correct && selected ? 'choice-correct' : ''}`} aria-pressed={selected} onClick={() => { const values = new Set(parseAnswerSet(answer)); values.has(choice.value) ? values.delete(choice.value) : values.add(choice.value); setAnswer(JSON.stringify(question.choices.filter((item) => values.has(item.value)).map((item) => item.value))); setFeedback(null); }} disabled={submitting || question.reviewPending}><span className="choice-key">{choice.value}</span><span>{choice.label}</span>{selected && <span className="choice-check"><Check size={15} /></span>}</button>; })}</div>
        : question.type === 'proof' || question.type === 'short_answer' ? <label className="answer-field-label">{question.type === 'proof' ? 'Write your proof' : 'Your short answer'}<textarea className="proof-answer-input" value={answer} onChange={(event) => { setAnswer(event.target.value); setFeedback(null); }} placeholder={question.type === 'proof' ? 'Explain each step and why it follows…' : 'Write a concise response…'} rows={5} maxLength={300} disabled={submitting || question.reviewPending} /></label>
          : <label className="answer-field-label">Your answer<div className="number-answer-wrap"><input type="text" inputMode="decimal" autoComplete="off" spellCheck={false} value={answer} onChange={(event) => { setAnswer(event.target.value); setFeedback(null); }} placeholder="Type a number or fraction" disabled={submitting} /><span>NUMBER</span></div></label>}
      {everCorrect && <div className="question-history-note"><CheckCircle2 size={14} /> You have solved this question correctly before. Try it again to keep the idea fresh.</div>}
      {question.reviewPending && <div className="question-review-pending"><Clock3 size={14} /><span>Your proof is waiting for a rubric-based review. It has not been automatically graded.</span></div>}
      {question.reviewerFeedback && <div className="question-review-note"><CheckCircle2 size={14} /><span>Reviewer feedback: {question.reviewerFeedback}</span></div>}
      {error && <p className="question-inline-error"><AlertCircle size={14} />{error}</p>}
      {feedback && <div className={`answer-feedback ${feedback.needsReview ? 'answer-feedback-review' : feedback.correct ? 'answer-feedback-correct' : 'answer-feedback-hint'}`} role="status"><div className="feedback-heading">{feedback.needsReview ? <Clock3 size={17} /> : feedback.correct ? <CheckCircle2 size={17} /> : <Lightbulb size={17} />}<strong>{feedback.feedback}</strong>{feedback.xpAwarded > 0 && <span className="feedback-xp">+{feedback.xpAwarded} XP</span>}</div>{!feedback.correct && !feedback.needsReview && feedback.hint && <p className="feedback-hint">Hint: {feedback.hint}</p>}{feedback.explanation && <div className="feedback-explanation"><span>{feedback.correct ? 'Why it works' : `The answer is ${feedback.correctAnswer}`}</span><p>{feedback.explanation}</p></div>}{feedback.mastery > 0 && <span className="feedback-mastery">Topic mastery signal · {Math.round(feedback.mastery * 100)}%</span>}</div>}
      <div className="question-actions"><button className="button button-primary" type="submit" disabled={submitting || Boolean(question.reviewPending || feedback?.needsReview)}>{submitting ? 'Checking…' : question.reviewPending || feedback?.needsReview ? 'Submitted for review' : feedback?.correct ? 'Check again' : attemptNumber > 0 ? 'Try this answer' : 'Check answer'}{!submitting && !question.reviewPending && !feedback?.needsReview && <ArrowRight size={15} />}</button>{feedback && !feedback.correct && !feedback.needsReview && <button className="text-button" type="button" onClick={() => { setFeedback(null); setAnswer(''); }}>Try another answer</button>}</div>
    </form>
  );
}

export default function LessonPage({ bootstrap, refresh }: { bootstrap: Bootstrap; refresh: () => Promise<unknown> }) {
  const { lessonId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<LessonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [step, setStep] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answered, setAnswered] = useState<Record<string, boolean>>({});
  const [correct, setCorrect] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [completion, setCompletion] = useState<{ masteryScore: number; xpAwarded: number; newlyUnlocked: { id: string; title: string } | null } | null>(null);
  const [exampleVisible, setExampleVisible] = useState(0);
  const lesson = data?.lesson;

  useEffect(() => {
    if (!lessonId) return;
    setLoading(true);
    setData(null);
    setStep(0);
    setQuestionIndex(0);
    setAnswered({});
    setCorrect({});
    setLoadError('');
    setCompletion(null);
    api<LessonData>(`/lessons/${encodeURIComponent(lessonId)}`).then((result) => {
      setData(result);
      setAnswered(Object.fromEntries(result.questions.filter((question) => question.attempts > 0).map((question) => [question.id, true])));
      setCorrect(Object.fromEntries(result.questions.map((question) => [question.id, question.everCorrect])));
    }).catch((error) => {
      setLoadError(error instanceof Error ? error.message : 'This lesson could not be opened.');
      if (error instanceof Error && 'code' in error && (error as { code?: string }).code === 'lesson_locked') navigate('/journey', { replace: true });
    }).finally(() => setLoading(false));
  }, [lessonId, navigate]);

  const currentQuestion = data?.questions[questionIndex];
  const attemptedCount = data ? data.questions.filter((question) => answered[question.id] || (question.attempts ?? 0) > 0).length : 0;
  const correctCount = data ? data.questions.filter((question) => correct[question.id] || question.everCorrect).length : 0;
  const allQuestionsAttempted = Boolean(data && attemptedCount >= data.questions.length);
  const unitNumber = Math.max(1, bootstrap.units.findIndex((unit) => unit.id === lesson?.unit.id) + 1);
  const displayLessonNumber = bootstrap.units.flatMap((unit) => unit.lessons).find((item) => item.id === lesson?.id)?.number ?? 1;
  const sortedSteps = useMemo(() => steps, []);

  const handleAnswer = async (answer: string): Promise<AnswerFeedback> => {
    if (!lessonId || !currentQuestion) throw new Error('Open a question before submitting an answer.');
    setSubmitting(true);
    try {
      const result = await postJson(`/lessons/${encodeURIComponent(lessonId)}/answer`, { questionId: currentQuestion.id, answer }) as AnswerFeedback;
      setAnswered((old) => ({ ...old, [currentQuestion.id]: true }));
      if (result.correct) setCorrect((old) => ({ ...old, [currentQuestion.id]: true }));
      await refresh().catch(() => undefined);
      return result;
    } finally { setSubmitting(false); }
  };
  const finishLesson = async () => {
    if (!lessonId) return;
    setSubmitting(true);
    try {
      const result = await postJson(`/lessons/${encodeURIComponent(lessonId)}/complete`, {}) as { completed: boolean; masteryScore: number; xpAwarded: number; newlyUnlocked: { id: string; title: string } | null };
      setCompletion(result);
      setStep(5);
      await refresh().catch(() => undefined);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'This lesson could not be completed.');
    } finally { setSubmitting(false); }
  };

  const previousQuestion = () => { setQuestionIndex((value) => Math.max(0, value - 1)); };
  const nextQuestion = () => { setQuestionIndex((value) => Math.min((data?.questions.length ?? 1) - 1, value + 1)); };

  if (loading) return <div className="lesson-loading"><span className="button-spinner" /><span>Opening your lesson…</span></div>;
  if (!data || !lesson) return <div className="lesson-error"><span><CircleHelp size={18} /></span><h2>We couldn’t open this lesson</h2><p>{loadError || 'It may still be locked. Head back to your journey to see what is ready.'}</p><button className="button button-primary" onClick={() => navigate('/journey')}>Back to journey<ArrowRight size={15} /></button></div>;

  const stepForward = () => setStep((value) => Math.min(4, value + 1));

  return (
    <div className="lesson-page page-enter">
      <div className="lesson-topline"><button className="lesson-back-link" onClick={() => navigate('/journey')}><ArrowLeft size={15} /> Back to journey</button><div className="lesson-top-meta"><span style={{ color: lesson.unit.color }}><SymbolIcon name="book-open" size={15} /></span><span>{lesson.unit.title}</span><span>·</span><span>{lesson.competition}</span><span>·</span><span><Clock3 size={13} /> {lesson.estimatedMinutes} min</span></div></div>
      {loadError && <div className="inline-alert lesson-inline-alert">{loadError}<button className="text-button" onClick={() => setLoadError('')}>Dismiss</button></div>}
      <div className="lesson-progress-header"><div><span className="eyebrow">UNIT {String(unitNumber).padStart(2, '0')} <span>·</span> LESSON {String(displayLessonNumber).padStart(2, '0')}</span><h1>{lesson.title}</h1></div><div className="lesson-step-overview"><span>{step === 5 ? 'Lesson complete' : `Step ${Math.min(step + 1, 5)} of 5`}</span><div className="lesson-overall-track"><span style={{ width: `${step === 5 ? 100 : ((step + 1) / 5) * 100}%` }} /></div></div></div>

      <div className="lesson-workspace">
        <main className="lesson-main-stage">
          {step < 5 && <div className="lesson-step-tabs" aria-label="Lesson sections">{sortedSteps.map((item, index) => <button type="button" key={item.label} onClick={() => index <= step && setStep(index)} disabled={index > step} className={`${step === index ? 'lesson-step-active' : ''} ${index < step ? 'lesson-step-done' : ''}`}><span className="lesson-step-tab-num">{index < step ? <Check size={12} /> : String(index + 1).padStart(2, '0')}</span><span>{item.label}</span></button>)}</div>}
          {step === 0 && <section className="lesson-stage-content"><span className="lesson-content-kicker"><Sparkles size={14} /> START WITH THE WHY</span><h2>{lesson.title}</h2><p className="lesson-intro-copy">{lesson.body.introduction}</p><div className="lesson-objectives"><div className="lesson-section-heading"><span>WHAT YOU’LL BE ABLE TO DO</span><span>{lesson.objectives.length} learning goals</span></div>{lesson.objectives.map((objective, index) => <div className="objective-row" key={objective}><span>{String(index + 1).padStart(2, '0')}</span><p>{objective}</p><Check size={14} /></div>)}</div><div className="lesson-step-footer"><span className="gentle-note"><LockKeyhole size={13} /> Your progress saves as you go</span><button className="button button-primary" onClick={stepForward}>Let’s begin<ArrowRight size={15} /></button></div></section>}

          {step === 1 && <section className="lesson-stage-content"><span className="lesson-content-kicker"><Lightbulb size={14} /> THE CORE IDEA</span><h2>Make the pattern visible.</h2><p className="lesson-section-lede">Here’s the idea in plain language, before we put it to work.</p><div className="concept-copy">{lesson.body.explanation.map((paragraph, index) => <div className="concept-paragraph" key={`${index}-${paragraph}`}><span className="concept-paragraph-number">{index + 1}</span><p>{paragraph}</p></div>)}</div><div className="key-idea-card"><span className="key-idea-icon"><Sparkles size={15} /></span><div><span>KEEP THIS IN MIND</span><strong>{lesson.body.keyIdea}</strong></div></div><div className="lesson-step-footer"><button className="button button-secondary" onClick={() => setStep(0)}><ChevronLeft size={15} /> Back</button><button className="button button-primary" onClick={stepForward}>See it in action<ArrowRight size={15} /></button></div></section>}

          {step === 2 && <section className="lesson-stage-content"><span className="lesson-content-kicker"><BookOpenCheckIcon /> A GUIDED EXAMPLE</span><h2>Let’s work through one.</h2><p className="lesson-section-lede">Take a breath between each move. The reasoning matters more than speed.</p><div className="worked-example-card"><div className="worked-example-label"><span>EXAMPLE</span><span>Walk-through</span></div><h3>{lesson.body.example.prompt}</h3><div className="worked-steps">{lesson.body.example.steps.slice(0, exampleVisible).map((text, index) => <div className="worked-step" key={text}><span>{String(index + 1).padStart(2, '0')}</span><p>{text}</p><Check size={14} /></div>)}</div>{exampleVisible >= lesson.body.example.steps.length ? <div className="worked-answer"><CheckCircle2 size={16} /><span>{lesson.body.example.answer}</span></div> : <button className="button button-soft" onClick={() => setExampleVisible((value) => Math.min(lesson.body.example.steps.length, value + 1))}><Sparkles size={14} /> Reveal {exampleVisible === 0 ? 'the first step' : 'next step'}</button>}</div><div className="lesson-step-footer"><button className="button button-secondary" onClick={() => setStep(1)}><ChevronLeft size={15} /> Back</button><button className="button button-primary" disabled={exampleVisible < lesson.body.example.steps.length} onClick={stepForward}>Try an exploration<ArrowRight size={15} /></button></div></section>}

          {step === 3 && <section className="lesson-stage-content"><span className="lesson-content-kicker"><Sparkles size={14} /> EXPLORE THE IDEA</span><h2>Make a small change. Notice what moves.</h2><p className="lesson-section-lede">This is a sandbox, not a test. Play with the values and watch the relationship change.</p><LessonExplorer key={lesson.id} lesson={lesson} /><div className="explorer-takeaway"><CheckCircle2 size={15} /><span>{lesson.body.takeaway}</span></div><div className="lesson-step-footer"><button className="button button-secondary" onClick={() => setStep(2)}><ChevronLeft size={15} /> Back</button><button className="button button-primary" onClick={stepForward}>I’m ready to try<ArrowRight size={15} /></button></div></section>}

          {step === 4 && <section className="lesson-stage-content lesson-practice-content"><span className="lesson-content-kicker"><TargetIcon /> INDEPENDENT PRACTICE</span><h2>Now it’s your turn.</h2><p className="lesson-section-lede">Think it through first. A hint is here if you need one — the full reasoning comes after another try.</p><div className="practice-question-progress"><div className="question-progress-dots">{data.questions.map((question, index) => <button key={question.id} className={`${index === questionIndex ? 'question-dot-active' : ''} ${answered[question.id] || question.attempts ? 'question-dot-answered' : ''} ${correct[question.id] || question.everCorrect ? 'question-dot-correct' : ''}`} onClick={() => { setQuestionIndex(index); }} aria-label={`Question ${index + 1}${answered[question.id] ? ', attempted' : ''}`}><span>{correct[question.id] || question.everCorrect ? <Check size={12} /> : index + 1}</span></button>)}</div><span>Question {questionIndex + 1} of {data.questions.length} <span>·</span> {attemptedCount} attempted</span></div>{currentQuestion && <QuestionCard key={currentQuestion.id} question={currentQuestion} onSubmit={handleAnswer} submitting={submitting} previousAttempts={currentQuestion.attempts ?? 0} everCorrect={currentQuestion.everCorrect} />}
            <div className="lesson-question-nav"><button className="text-button" type="button" onClick={previousQuestion} disabled={questionIndex === 0}><ChevronLeft size={14} /> Previous</button>{questionIndex < data.questions.length - 1 ? <button className="text-button" type="button" onClick={nextQuestion} disabled={!(answered[currentQuestion?.id ?? ''] || (currentQuestion?.attempts ?? 0) > 0)}>Next question <ChevronRight size={14} /></button> : <span className="question-ready-note">{allQuestionsAttempted ? `${correctCount} of ${data.questions.length} with a correct solve` : 'Give each question one thoughtful try.'}</span>}</div>
            {allQuestionsAttempted && <div className={`lesson-finish-callout ${correctCount > 0 ? 'lesson-finish-ready' : ''}`}>{correctCount > 0 ? <><span><CheckCircle2 size={17} /></span><div><strong>Ready to wrap this lesson?</strong><small>{correctCount === data.questions.length ? 'Both answers are correct — excellent work.' : 'You have the key idea. You can revisit any question later.'}</small></div><button className="button button-primary" onClick={() => void finishLesson()} disabled={submitting}>Finish lesson<ArrowRight size={15} /></button></> : <><span><Lightbulb size={17} /></span><div><strong>One more small step.</strong><small>Try a question again until one answer clicks. You can take your time.</small></div></>}</div>}
          </section>}

          {step === 5 && <section className="lesson-complete-stage"><div className="completion-medallion"><span><Trophy size={25} /></span><i className="medallion-star star-one">✦</i><i className="medallion-star star-two">✦</i></div><span className="lesson-content-kicker">THAT’S A REAL STEP FORWARD</span><h2>{completion?.masteryScore === 1 ? 'A lovely piece of mastery.' : 'Lesson complete.'}</h2><p>{completion?.masteryScore === 1 ? 'You got both practice questions right. The idea is sticking.' : 'You worked through the core idea and earned your next step.'}</p><div className="completion-stats"><div><span>MASTERY SIGNAL</span><strong>{Math.round((completion?.masteryScore ?? data.progress.masteryScore) * 100)}<small>%</small></strong></div><div><span>XP EARNED</span><strong>+{completion?.xpAwarded ?? 0}<small> XP</small></strong></div><div><span>QUESTIONS</span><strong>{correctCount || data.questions.filter((question) => question.everCorrect).length}<small> solved</small></strong></div></div><div className="completion-actions"><button className="button button-secondary" onClick={() => { setStep(0); setCompletion(null); }}><RotateCcw size={14} /> Review the lesson</button><button className="button button-primary" onClick={() => completion?.newlyUnlocked ? navigate(`/lesson/${completion.newlyUnlocked.id}`) : navigate('/journey')}>{completion?.newlyUnlocked ? 'Next lesson' : 'Back to my journey'}<ArrowRight size={15} /></button></div></section>}
        </main>

        <aside className="lesson-learning-rail">
          <div className="lesson-rail-card lesson-rail-coach"><div className="rail-coach-icon"><Sparkles size={16} /></div><span className="eyebrow">LEARNING, NOT RUSHING</span><h3>Good thinking takes a moment.</h3><p>You can revisit this lesson any time. A wrong answer is useful information, not a setback.</p></div>
          <div className="lesson-rail-card lesson-rail-objectives"><span className="eyebrow">YOUR LEARNING GOALS</span>{lesson.objectives.map((objective, index) => <div className="rail-objective" key={objective}><span className={step > index ? 'rail-objective-done' : ''}>{step > index ? <Check size={11} /> : String(index + 1)}</span><p>{objective}</p></div>)}</div>
          <div className="lesson-source-note"><span><CircleHelp size={15} /></span><p>Original sample question. Not an official competition problem.</p></div>
          <div className="lesson-rail-daily"><div className="daily-icon-small"><Clock3 size={14} /></div><div><strong>{bootstrap.today.uniqueQuestions}/{bootstrap.user.dailyGoal}</strong><span>questions in today’s goal</span></div></div>
        </aside>
      </div>
    </div>
  );
}

function BookOpenCheckIcon() { return <CheckCircle2 size={14} />; }
function TargetIcon() { return <Trophy size={14} />; }
