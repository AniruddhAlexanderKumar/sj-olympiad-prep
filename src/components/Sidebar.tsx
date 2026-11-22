import { NavLink, useLocation } from 'react-router-dom';
import { BookOpenText, ChevronDown, Flame, House, LogOut, MessageCircleMore, Route, ShieldCheck, Swords, UserRound } from 'lucide-react';
import type { Bootstrap } from '../types.js';
import { Brand } from './Brand.js';

const navItems = [
  { to: '/home', label: 'Home', icon: House },
  { to: '/journey', label: 'Journey', icon: Route },
  { to: '/practice', label: 'Practice', icon: Swords },
  { to: '/tutor', label: 'AI tutor', icon: MessageCircleMore },
  { to: '/profile', label: 'Profile', icon: UserRound },
];

export default function Sidebar({ bootstrap, open, onClose, onCompetitionChange, onLogout }: {
  bootstrap: Bootstrap;
  open: boolean;
  onClose: () => void;
  onCompetitionChange: (slug: string) => void;
  onLogout: () => void;
}) {
  const location = useLocation();
  const progress = bootstrap.stats.totalLessons ? bootstrap.stats.completedLessons / bootstrap.stats.totalLessons : 0;
  const currentTitle = bootstrap.competition.name;
  return (
    <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
      <div className="sidebar-top">
        <NavLink to="/home" className="brand-link" onClick={onClose}><Brand /></NavLink>
        <button className="sidebar-mobile-close icon-button" onClick={onClose} aria-label="Close navigation">×</button>
      </div>
      <div className="sidebar-journey-picker">
        <label className="sidebar-eyebrow" htmlFor="journey-select">YOUR CURRENT JOURNEY</label>
        <div className="journey-select-wrap">
          <BookOpenText size={17} />
          <select id="journey-select" value={bootstrap.competition.slug} onChange={(event) => onCompetitionChange(event.target.value)} aria-label="Current competition journey">
            {bootstrap.competitions.map((competition) => (
              <option key={competition.slug} value={competition.slug} disabled={!competition.available || !competition.enrolled}>
                {competition.name}{!competition.available ? ' · coming soon' : ''}
              </option>
            ))}
          </select>
          <ChevronDown size={15} className="journey-select-chevron" />
        </div>
        <div className="sidebar-progress-label"><span>{Math.round(progress * 100)}% journey complete</span><span>{bootstrap.stats.completedLessons}/{bootstrap.stats.totalLessons}</span></div>
        <div className="sidebar-progress"><span style={{ width: `${progress * 100}%` }} /></div>
      </div>
      <nav className="primary-nav" aria-label="Main navigation">
        <span className="sidebar-eyebrow nav-eyebrow">LEARN</span>
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} onClick={onClose} className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`} aria-current={location.pathname === to ? 'page' : undefined}>
            <Icon size={18} strokeWidth={1.8} /><span>{label}</span>{to === '/practice' && <span className="nav-link-new">NEW</span>}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-spacer" />
      <div className="sidebar-streak-card">
        <div className="streak-card-icon"><Flame size={16} /></div>
        <div><strong>{bootstrap.stats.currentStreak} day streak</strong><span>A small step, every day.</span></div>
        <span className="streak-card-days">{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => <i key={`${day}${index}`} className={index < Math.min(bootstrap.stats.currentStreak, 7) ? 'streak-day-active' : ''}>{day}</i>)}</span>
      </div>
      {bootstrap.user.role === 'admin' && <NavLink to="/admin" onClick={onClose} className={`admin-nav-link ${location.pathname.startsWith('/admin') ? 'nav-link-active' : ''}`}><ShieldCheck size={17} /> Content studio</NavLink>}
      <div className="sidebar-user">
        <NavLink to="/profile" onClick={onClose} className="sidebar-user-info">
          <span className="avatar avatar-small">{bootstrap.user.fullName.trim().charAt(0).toUpperCase()}</span>
          <span className="sidebar-user-copy"><strong>{bootstrap.user.fullName}</strong><span>Level {bootstrap.stats.level} learner</span></span>
        </NavLink>
        <button className="icon-button logout-button" onClick={onLogout} aria-label={`Sign out of ${currentTitle}`} title="Sign out"><LogOut size={16} /></button>
      </div>
    </aside>
  );
}
