import { NextRequest, NextResponse } from 'next/server';
import { GradeToken, GradeResult, QuestionResult, MultiGradeResult } from '@/types';

interface GradeQuestion {
  correct: string;
  student: string;
  originalIndex: number;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'OPENAI_API_KEY가 없습니다.' }, { status: 500 });
  }

  const body = await req.json() as { questions: GradeQuestion[]; ocrText?: string };
  const { questions, ocrText = '' } = body;

  if (!questions?.length) {
    return NextResponse.json({ error: '채점할 문항이 없습니다.' }, { status: 400 });
  }

  const questionList = questions
    .map((q, i) => `${i + 1}. 정답: "${q.correct}" | 학생: "${q.student}"`)
    .join('\n');

  const prompt =
    '당신은 초등학생 받아쓰기 채점 전문가입니다.\n' +
    '각 문항의 [정답]과 [학생 답]을 비교하여 정답 어절 단위로 채점하세요.\n\n' +
    '채점 규칙:\n' +
    '- "correct": 완전히 일치\n' +
    '- "spelling-error": 내용이 있지만 맞춤법 틀림 (예: 도움이→도름이, 돼요→되요)\n' +
    '- "spacing-error": 내용은 맞지만 띄어쓰기 오류 (붙여쓰거나 잘못 띄어씀)\n' +
    '- "missing": 해당 어절이 학생 답에 없음\n\n' +
    '주의:\n' +
    '- 정답의 각 어절마다 토큰 하나 생성\n' +
    '- student 필드: 학생이 해당 어절 위치에 쓴 텍스트 (없으면 빈 문자열)\n' +
    '- CLOVA OCR 인식 오류를 고려해 학생의 의도를 유연하게 판단\n' +
    '- 반드시 JSON만 출력\n\n' +
    '[문항]\n' +
    questionList + '\n\n' +
    '출력:\n' +
    '{"results":[{"tokens":[{"correct":"어절","student":"학생어절","status":"correct|spelling-error|spacing-error|missing"}]}]}';

  let gptRes: Response;
  try {
    gptRes = await fetch('https://api.openai.com/v1/chat/completions', {
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
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `GPT 서버 연결 실패: ${message}` }, { status: 502 });
  }

  if (!gptRes.ok) {
    const errText = await gptRes.text();
    console.error('GPT grade error:', errText);
    return NextResponse.json({ error: `GPT API 오류 (${gptRes.status})` }, { status: gptRes.status });
  }

  const gptData = await gptRes.json();
  const content: string = gptData.choices?.[0]?.message?.content ?? '{}';

  let parsed: { results?: { tokens?: { correct: string; student: string; status: string }[] }[] };
  try {
    parsed = JSON.parse(content);
  } catch {
    console.error('GPT grade parse error:', content);
    return NextResponse.json({ error: 'GPT 응답 파싱 실패' }, { status: 500 });
  }

  const validStatuses = new Set(['correct', 'spelling-error', 'spacing-error', 'missing']);

  const questionResults: QuestionResult[] = questions.map((q, i) => {
    const rawTokens = parsed.results?.[i]?.tokens ?? [];
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

    return {
      questionNumber: q.originalIndex + 1,
      correctAnswer: q.correct,
      result,
    };
  });

  const totalScore =
    questionResults.length > 0
      ? Math.round(questionResults.reduce((s, q) => s + q.result.score, 0) / questionResults.length)
      : 0;

  const multiGradeResult: MultiGradeResult = { questions: questionResults, totalScore };
  return NextResponse.json({ ...multiGradeResult, ocrText });
}
