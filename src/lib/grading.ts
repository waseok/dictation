import { GradeResult, GradeToken, TokenStatus, MultiGradeResult, QuestionResult, GradingOptions } from '@/types';

const PUNCTUATION_RE = /[.,!?。、·…""''「」『』〈〉《》【】~]/g;

/** NFC 정규화 – 한국어 유니코드 조합 방식 차이로 인한 오채점 방지 */
function norm(text: string): string {
  return text.normalize('NFC');
}

function stripPunctuation(text: string): string {
  return norm(text).replace(PUNCTUATION_RE, '').replace(/\s+/g, ' ').trim();
}

function tokenize(text: string): string[] {
  return norm(text).trim().split(/\s+/).filter(Boolean);
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

export function grade(
  correctText: string,
  studentText: string,
  ignorePunctuation = false,
): GradeResult {
  const norm = ignorePunctuation ? stripPunctuation : (t: string) => t;
  const correctWords = tokenize(norm(correctText));
  const studentWords = tokenize(norm(studentText));

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

  const alignedPairs = lcsAlign(correctWords, studentWords);
  const exactMatchMap = new Map<number, number>();
  for (const [ci, si] of alignedPairs) {
    exactMatchMap.set(ci, si);
  }

  const usedStudentIndices = new Set(alignedPairs.map(([, si]) => si));
  const matchResult = new Map<number, { studentIdx: number; status: TokenStatus }>();

  for (const [ci, si] of alignedPairs) {
    matchResult.set(ci, { studentIdx: si, status: 'correct' });
  }

  for (let ci = 0; ci < correctWords.length; ci++) {
    if (matchResult.has(ci)) continue;

    const cw = correctWords[ci];
    let bestSi = -1;
    let bestStatus: TokenStatus = 'missing';

    for (let si = 0; si < studentWords.length; si++) {
      if (usedStudentIndices.has(si)) continue;
      const sw = studentWords[si];

      if (sw === cw) {
        bestSi = si;
        bestStatus = 'correct';
        break;
      }
      if (removeSpaces(cw) === removeSpaces(sw)) {
        bestSi = si;
        bestStatus = 'spacing-error';
      } else if (bestSi === -1 && Math.abs(si - ci) <= 2) {
        bestSi = si;
        bestStatus = 'spelling-error';
      }
    }

    if (bestSi !== -1) {
      usedStudentIndices.add(bestSi);
      matchResult.set(ci, { studentIdx: bestSi, status: bestStatus });
    } else {
      matchResult.set(ci, { studentIdx: -1, status: 'missing' });
    }
  }

  const tokens: GradeToken[] = [];
  let correctCount = 0;
  let spacingErrorCount = 0;
  let spellingErrorCount = 0;
  let missingCount = 0;

  for (let ci = 0; ci < correctWords.length; ci++) {
    const cw = correctWords[ci];
    const match = matchResult.get(ci)!;
    const sw = match.studentIdx >= 0 ? studentWords[match.studentIdx] : '';

    let status: TokenStatus;
    if (sw === cw) status = 'correct';
    else if (sw !== '' && removeSpaces(cw) === removeSpaces(sw)) status = 'spacing-error';
    else if (sw !== '') status = 'spelling-error';
    else status = 'missing';

    tokens.push({ correct: cw, student: sw, status });

    if (status === 'correct') correctCount++;
    else if (status === 'spacing-error') spacingErrorCount++;
    else if (status === 'spelling-error') spellingErrorCount++;
    else missingCount++;
  }

  const totalCount = correctWords.length;
  const score = Math.round((correctCount / totalCount) * 100);

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

// Remove leading question numbers like "1.", "1)", "①" etc.
function cleanAnswerLine(line: string): string {
  return line.replace(/^\s*(\d+[.)]\s*|[①②③④⑤⑥⑦⑧⑨⑩]\s*)/, '').trim();
}

const CIRCLE_NUMS = '①②③④⑤⑥⑦⑧⑨⑩';
const QUESTION_START_RE = /^(\d+)[.)]\s*(.*)/;
const CIRCLE_START_RE = new RegExp(`^([${CIRCLE_NUMS}])\\s*(.*)`);

// Parse OCR text into per-question lines using question numbers as anchors.
// Lines that don't start with a question number are treated as continuations
// of the previous question, which fixes the "one answer split into two OCR lines"
// alignment bug. Falls back to simple line-split if no question numbers are found.
export function splitOcrLines(text: string, skipFirstLine = false): string[] {
  // Handle JSON format: { "1": "answer1", "2": "answer2", ... }
  const trimmed = text.trim();
  if (trimmed.startsWith('{')) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const entries = Object.entries(parsed as Record<string, unknown>)
          .map(([k, v]) => ({ num: parseInt(k, 10), val: String(v) }))
          .filter(({ num }) => !isNaN(num));
        if (entries.length > 0) {
          const maxQ = Math.max(...entries.map((e) => e.num));
          return Array.from({ length: maxQ }, (_, i) => {
            const entry = entries.find((e) => e.num === i + 1);
            return entry ? entry.val : '';
          });
        }
      }
    } catch {
      // Not valid JSON, continue to line-based parsing
    }
  }

  const rawLines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  const questionMap = new Map<number, string>();
  let lastQuestionNum: number | null = null;

  for (const line of rawLines) {
    const numMatch = line.match(QUESTION_START_RE);
    const circleMatch = line.match(CIRCLE_START_RE);

    if (numMatch) {
      const questionNum = parseInt(numMatch[1], 10);
      const content = numMatch[2].trim();
      questionMap.set(questionNum, content);
      lastQuestionNum = questionNum;
    } else if (circleMatch) {
      const questionNum = CIRCLE_NUMS.indexOf(circleMatch[1]) + 1;
      const content = circleMatch[2].trim();
      questionMap.set(questionNum, content);
      lastQuestionNum = questionNum;
    } else if (lastQuestionNum !== null) {
      // Continuation line: merge into the current question
      const existing = questionMap.get(lastQuestionNum) ?? '';
      questionMap.set(lastQuestionNum, existing ? `${existing} ${line}` : line);
    }
    // Lines before any question number (e.g. name/title headers) are ignored
  }

  // Fallback: no question numbers detected → use simple line-based split
  if (questionMap.size === 0) {
    const lines = rawLines.map(cleanAnswerLine);
    return skipFirstLine ? lines.slice(1) : lines;
  }

  const maxQ = Math.max(...questionMap.keys());
  return Array.from({ length: maxQ }, (_, i) => questionMap.get(i + 1) ?? '');
}

/** Grade online exam where each student answer is typed directly (no OCR) */
export function gradeMultipleDirect(
  correctAnswers: string[],
  studentAnswers: string[],
  options: Partial<GradingOptions> = {},
): MultiGradeResult {
  const { ignorePunctuation = false } = options;

  const activeAnswers = correctAnswers
    .map((answer, i) => ({ answer, originalIndex: i }))
    .filter(({ answer }) => answer.trim().length > 0);

  const questions: QuestionResult[] = activeAnswers.map(({ answer, originalIndex }) => {
    const studentAnswer = studentAnswers[originalIndex] ?? '';
    return {
      questionNumber: originalIndex + 1,
      correctAnswer: answer,
      result: grade(answer, studentAnswer, ignorePunctuation),
    };
  });

  const totalScore =
    questions.length > 0
      ? Math.round(questions.reduce((sum, q) => sum + q.result.score, 0) / questions.length)
      : 0;

  return { questions, totalScore };
}

export function gradeMultiple(
  correctAnswers: string[],
  ocrText: string,
  options: Partial<GradingOptions> = {},
): MultiGradeResult {
  const { ignorePunctuation = false, skipHeaderLine = false } = options;
  const ocrLines = splitOcrLines(ocrText, skipHeaderLine);

  const activeAnswers = correctAnswers
    .map((answer, i) => ({ answer, originalIndex: i }))
    .filter(({ answer }) => answer.trim().length > 0);

  const questions: QuestionResult[] = activeAnswers.map(({ answer, originalIndex }, i) => {
    const studentLine = ocrLines[i] ?? '';
    return {
      questionNumber: originalIndex + 1,
      correctAnswer: answer,
      result: grade(answer, studentLine, ignorePunctuation),
    };
  });

  const totalScore =
    questions.length > 0
      ? Math.round(questions.reduce((sum, q) => sum + q.result.score, 0) / questions.length)
      : 0;

  return { questions, totalScore };
}
