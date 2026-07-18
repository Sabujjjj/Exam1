export interface Question {
  id: string;
  question: string;
  options: string[];
  correctAnswer: string; // The correct letter (e.g., "A", "B", "C", "D") or the exact text
  explanation?: string;
}

export interface ExamConfig {
  title: string;
  description: string;
  timerMinutes: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  strictMode: boolean;
  maxFocusWarnings: number;
  webhookUrl?: string;
  questions: Question[];
}

export interface StudentSession {
  studentName: string;
  studentId: string;
  startTime: number | null;
  endTime: number | null;
  answers: Record<string, string>; // question.id -> selected option index (0, 1, 2, 3) or letter (A, B, C, D)
  score: number;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  focusWarnings: number;
  isSubmitted: boolean;
  cheated: boolean; // Auto-submitted due to excessive tab switches or outright timeout
}

export interface StudentResult {
  id: string;
  studentName: string;
  studentId: string;
  examTitle: string;
  score: number;
  maxScore: number;
  percentage: number;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  totalQuestions: number;
  focusWarnings: number;
  cheated: boolean;
  submittedAt: string;
  hash: string; // Anti-tampering signature
}
