export type TokenStatus = 'correct' | 'spelling-error' | 'spacing-error' | 'missing';

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
