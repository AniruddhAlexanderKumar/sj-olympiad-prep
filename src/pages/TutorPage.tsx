import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { ArrowRight, BookOpen, CheckCircle2, Lightbulb, LockKeyhole, Send, Sparkles, Target, X } from 'lucide-react';
import { api, postJson } from '../api.js';
import type { Bootstrap, TutorMessage } from '../types.js';

const prompts = [
  { label: 'Give me a hint', icon: Lightbulb },
  { label: 'Explain it more simply', icon: BookOpen },
  { label: 'What should I revise?', icon: Target },
  { label: 'Give me another practice question', icon: Sparkles },
];

export default function TutorPage({ bootstrap }: { bootstrap: Bootstrap }) {
  const location = useLocation();
  const routeState = location.state as { lessonId?: string } | null;
  const [lessonId, setLessonId] = useState(routeState?.lessonId ?? '');
  const [messages, setMessages] = useState<TutorMessage[]>([]);
  const [input, setInput] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const listEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (routeState?.lessonId) setLessonId(routeState.lessonId);
  }, [routeState?.lessonId]);
  useEffect(() => {
    let active = true;
    api<{ messages: TutorMessage[] }>('/tutor/history').then((result) => { if (active) setMessages(result.messages); }).catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : 'Your tutor history could not be loaded.'); }).finally(() => { if (active) setLoadingHistory(false); });
    return () => { active = false; };
  }, []);
  useEffect(() => { listEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages, sending]);

  const send = async (message: string) => {
    if (!message.trim() || sending) return;
    const prompt = message.trim();
    const localId = Date.now();
    setInput('');
    setError('');
    setMessages((old) => [...old, { id: localId, role: 'student', content: prompt, lessonId: lessonId || null, createdAt: new Date().toISOString() }]);
    setSending(true);
    try {
      const result = await postJson('/tutor/chat', { message: prompt, lessonId: lessonId || undefined }) as { message: TutorMessage & { context?: { lessonTitle: string; topic: string; mastery: number } | null } };
      setMessages((old) => [...old, result.message]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The tutor could not reply. Try again in a moment.');
    } finally { setSending(false); }
  };
  const submit = (event: FormEvent) => { event.preventDefault(); void send(input); };
  const currentLesson = bootstrap.currentLesson;

  return (
    <div className="tutor-page page-enter">
      <div className="page-heading tutor-page-heading"><div><span className="eyebrow">A THOUGHTFUL STUDY COMPANION</span><h1>Ask a better question.</h1><p>Hints before answers. Steps before shortcuts.</p></div><div className="tutor-privacy-pill"><LockKeyhole size={14} /> Your learning history is private</div></div>
      <div className="tutor-layout">
        <main className="tutor-chat-panel"><div className="tutor-chat-head"><div className="tutor-avatar"><Sparkles size={18} /></div><div><strong>Axiom tutor</strong><span><i className="tutor-online-dot" /> Grounded in your AMC 10 journey</span></div><button className="tutor-context-reset" onClick={() => setLessonId('')} title="Use my overall learning context"><X size={14} />{lessonId ? 'Clear lesson context' : 'Journey context'}</button></div>
          <div className="tutor-context-strip"><span className="context-chip context-chip-course"><BookOpen size={13} /> {bootstrap.competition.name}</span>{lessonId ? <span className="context-chip"><Sparkles size={13} /> Current lesson selected</span> : currentLesson && <span className="context-chip"><Sparkles size={13} /> Next: {currentLesson.title}</span>}<span className="context-chip"><Target size={13} /> {Math.round(bootstrap.stats.topicMastery * 100)}% topic mastery signal</span></div>
          <div className="tutor-message-list">
            {loadingHistory ? <div className="tutor-empty-loading"><span className="button-spinner" /> Opening your conversation…</div> : messages.length === 0 ? <div className="tutor-welcome"><div className="tutor-welcome-mark"><Sparkles size={22} /></div><span className="eyebrow">LEARNING, TOGETHER</span><h2>Where would you like to get unstuck?</h2><p>Tell me what feels confusing. I’ll use your recent work to offer the next useful step — not skip straight to the answer.</p><div className="tutor-starter-prompts">{prompts.map(({ label, icon: Icon }) => <button key={label} onClick={() => void send(label)} disabled={sending}><Icon size={14} />{label}<ArrowRight size={13} /></button>)}</div></div> : <div className="tutor-messages">{messages.map((message) => <article key={message.id} className={`tutor-message tutor-message-${message.role}`}><div className={`message-avatar ${message.role === 'tutor' ? 'message-avatar-tutor' : ''}`}>{message.role === 'tutor' ? <Sparkles size={14} /> : bootstrap.user.fullName.charAt(0).toUpperCase()}</div><div className="message-body"><div className="message-sender">{message.role === 'tutor' ? 'Axiom tutor' : 'You'}<span>{new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(new Date(message.createdAt))}</span></div><p>{message.content}</p></div></article>)}</div>}
            {sending && <div className="tutor-typing"><span className="message-avatar message-avatar-tutor"><Sparkles size={14} /></span><span><i /><i /><i /></span><small>Thinking through a helpful next step</small></div>}
            {error && <div className="tutor-error" role="alert">{error}<button onClick={() => setError('')}>Dismiss</button></div>}
            <div ref={listEnd} />
          </div>
          {messages.length > 0 && <div className="tutor-quick-prompts">{prompts.slice(0, 3).map(({ label, icon: Icon }) => <button key={label} onClick={() => void send(label)} disabled={sending}><Icon size={13} />{label}</button>)}</div>}
          <form className="tutor-composer" onSubmit={submit}><textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send(input); } }} placeholder="Tell me what’s feeling tricky…" maxLength={1000} rows={1} aria-label="Message the tutor"/><span className="composer-hint">Press Enter to send · Shift + Enter for a new line</span><button className="composer-send" type="submit" disabled={!input.trim() || sending} aria-label="Send message"><Send size={16} /></button></form>
          <div className="tutor-chat-foot"><CheckCircle2 size={13} /><span>Progressive hints · course-grounded guidance · no answer revealed before you try</span></div>
        </main>
        <aside className="tutor-side-panel"><div className="tutor-side-intro"><span className="eyebrow">HOW I CAN HELP</span><h3>Think through it, together.</h3><p>I look at your current lesson, mastery signals and recent misses to tailor the next hint.</p></div><div className="tutor-help-steps"><div><span>01</span><div><strong>Start with a hint</strong><small>A nudge toward the next useful step.</small></div></div><div><span>02</span><div><strong>Try it again</strong><small>Keep the solving work yours.</small></div></div><div><span>03</span><div><strong>Unpack the idea</strong><small>See the full reasoning when you’re ready.</small></div></div></div><div className="tutor-revision-card"><span className="tutor-revision-icon"><Lightbulb size={15} /></span><span className="eyebrow">YOUR NEXT STEP</span><strong>{currentLesson?.title ?? 'Pick a lesson to begin'}</strong><p>{currentLesson?.summary ?? 'Your study journey will show here as your path takes shape.'}</p><button onClick={() => currentLesson && setLessonId(currentLesson.id)} disabled={!currentLesson}>Use this lesson as context<ArrowRight size={13} /></button></div><div className="tutor-transparency"><LockKeyhole size={14} /><p>This first-release tutor uses your published curriculum and learning record. Messages stay on your account and are not sent to an external AI service.</p></div></aside>
      </div>
    </div>
  );
}
