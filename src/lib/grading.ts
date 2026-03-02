import { GradeResult, GradeToken, TokenStatus, MultiGradeResult, QuestionResult } from '@/types';

function tokenize(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

function removeSpaces(text: string): string {
  return text.replace(/\s+/g, '');
}

// LCS-based alignment: returns pairs of [correctIdx, studentIdx]
function lcsAlign(a: string[], b: string[]): [number, number][] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const pairs: [number, number][] = [];
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      pairs.unshift([i - 1, j - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  return pairs;
}

// Detect if spacing-only error: removing spaces from both yields the same string
function isSpacingError(correct: string, student: string): boolean {
  return removeSpaces(correct) === removeSpaces(student) && correct !== student;
}

export function grade(correctText: string, studentText: string): GradeResult {
  const correctWords = tokenize(correctText);
  const studentWords = tokenize(studentText);

  const tokens: GradeToken[] = [];

  if (correctWords.length === 0) {
    return {
      score: 0,
      correctCount: 0,
      spacingErrorCount: 0,
      spellingErrorCount: 0,
      missingCount: 0,
      totalCount: 0,
      tokens: [],
      ocrText: studentText,
    };
  }

  // Align using LCS on exact word matches
  const alignedPairs = lcsAlign(correctWords, studentWords);

  // Build a map: correctIdx -> studentIdx for exact matches
  const exactMatchMap = new Map<number, number>();
  for (const [ci, si] of alignedPairs) {
    exactMatchMap.set(ci, si);
  }

  // For unmatched correct words, try to find a spacing-error match greedily
  const usedStudentIndices = new Set(alignedPairs.map(([, si]) => si));

  // Map correctIdx -> {studentIdx, status}
  const matchResult = new Map<number, { studentIdx: number; status: TokenStatus }>();

  for (const [ci, si] of alignedPairs) {
    matchResult.set(ci, { studentIdx: si, status: 'correct' });
  }

  // For remaining correct words, look for best student word match
  for (let ci = 0; ci < correctWords.length; ci++) {
    if (matchResult.has(ci)) continue;

    const cw = correctWords[ci];
    let bestSi = -1;
    let bestStatus: TokenStatus = 'missing';

    // Search in student words not yet used, preferring nearby indices
    for (let si = 0; si < studentWords.length; si++) {
      if (usedStudentIndices.has(si)) continue;
      const sw = studentWords[si];

      if (sw === cw) {
        bestSi = si;
        bestStatus = 'correct';
        break;
      }
      // Loop only reaches here if sw !== cw (no exact match yet)
      if (removeSpaces(cw) === removeSpaces(sw)) {
        bestSi = si;
        bestStatus = 'spacing-error';
      } else if (bestSi === -1) {
        // Tentative spelling error match — we'll assign the closest unmatched student word
        // Only for words nearby (within ±2 positions)
        if (Math.abs(si - ci) <= 2) {
          bestSi = si;
          bestStatus = 'spelling-error';
        }
      }
    }

    if (bestSi !== -1) {
      usedStudentIndices.add(bestSi);
      matchResult.set(ci, { studentIdx: bestSi, status: bestStatus });
    } else {
      matchResult.set(ci, { studentIdx: -1, status: 'missing' });
    }
  }

  // Build tokens in order of correct words
  let correctCount = 0;
  let spacingErrorCount = 0;
  let spellingErrorCount = 0;
  let missingCount = 0;

  for (let ci = 0; ci < correctWords.length; ci++) {
    const cw = correctWords[ci];
    const match = matchResult.get(ci)!;
    const sw = match.studentIdx >= 0 ? studentWords[match.studentIdx] : '';

    let status = match.status;
    // Re-verify status
    if (sw === cw) {
      status = 'correct';
    } else if (sw !== '' && isSpacingError(cw, sw)) {
      status = 'spacing-error';
    } else if (sw !== '') {
      status = 'spelling-error';
    } else {
      status = 'missing';
    }

    tokens.push({ correct: cw, student: sw, status });

    if (status === 'correct') correctCount++;
    else if (status === 'spacing-error') spacingErrorCount++;
    else if (status === 'spelling-error') spellingErrorCount++;
    else missingCount++;
  }

  const totalCount = correctWords.length;
  const score = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;

  return {
    score,
    correctCount,
    spacingErrorCount,
    spellingErrorCount,
    missingCount,
    totalCount,
    tokens,
    ocrText: studentText,
  };
}

// Remove leading question numbers like "1.", "1)", "①", "②", etc.
function cleanAnswerLine(line: string): string {
  return line.replace(/^\s*(\d+[.)]\s*|[①②③④⑤⑥⑦⑧⑨⑩]\s*)/, '').trim();
}

// Split OCR text into per-question lines
export function splitOcrLines(text: string): string[] {
  return text.split('\n').map(cleanAnswerLine);
}

// Grade multiple questions from a single OCR text
export function gradeMultiple(correctAnswers: string[], ocrText: string): MultiGradeResult {
  const ocrLines = splitOcrLines(ocrText);
  const activeAnswers = correctAnswers.map((a, i) => ({ answer: a, originalIndex: i }))
    .filter(({ answer }) => answer.trim().length > 0);

  const questions: QuestionResult[] = activeAnswers.map(({ answer, originalIndex }, i) => {
    const studentLine = ocrLines[i] ?? '';
    return {
      questionNumber: originalIndex + 1,
      correctAnswer: answer,
      result: grade(answer, studentLine),
    };
  });

  const totalScore =
    questions.length > 0
      ? Math.round(questions.reduce((sum, q) => sum + q.result.score, 0) / questions.length)
      : 0;

  return { questions, totalScore };
}
