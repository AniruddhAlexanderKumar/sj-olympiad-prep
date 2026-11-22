import { Award, BookOpen, BookOpenCheck, BookOpenText, ChevronRight, CircleHelp, Flame, Footprints, Grid2X2, Hash, Map, Puzzle, RotateCcw, Sigma, Sparkles, Target, Timer, TrendingUp, Triangle, type LucideIcon } from 'lucide-react';

const icons: Record<string, LucideIcon> = {
  award: Award,
  'book-open': BookOpen,
  'book-open-check': BookOpenCheck,
  'book-open-text': BookOpenText,
  flame: Flame,
  footprints: Footprints,
  grid: Grid2X2,
  hash: Hash,
  map: Map,
  puzzle: Puzzle,
  rotate: RotateCcw,
  sigma: Sigma,
  sparkles: Sparkles,
  target: Target,
  timer: Timer,
  'trending-up': TrendingUp,
  triangle: Triangle,
};

export function SymbolIcon({ name, size = 18, strokeWidth = 1.8 }: { name: string; size?: number; strokeWidth?: number }) {
  const Icon = icons[name] ?? CircleHelp;
  return <Icon size={size} strokeWidth={strokeWidth} aria-hidden="true" />;
}

export function ChevronSmall({ size = 16 }: { size?: number }) {
  return <ChevronRight size={size} strokeWidth={1.8} aria-hidden="true" />;
}
