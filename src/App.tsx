import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { api, ApiError, patchJson, postJson } from './api.js';
import type { Bootstrap, User } from './types.js';
import AuthScreen from './pages/AuthScreen.js';
import HomePage from './pages/HomePage.js';
import JourneyPage from './pages/JourneyPage.js';
import LessonPage from './pages/LessonPage.js';
import PracticePage from './pages/PracticePage.js';
import TutorPage from './pages/TutorPage.js';
import ProfilePage from './pages/ProfilePage.js';
import AdminPage from './pages/AdminPage.js';
import Sidebar from './components/Sidebar.js';
import { AxiomMark } from './components/Brand.js';
import { ArrowLeft, Bell, Menu, X } from 'lucide-react';

function LoadingScreen() {
  return <div className="loading-screen"><AxiomMark /><div className="loading-line" /><span>Setting up your study space…</span></div>;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [bootLoading, setBootLoading] = useState(false);
  const [bootError, setBootError] = useState('');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    api<{ user: User }>('/auth/me').then((result) => setUser(result.user)).catch(() => setUser(null)).finally(() => setSessionLoading(false));
  }, []);

  const refresh = useCallback(async () => {
    setBootLoading(true);
    setBootError('');
    try {
      const result = await api<Bootstrap>('/bootstrap');
      setBootstrap(result);
      setUser(result.user);
      return result;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) setUser(null);
      setBootError(error instanceof Error ? error.message : 'Could not load your learning data.');
      throw error;
    } finally {
      setBootLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setBootstrap(null);
      return;
    }
    void refresh().catch(() => undefined);
  }, [user?.id, refresh]);

  useEffect(() => {
    if (!bootstrap) return;
    const theme = bootstrap.user.theme === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : bootstrap.user.theme;
    document.documentElement.dataset.theme = theme;
  }, [bootstrap?.user.theme]);

  const handleAuthenticated = (signedInUser: User) => {
    setUser(signedInUser);
    setBootstrap(null);
    setBootError('');
  };
  const logout = async () => {
    try { await postJson('/auth/logout', {}); } catch { /* The local session still closes. */ }
    setUser(null);
    setBootstrap(null);
  };
  const switchCompetition = async (slug: string) => {
    try {
      await patchJson('/profile', { activeCompetitionSlug: slug });
      await refresh();
    } catch (error) {
      setBootError(error instanceof Error ? error.message : 'Could not switch journeys.');
    }
  };

  if (sessionLoading) return <LoadingScreen />;
  if (!user) return <AuthScreen onAuthenticated={handleAuthenticated} />;
  if (!bootstrap) {
    return bootError ? <div className="boot-error"><AxiomMark /><h1>We couldn’t open your study space</h1><p>{bootError}</p><button className="button button-primary" onClick={() => void refresh().catch(() => undefined)}>Try again</button><button className="text-button" onClick={() => void logout()}>Sign out</button></div> : <LoadingScreen />;
  }

  const titleForPath = (path: string) => {
    if (path.startsWith('/lesson/')) return 'Lesson workspace';
    if (path.startsWith('/admin')) return 'Content studio';
    if (path.startsWith('/journey')) return 'Learning journey';
    if (path.startsWith('/practice')) return 'Practice arena';
    if (path.startsWith('/tutor')) return 'Axiom tutor';
    if (path.startsWith('/profile')) return 'Your profile';
    return 'Your study space';
  };
  const isLesson = location.pathname.startsWith('/lesson/');

  return (
    <div className="app-frame">
      {mobileNavOpen && <button className="mobile-backdrop" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation" />}
      <Sidebar
        bootstrap={bootstrap}
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        onCompetitionChange={(slug) => void switchCompetition(slug)}
        onLogout={() => void logout()}
      />
      <div className="app-main">
        <header className="topbar">
          <button className="icon-button mobile-menu-button" onClick={() => setMobileNavOpen(true)} aria-label="Open navigation"><Menu size={19} /></button>
          <div className="topbar-title-wrap">
            {isLesson && <button className="topbar-back" onClick={() => window.history.back()} aria-label="Go back"><ArrowLeft size={16} /></button>}
            <span className="topbar-section">{titleForPath(location.pathname)}</span>
          </div>
          <div className="topbar-actions">
            <div className="streak-chip"><span className="streak-flame">✳</span><strong>{bootstrap.stats.currentStreak}</strong><span>day streak</span></div>
            <button className="icon-button notification-button" aria-label="Notifications"><Bell size={17} /><span className="notification-dot" /></button>
            <Link to="/profile" className="topbar-avatar" aria-label="Open profile">{bootstrap.user.fullName.trim().charAt(0).toUpperCase()}</Link>
            <button className="icon-button mobile-close-button" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation"><X size={18} /></button>
          </div>
        </header>
        {bootError && <div className="inline-alert" role="status">{bootError}<button className="text-button" onClick={() => void refresh().catch(() => undefined)}>Retry</button></div>}
        <div className="page-content" key={location.pathname}>
          <Routes>
            <Route path="/" element={<Navigate to="/home" replace />} />
            <Route path="/home" element={<HomePage bootstrap={bootstrap} refresh={refresh} loading={bootLoading} />} />
            <Route path="/journey" element={<JourneyPage bootstrap={bootstrap} />} />
            <Route path="/lesson/:lessonId" element={<LessonPage bootstrap={bootstrap} refresh={refresh} />} />
            <Route path="/practice" element={<PracticePage bootstrap={bootstrap} refresh={refresh} />} />
            <Route path="/tutor" element={<TutorPage bootstrap={bootstrap} />} />
            <Route path="/profile" element={<ProfilePage bootstrap={bootstrap} refresh={refresh} onUserUpdated={(next) => setUser(next)} />} />
            <Route path="/admin" element={bootstrap.user.role === 'admin' ? <AdminPage /> : <Navigate to="/home" replace />} />
            <Route path="*" element={<Navigate to="/home" replace />} />
          </Routes>
        </div>
        <footer className="shell-footer"><span>© Axiom learning</span><span>Original practice material · Not affiliated with competition organizers</span></footer>
      </div>
    </div>
  );
}
