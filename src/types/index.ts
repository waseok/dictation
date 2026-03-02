export type TokenStatus = 'correct' | 'spelling-error' | 'spacing-error' | 'missing';

export type LoadingPhase = 'idle' | 'ocr' | 'grading';

export interface GradeToken {
  correct: string;
  student: string;
  status: TokenStatus;
}

export interface GradeResult {
  score: number;
  correctCount: number;
  spacingErrorCount: number;
  spellingErrorCount: number;
  missingCount: number;
  totalCount: number;
  tokens: GradeToken[];
  ocrText: string;
}

export interface QuestionResult {
  questionNumber: number;
  correctAnswer: string;
  result: GradeResult;
}

export interface MultiGradeResult {
  questions: QuestionResult[];
  totalScore: number;
}

export interface GradingOptions {
  ignorePunctuation: boolean;
  skipHeaderLine: boolean;
}
