import { useState, type FormEvent } from 'react';
import { ArrowRight, Check, Eye, EyeOff, LockKeyhole, Sparkles } from 'lucide-react';
import { ApiError, postJson } from '../api.js';
import type { User } from '../types.js';
import { AxiomMark, Brand } from '../components/Brand.js';

export default function AuthScreen({ onAuthenticated }: { onAuthenticated: (user: User) => void }) {
  const [mode, setMode] = useState<'register' | 'login'>('register');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [grade, setGrade] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [accountExists, setAccountExists] = useState(false);

  const changeMode = (nextMode: 'register' | 'login') => {
    setMode(nextMode);
    setError('');
    setAccountExists(false);
    setConfirmPassword('');
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setAccountExists(false);
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedName = fullName.trim().replace(/\s+/g, ' ');
    if (mode === 'register') {
      if (normalizedName.length < 2) { setError('Enter your name so we can personalize your study space.'); return; }
      if (password.length < 8) { setError('Choose a password with at least 8 characters.'); return; }
      if (password !== confirmPassword) { setError('Those passwords do not match. Please check them and try again.'); return; }
    }
    setPending(true);
    try {
      const path = mode === 'register' ? '/auth/register' : '/auth/login';
      const result = await postJson(path, mode === 'register'
        ? { fullName: normalizedName, email: normalizedEmail, password, grade: grade.trim(), competitionSlug: 'amc-10' }
        : { email: normalizedEmail, password }) as { user?: User };
      if (!result?.user) throw new ApiError('Your account was not returned by the service. Refresh the page and try again.', 200, 'invalid_account_response');
      onAuthenticated(result.user);
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'email_in_use') {
        setAccountExists(true);
        setError('An account already exists for this email. Sign in instead, or use a different address.');
      } else if (caught instanceof ApiError && caught.code === 'invalid_credentials') {
        setError('That email and password do not match. Check them and try again, or create a new account.');
      } else if (caught instanceof ApiError && caught.status >= 500) {
        setError('We could not finish that request right now. Please try again shortly. If you were creating an account, you can try signing in with the same email.');
      } else if (caught instanceof Error) {
        setError(caught.message);
      } else {
        setError('We could not complete account access. Please try again.');
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="auth-page">
      <section className="auth-story">
        <div className="auth-story-noise" />
        <div className="auth-brand"><Brand /></div>
        <div className="auth-story-content">
          <span className="auth-kicker"><Sparkles size={14} /> BUILT FOR THE LONG GAME</span>
          <h1>Big ideas.<br /><em>One clear step</em><br />at a time.</h1>
          <p>A thoughtful place to prepare for the problems you can’t solve by memorizing a formula.</p>
          <div className="auth-story-checks">
            <div><span><Check size={13} /></span> Concepts before questions</div>
            <div><span><Check size={13} /></span> Progress that remembers you</div>
            <div><span><Check size={13} /></span> Original, carefully explained practice</div>
          </div>
        </div>
        <div className="auth-story-foot"><AxiomMark compact /><span>Made for curious minds, not just right answers.</span></div>
        <div className="auth-orbit auth-orbit-one" /><div className="auth-orbit auth-orbit-two" />
      </section>
      <section className="auth-panel">
        <div className="auth-form-wrap">
          <div className="auth-form-overline"><LockKeyhole size={14} /> YOUR PRIVATE STUDY SPACE</div>
          <h2>{mode === 'register' ? 'Start your journey' : 'Welcome back'}</h2>
          <p className="auth-subtitle">{mode === 'register' ? 'A little structure can take you a long way.' : 'Pick up where your curiosity left off.'}</p>
          <div className="auth-mode-toggle" role="tablist" aria-label="Account access">
            <button id="register-tab" type="button" role="tab" aria-selected={mode === 'register'} aria-controls="auth-panel" className={mode === 'register' ? 'active' : ''} onClick={() => changeMode('register')}>Create account</button>
            <button id="login-tab" type="button" role="tab" aria-selected={mode === 'login'} aria-controls="auth-panel" className={mode === 'login' ? 'active' : ''} onClick={() => changeMode('login')}>Sign in</button>
          </div>
          <form id="auth-panel" role="tabpanel" aria-labelledby={mode === 'register' ? 'register-tab' : 'login-tab'} onSubmit={submit} className="auth-form">
            {mode === 'register' && <label className="field-label">Your name<input required minLength={2} maxLength={60} autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="What should we call you?" /></label>}
            <label className="field-label">Email address<input required type="email" inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={254} autoComplete="email" value={email} onChange={(event) => { setEmail(event.target.value); if (accountExists) { setAccountExists(false); setError(''); } }} placeholder="you@example.com" /></label>
            <label className="field-label">Password<div className="password-input-wrap"><input required minLength={mode === 'register' ? 8 : 1} maxLength={128} type={showPassword ? 'text' : 'password'} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === 'register' ? 'At least 8 characters' : 'Your password'} /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>
            {mode === 'register' && <label className="field-label">Confirm password<div className="password-input-wrap"><input required minLength={8} maxLength={128} type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Enter your password again" /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide passwords' : 'Show passwords'}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>}
            {mode === 'register' && <div className="auth-two-fields"><label className="field-label">Grade <span className="optional-label">OPTIONAL</span><select value={grade} onChange={(event) => setGrade(event.target.value)}><option value="">Choose grade</option>{['6', '7', '8', '9', '10', '11', '12', 'Other'].map((value) => <option key={value} value={value}>{value === 'Other' ? 'Other' : `Grade ${value}`}</option>)}</select></label><div className="field-label">First journey<span className="optional-label">READY NOW</span><div className="auth-competition"><AxiomMark compact /><span><strong>AMC 10</strong><small>Mathematics</small></span><Check size={15} /></div></div></div>}
            {error && <div className="form-error" role="alert">{error}{accountExists && <button className="text-button" type="button" onClick={() => changeMode('login')}>Sign in with this email</button>}</div>}
            <button className="button button-primary auth-submit" type="submit" disabled={pending} aria-busy={pending}>{pending ? <><span className="button-spinner" />{mode === 'register' ? 'Creating account…' : 'Signing in…'}</> : <>{mode === 'register' ? 'Create my study space' : 'Sign in'}<ArrowRight size={16} /></>}</button>
          </form>
          <p className="auth-privacy">Your learning history stays with your account. We never share your data with an external AI model.</p>
        </div>
        <div className="auth-citation"><span>Original sample curriculum</span><span>·</span><span>Independent learning resource</span></div>
      </section>
    </div>
  );
}
