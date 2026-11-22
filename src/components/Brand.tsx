import { Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';

export function AxiomMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`axiom-mark ${compact ? 'axiom-mark-compact' : ''}`} aria-hidden="true">
      <span className="axiom-mark-orbit" />
      <span className="axiom-mark-core" />
    </span>
  );
}

export function Brand({ subtitle = true }: { subtitle?: boolean }) {
  return (
    <div className="brand-lockup">
      <div className="brand-mark-wrap"><AxiomMark /></div>
      <div className="brand-words">
        <strong>axiom</strong>
        {subtitle && <span>OLYMPIAD LEARNING</span>}
      </div>
    </div>
  );
}

export function SparkleLabel({ children }: { children: ReactNode }) {
  return <span className="sparkle-label"><Sparkles size={13} />{children}</span>;
}
