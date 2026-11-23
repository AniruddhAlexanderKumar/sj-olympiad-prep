import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Check, LogOut, ShieldCheck } from 'lucide-react';
import { deleteJson, patchJson, postJson } from '../api.js';
import type { Bootstrap, User } from '../types.js';

export default function AccountMenu({ bootstrap, onUserUpdated, onRefresh }: {
  bootstrap: Bootstrap;
  onUserUpdated: (user: User) => void;
  onRefresh: () => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [upgrade, setUpgrade] = useState({ fullName: '', email: '', password: '' });
  const wrapRef = useRef<HTMLDivElement>(null);
  const { user } = bootstrap;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const saveProgress = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError('');
    setMessage('');
    try {
      const result = await postJson('/auth/upgrade', upgrade) as { user: User };
      onUserUpdated(result.user);
      await onRefresh();
      setUpgrade({ fullName: '', email: '', password: '' });
      setMessage('Saved. Your progress now follows your account.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Your account could not be created.');
    } finally { setPending(false); }
  };

  const changeTheme = async (theme: User['theme']) => {
    setError('');
    setMessage('');
    try {
      const result = await patchJson('/profile', { theme }) as { user: User };
      onUserUpdated(result.user);
      document.documentElement.dataset.theme = theme === 'system'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : theme;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Your appearance could not be saved.');
    }
  };

  const signOut = async () => {
    setPending(true);
    setError('');
    try {
      await postJson('/auth/logout', {});
      window.location.assign('/');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'You could not be signed out.');
      setPending(false);
    }
  };

  const deleteAccount = async () => {
    setPending(true);
    setError('');
    try {
      await deleteJson('/profile');
      window.location.assign('/');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Your data could not be deleted.');
      setPending(false);
    }
  };

  return (
    <div className="account-wrap" ref={wrapRef}>
      <button
        className="topbar-avatar account-trigger"
        type="button"
        aria-label="Account and settings"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {user.fullName.trim().charAt(0).toUpperCase()}
      </button>
      {open && (
        <div className="account-panel" role="dialog" aria-label="Account and settings">
          <div className="account-identity">
            <span className="avatar avatar-small">{user.fullName.trim().charAt(0).toUpperCase()}</span>
            <span>
              <strong>{user.fullName}</strong>
              <small>{user.isGuest ? 'Guest · saved on this device' : user.email}</small>
            </span>
          </div>

          {user.isGuest ? (
            <>
              <p className="account-copy">Add an email and password to keep this progress — every lesson and answer stays exactly where it is.</p>
              <form className="account-form" onSubmit={saveProgress}>
                <label className="field-label">Your name<input value={upgrade.fullName} onChange={(event) => setUpgrade({ ...upgrade, fullName: event.target.value })} required minLength={2} maxLength={60} autoComplete="name" placeholder="Jordan Learner" /></label>
                <label className="field-label">Email<input type="email" value={upgrade.email} onChange={(event) => setUpgrade({ ...upgrade, email: event.target.value })} required maxLength={254} autoComplete="email" placeholder="you@example.com" /></label>
                <label className="field-label">Password<input type="password" value={upgrade.password} onChange={(event) => setUpgrade({ ...upgrade, password: event.target.value })} required minLength={8} maxLength={128} autoComplete="new-password" placeholder="At least 8 characters" /></label>
                <button className="button button-primary full-width" type="submit" disabled={pending}>{pending ? 'Saving…' : 'Save my progress'}</button>
              </form>
            </>
          ) : (
            <button className="button button-secondary full-width" type="button" onClick={() => void signOut()} disabled={pending}>
              <LogOut size={14} />{pending ? 'One moment…' : 'Sign out'}
            </button>
          )}

          <label className="field-label account-theme">Appearance
            <select value={user.theme} onChange={(event) => void changeTheme(event.target.value as User['theme'])}>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">Use device setting</option>
            </select>
          </label>

          {error && <div className="form-error">{error}</div>}
          {message && <div className="form-success"><Check size={13} />{message}</div>}

          <div className="account-links">
            <Link to="/privacy" onClick={() => setOpen(false)}><ShieldCheck size={12} /> Privacy</Link>
            <Link to="/terms" onClick={() => setOpen(false)}>Terms</Link>
          </div>

          <div className="account-danger">
            {confirmDelete ? (
              <div className="account-danger-actions">
                <button className="button button-secondary" type="button" onClick={() => setConfirmDelete(false)} disabled={pending}>Keep my data</button>
                <button className="button account-delete-button" type="button" onClick={() => void deleteAccount()} disabled={pending}>{pending ? 'Deleting…' : 'Delete everything'}</button>
              </div>
            ) : (
              <button className="text-button account-danger-link" type="button" onClick={() => setConfirmDelete(true)}>Delete my data…</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
