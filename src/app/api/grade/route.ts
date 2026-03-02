import { NextRequest, NextResponse } from 'next/server';
import { splitOcrLines } from '@/lib/grading';
import { GradeToken, GradeResult, QuestionResult, MultiGradeResult } from '@/types';

// ─── Step 1: GPT-4o-mini로 CLOVA OCR 원문 정제 ───────────────────────────────
// 그리드 방식 시험지에서 CLOVA는 글자 하나마다 공백을 넣고 줄바꿈을 임의로 삽입함.
// 이 단계에서는 "형식만 정리"하고 절대 맞춤법·철자를 수정하지 않는다.
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
    '예) "맞추다" → "맞추다" 유지 (❌ "맞히다"로 수정 금지)\n' +
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

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 600,
      temperature: 0, // 창의적 수정 방지
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`normalize API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const content: string = data.choices?.[0]?.message?.content ?? '{}';
  console.log('[normalize] result:', content);
  return JSON.parse(content) as Record<string, string>;
}

// ─── Step 2: GPT-4o로 정답 vs 학생 답 채점 ──────────────────────────────────
interface GradeQuestion {
  correct: string;
  student: string;
  originalIndex: number;
}

async function gradeWithGpt(
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

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`grade API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const content: string = data.choices?.[0]?.message?.content ?? '{}';
  const parsed = JSON.parse(content) as {
    results?: { tokens?: { correct: string; student: string; status: string }[] }[];
  };
  return parsed.results ?? [];
}

// ─── Main handler ────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'OPENAI_API_KEY가 없습니다.' }, { status: 500 });
  }

  const body = await req.json() as { answers: string[]; ocrText: string };
  const { answers, ocrText } = body;

  if (!answers?.length || !ocrText) {
    return NextResponse.json({ error: '채점할 문항이나 OCR 텍스트가 없습니다.' }, { status: 400 });
  }

  const activeAnswers = answers
    .map((correct, i) => ({ correct: correct.trim(), originalIndex: i }))
    .filter((q) => q.correct.length > 0);

  // Step 1: GPT-4o-mini로 CLOVA OCR 원문 정제
  // 정제 실패 시 splitOcrLines() 결과로 폴백 (서비스 중단 방지)
  let normalizedMap: Record<string, string> = {};
  let normalizeError: string | null = null;
  try {
    normalizedMap = await normalizeOcrText(ocrText, activeAnswers.length, apiKey);
  } catch (err) {
    normalizeError = err instanceof Error ? err.message : String(err);
    console.error('[normalize] failed, falling back to splitOcrLines:', normalizeError);
    const fallbackLines = splitOcrLines(ocrText);
    activeAnswers.forEach((q, i) => {
      normalizedMap[String(q.originalIndex + 1)] = fallbackLines[i] ?? '';
    });
  }

  const questions: GradeQuestion[] = activeAnswers.map((q) => ({
    correct: q.correct,
    student: normalizedMap[String(q.originalIndex + 1)] ?? '',
    originalIndex: q.originalIndex,
  }));

  // Step 2: GPT-4o로 채점
  let rawResults: { tokens: { correct: string; student: string; status: string }[] }[] = [];
  try {
    rawResults = await gradeWithGpt(questions, apiKey);
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
