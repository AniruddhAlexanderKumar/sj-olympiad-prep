export type User = {
  id: number;
  fullName: string;
  email: string;
  isGuest: boolean;
  role: 'student' | 'admin';
  grade: string;
  activeCompetitionSlug: string | null;
  dailyGoal: number;
  theme: 'light' | 'dark' | 'system';
  leaderboardOptIn: boolean;
};

export type Competition = {
  slug: string;
  name: string;
  subject: string;
  level: string;
  description: string;
  available: boolean;
  enrolled: boolean;
};

export type LessonStatus = 'locked' | 'available' | 'in_progress' | 'completed' | 'mastered';

export type LessonSummary = {
  id: string;
  title: string;
  summary: string;
  difficulty: number;
  estimatedMinutes: number;
  status: LessonStatus;
  mastery: number;
  completedAt: string | null;
  number: number;
};

export type Unit = {
  id: string;
  title: string;
  shortTitle: string;
  description: string;
  color: string;
  icon: string;
  estimatedMinutes: number;
  lessonCount: number;
  completedCount: number;
  mastery: number;
  lessons: LessonSummary[];
};

export type DailyQuest = {
  id: string;
  title: string;
  detail: string;
  progress: number;
  target: number;
  reward: number;
  icon: string;
};

export type Achievement = {
  slug: string;
  title: string;
  description: string;
  category: string;
  icon: string;
  xpBonus: number;
  earnedAt: string | null;
};

export type Bootstrap = {
  user: User;
  competition: Pick<Competition, 'slug' | 'name' | 'subject' | 'level' | 'description' | 'available'>;
  competitions: Competition[];
  enrolledCompetitions: string[];
  units: Unit[];
  currentLesson: LessonSummary | null;
  stats: {
    xp: number;
    level: number;
    xpIntoLevel: number;
    xpToNextLevel: number;
    currentStreak: number;
    bestStreak: number;
    completedLessons: number;
    totalLessons: number;
    topicMastery: number;
    answeredQuestions: number;
    correctQuestions: number;
    accuracy: number;
    dueReviews: number;
    dailyQuestions: number;
    dailyGoal: number;
  };
  today: { date: string; xp: number; questions: number; uniqueQuestions: number; correct: number; lessons: number };
  dailyQuests: DailyQuest[];
  achievements: Achievement[];
  week: { date: string; label: string; xp: number; active: boolean }[];
  calendar: { date: string; day: number; weekday: number; active: boolean; questions: number; lessons: number; xp: number }[];
  recentAssessments: { id: string; mode: PracticeMode; accuracy: number; correctCount: number; questionCount: number; timeTakenSeconds: number; submittedAt: string }[];
  leaderboard: { enabled: boolean; entries: { rank: number; name: string; xp: number; isYou: boolean }[] };
  activePracticeSessionId: string | null;
};

export type Question = {
  id: string;
  type: string;
  prompt: string;
  choices: { value: string; label: string }[];
  difficulty: number;
  objective: string;
  unitId?: string;
  unitTitle?: string;
  lessonId?: string;
  lessonTitle?: string;
  attempts?: number;
  everCorrect?: boolean;
  reviewPending?: boolean;
  reviewerFeedback?: string;
};

export type LessonBody = {
  introduction: string;
  explanation: string[];
  keyIdea: string;
  example: { prompt: string; steps: string[]; answer: string };
  explorer: { kind: string; title: string; prompt: string; defaults: Record<string, number> };
  takeaway: string;
};

export type LessonData = {
  lesson: {
    id: string;
    title: string;
    summary: string;
    difficulty: number;
    estimatedMinutes: number;
    objectives: string[];
    body: LessonBody;
    unit: { id: string; title: string; shortTitle: string; color: string };
    competition: string;
  };
  questions: (Question & { attempts: number; everCorrect: boolean })[];
  progress: { startedAt: string; completedAt: string | null; masteryScore: number; attempts: number };
};

export type TutorMessage = {
  id: number;
  role: 'student' | 'tutor';
  content: string;
  lessonId: string | null;
  createdAt: string;
};

export type PracticeMode = 'topic' | 'mixed' | 'timed' | 'review' | 'mock';

export type PracticeSession = {
  id: string;
  mode: PracticeMode;
  unitId: string | null;
  timeLimitSeconds: number;
  elapsedSeconds: number;
  startedAt: string;
  questions: Question[];
  answers: Record<string, string>;
  submitted: boolean;
  score: PracticeResult | null;
};

export type PracticeResult = {
  correctCount: number;
  questionCount: number;
  accuracy: number;
  timeTakenSeconds: number;
  topicPerformance: { unitId: string; unitTitle: string; count: number; correct: number; accuracy: number }[];
  recommendations: string[];
  results: {
    question: Question;
    yourAnswer: string | null;
    correct: boolean;
    correctAnswer: string;
    explanation: string;
    unitId: string;
    unitTitle: string;
    lessonTitle: string;
  }[];
  xpAwarded: number;
};
