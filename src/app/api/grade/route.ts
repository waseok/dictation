import { NextRequest, NextResponse } from 'next/server';
import { splitOcrLines } from '@/lib/grading';
import { GradeToken, GradeResult, QuestionResult, MultiGradeResult } from '@/types';

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash:generateContent';

async function callGemini(prompt: string, apiKey: string, maxOutputTokens = 4096): Promise<string> {
  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0,
        maxOutputTokens,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
}

// ─── Step 1 (폴백): CLOVA OCR 원문 정제 ──────────────────────────────────────
async function normalizeOcrText(
  rawText: string,
  questionCount: number,
  apiKey: string,
): Promise<Record<string, string>> {
  const prompt =
    '다음은 한글 받아쓰기 시험지(그리드 칸 방식)를 CLOVA OCR이 인식한 원문이야.\n' +
    '그리드 형식이라 모든 글자 사이에 공백이 삽입되고 줄바꿈이 임의로 들어가 있어.\n\n' +
    '━━━ 절대 규칙 (이게 제일 중요해) ━━━\n' +
    '학생이 쓴 글자를 절대 수정하지 마.\n' +
    '맞춤법·철자 오류가 있어도 그대로 유지해야 해.\n' +
    '예) "되요" → "되요" 유지 (❌ "돼요"로 수정 금지)\n' +
    '예) "도름이" → "도름이" 유지 (❌ "도움이"로 수정 금지)\n' +
    '이 텍스트는 채점용이라 학생 실수를 그대로 보존해야 해.\n\n' +
    '━━━ 처리 방법 ━━━\n' +
    `- 총 ${questionCount}문항\n` +
    '- 문항 번호(1, 2, 3...)를 기준으로 각 답을 하나의 문자열로 복원해\n' +
    '- 글자 사이의 불필요한 공백만 제거하고 어절(단어) 단위 띄어쓰기는 유지해\n' +
    '- 답이 없는 문항은 빈 문자열 ""\n\n' +
    '━━━ OCR 원문 ━━━\n' +
    rawText + '\n\n' +
    'JSON만 출력 (설명 없음):\n' +
    '{"1":"복원된 답","2":"복원된 답",...}';

  const content = await callGemini(prompt, apiKey);
  console.log('[normalize] result:', content);
  return JSON.parse(content) as Record<string, string>;
}

// ─── Step 2: Gemini 2.5 Flash로 채점 ─────────────────────────────────────────
interface GradeQuestion {
  correct: string;
  student: string;
  originalIndex: number;
}

async function gradeWithGemini(
  questions: GradeQuestion[],
  apiKey: string,
): Promise<{ tokens: { correct: string; student: string; status: string }[] }[]> {
  const questionList = questions
    .map((q, i) => `${i + 1}. 정답: "${q.correct}" | 학생: "${q.student}"`)
    .join('\n');

  const prompt =
    '초등학생 받아쓰기 채점 전문가야.\n' +
    '각 문항의 [정답]과 [학생 답]을 비교해 정답 어절 단위로 채점해.\n\n' +
    '채점 기준:\n' +
    '- "correct": 완전히 일치\n' +
    '- "spelling-error": 맞춤법 틀림 (예: 도움이→도름이, 돼요→되요)\n' +
    '- "spacing-error": 내용은 맞지만 띄어쓰기 오류\n' +
    '- "missing": 해당 어절이 학생 답에 없음\n\n' +
    '규칙:\n' +
    '- 정답의 각 어절마다 토큰 하나 생성\n' +
    '- student 필드: 학생이 해당 어절 위치에 쓴 텍스트 (없으면 "")\n' +
    '- JSON만 출력\n\n' +
    '[문항]\n' +
    questionList + '\n\n' +
    '출력:\n' +
    '{"results":[{"tokens":[{"correct":"어절","student":"학생어절","status":"correct|spelling-error|spacing-error|missing"}]}]}';

  const content = await callGemini(prompt, apiKey, 8192);
  console.log('[grade] result:', content);
  const parsed = JSON.parse(content) as {
    results?: { tokens: { correct: string; student: string; status: string }[] }[];
  };
  return (parsed.results ?? []).map((r) => ({ tokens: r.tokens ?? [] }));
}

// ─── Main handler ────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY가 없습니다.' }, { status: 500 });
  }

  const body = await req.json() as {
    answers: string[];
    ocrText: string;
    lines?: Record<string, string>; // Gemini Vision OCR 결과 (있으면 normalize 생략)
  };
  const { answers, ocrText, lines: visionLines } = body;

  if (!answers?.length || !ocrText) {
    return NextResponse.json({ error: '채점할 문항이나 OCR 텍스트가 없습니다.' }, { status: 400 });
  }

  const activeAnswers = answers
    .map((correct, i) => ({ correct: correct.trim(), originalIndex: i }))
    .filter((q) => q.correct.length > 0);

  // Step 1: 학생 답 확정
  // Gemini Vision이 이미 문항별로 인식했으면 그대로 사용, 없으면 Gemini로 정제
  let studentAnswerMap: Record<string, string> = {};
  let normalizeError: string | null = null;

  if (visionLines && Object.keys(visionLines).length > 0) {
    studentAnswerMap = visionLines;
  } else {
    try {
      studentAnswerMap = await normalizeOcrText(ocrText, activeAnswers.length, apiKey);
    } catch (err) {
      normalizeError = err instanceof Error ? err.message : String(err);
      console.error('[normalize] failed, falling back to splitOcrLines:', normalizeError);
      const fallbackLines = splitOcrLines(ocrText);
      activeAnswers.forEach((q, i) => {
        studentAnswerMap[String(q.originalIndex + 1)] = fallbackLines[i] ?? '';
      });
    }
  }

  const questions: GradeQuestion[] = activeAnswers.map((q) => ({
    correct: q.correct,
    student: studentAnswerMap[String(q.originalIndex + 1)] ?? '',
    originalIndex: q.originalIndex,
  }));

  // Step 2: Gemini 2.5 Flash로 채점
  let rawResults: { tokens: { correct: string; student: string; status: string }[] }[] = [];
  try {
    rawResults = await gradeWithGemini(questions, apiKey);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `채점 실패: ${message}` }, { status: 502 });
  }

  const validStatuses = new Set(['correct', 'spelling-error', 'spacing-error', 'missing']);

  const questionResults: QuestionResult[] = questions.map((q, i) => {
    const rawTokens = rawResults[i]?.tokens ?? [];
    const tokens: GradeToken[] = rawTokens.map((t) => ({
      correct: t.correct ?? '',
      student: t.student ?? '',
      status: validStatuses.has(t.status) ? (t.status as GradeToken['status']) : 'missing',
    }));

    const totalCount = tokens.length || 1;
    const correctCount = tokens.filter((t) => t.status === 'correct').length;
    const spellingErrorCount = tokens.filter((t) => t.status === 'spelling-error').length;
    const spacingErrorCount = tokens.filter((t) => t.status === 'spacing-error').length;
    const missingCount = tokens.filter((t) => t.status === 'missing').length;
    const score = Math.round((correctCount / totalCount) * 100);

    const result: GradeResult = {
      score,
      correctCount,
      spellingErrorCount,
      spacingErrorCount,
      missingCount,
      totalCount,
      tokens,
      ocrText: q.student,
    };

    return { questionNumber: q.originalIndex + 1, correctAnswer: q.correct, result };
  });

  const totalScore =
    questionResults.length > 0
      ? Math.round(questionResults.reduce((s, q) => s + q.result.score, 0) / questionResults.length)
      : 0;

  const multiGradeResult: MultiGradeResult = { questions: questionResults, totalScore };
  return NextResponse.json({
    ...multiGradeResult,
    ocrText,
    ...(normalizeError ? { normalizeWarning: normalizeError } : {}),
  });
}
