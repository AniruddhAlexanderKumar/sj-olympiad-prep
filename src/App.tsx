import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { api, ApiError, patchJson, postJson } from './api.js';
import type { Bootstrap, User } from './types.js';
import WelcomePage from './pages/WelcomePage.js';
import JourneyPage from './pages/JourneyPage.js';
import LessonPage from './pages/LessonPage.js';
import AdminPage from './pages/AdminPage.js';
import LegalPage from './pages/LegalPage.js';
import NotFoundPage from './pages/NotFoundPage.js';
import Sidebar from './components/Sidebar.js';
import AccountMenu from './components/AccountMenu.js';
import { AxiomMark } from './components/Brand.js';
import { ArrowLeft, Menu } from 'lucide-react';

function LoadingScreen() {
  return <div className="loading-screen"><AxiomMark /><div className="loading-line" /><span>Setting up your study space…</span></div>;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [bootError, setBootError] = useState('');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    api<{ user: User }>('/auth/me').then((result) => setUser(result.user)).catch(() => setUser(null)).finally(() => setSessionLoading(false));
  }, []);

  const refresh = useCallback(async () => {
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

  const handleActiveUser = (activeUser: User) => {
    setUser(activeUser);
    setBootstrap(null);
    setBootError('');
  };
  const startJourney = async () => {
    const result = await postJson('/auth/guest', {}) as { user?: User };
    if (!result?.user) throw new Error('We could not open your study space. Please try again.');
    handleActiveUser(result.user);
  };
  const switchCompetition = async (slug: string) => {
    try {
      await patchJson('/profile', { activeCompetitionSlug: slug });
      await refresh();
    } catch (error) {
      setBootError(error instanceof Error ? error.message : 'Could not switch journeys.');
    }
  };

  // Legal pages are public: they must be readable before anyone starts a journey.
  if (location.pathname === '/privacy' || location.pathname === '/terms') return <LegalPage />;
  if (sessionLoading) return <LoadingScreen />;
  if (!user) return <WelcomePage onStart={startJourney} onAuthenticated={handleActiveUser} />;
  if (!bootstrap) {
    return bootError
      ? <div className="boot-error"><AxiomMark /><h1>We couldn’t open your study space</h1><p>{bootError}</p><button className="button button-primary" onClick={() => void refresh().catch(() => undefined)}>Try again</button></div>
      : <LoadingScreen />;
  }

  const isLesson = location.pathname.startsWith('/lesson/');

  return (
    <div className="app-frame">
      {mobileNavOpen && <button className="mobile-backdrop" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation" />}
      <Sidebar
        bootstrap={bootstrap}
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        onCompetitionChange={(slug) => void switchCompetition(slug)}
      />
      <div className="app-main">
        <header className="topbar">
          <button className="icon-button mobile-menu-button" onClick={() => setMobileNavOpen(true)} aria-label="Open navigation"><Menu size={19} /></button>
          <div className="topbar-title-wrap">
            {isLesson && <button className="topbar-back" onClick={() => window.history.back()} aria-label="Go back"><ArrowLeft size={16} /></button>}
            <span className="topbar-section">{isLesson ? 'Lesson' : location.pathname.startsWith('/admin') ? 'Content studio' : 'Your journey'}</span>
          </div>
          <div className="topbar-actions">
            <AccountMenu bootstrap={bootstrap} onUserUpdated={(next) => setUser(next)} onRefresh={refresh} />
            <button className="icon-button mobile-close-button" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation">×</button>
          </div>
        </header>
        {bootError && <div className="inline-alert" role="status">{bootError}<button className="text-button" onClick={() => void refresh().catch(() => undefined)}>Retry</button></div>}
        <div className="page-content" key={location.pathname}>
          <Routes>
            <Route path="/" element={<Navigate to="/journey" replace />} />
            <Route path="/journey" element={<JourneyPage bootstrap={bootstrap} />} />
            <Route path="/lesson/:lessonId" element={<LessonPage bootstrap={bootstrap} refresh={refresh} />} />
            <Route path="/home" element={<Navigate to="/journey" replace />} />
            <Route path="/practice" element={<Navigate to="/journey" replace />} />
            <Route path="/tutor" element={<Navigate to="/journey" replace />} />
            <Route path="/profile" element={<Navigate to="/journey" replace />} />
            <Route path="/admin" element={bootstrap.user.role === 'admin' ? <AdminPage /> : <Navigate to="/journey" replace />} />
            <Route path="*" element={<NotFoundPage bootstrap={bootstrap} />} />
          </Routes>
        </div>
        <footer className="shell-footer">
          <span>© {new Date().getFullYear()} Axiom learning</span>
          <span className="shell-footer-links">
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
            <span>Original practice material · Not affiliated with competition organizers</span>
          </span>
        </footer>
      </div>
    </div>
  );
}
