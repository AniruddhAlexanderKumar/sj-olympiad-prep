import { ArrowRight, Compass } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Bootstrap } from '../types.js';

export default function NotFoundPage({ bootstrap }: { bootstrap: Bootstrap }) {
  const navigate = useNavigate();
  return (
    <div className="not-found-page page-enter">
      <span className="not-found-mark"><Compass size={22} /></span>
      <span className="eyebrow">PAGE NOT FOUND</span>
      <h1>That path isn’t part of your journey.</h1>
      <p>The link may be out of date, or the page may have moved. Your progress is exactly where you left it.</p>
      <div className="not-found-actions">
        <button className="button button-primary" type="button" onClick={() => navigate('/journey')}>Back to my journey<ArrowRight size={15} /></button>
        <button className="button button-secondary" type="button" onClick={() => navigate(bootstrap.currentLesson ? `/lesson/${bootstrap.currentLesson.id}` : '/journey')}>
          {bootstrap.currentLesson ? 'Continue my next lesson' : 'View my journey'}
        </button>
      </div>
    </div>
  );
}
