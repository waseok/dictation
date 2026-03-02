import { NextRequest, NextResponse } from 'next/server';

// Gemini 2.5 Flash Vision으로 그리드 방식 받아쓰기 시험지 인식
// 장점: GPT-4o 대비 빠름, 저렴, 멀티모달 인식 성능 우수

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'GEMINI_API_KEY가 없습니다. .env.local에 GEMINI_API_KEY를 설정해주세요.' },
      { status: 500 },
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: '이미지를 읽을 수 없습니다.' }, { status: 400 });
  }

  const file = formData.get('image') as File | null;
  if (!file) {
    return NextResponse.json({ error: '이미지 파일이 필요합니다.' }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');
  const mimeType = file.type || 'image/jpeg';

  const prompt =
    '이 이미지는 초등학생 한글 받아쓰기 시험지야.\n' +
    '학생이 칸(그리드)에 한 글자씩 손으로 썼어.\n\n' +
    '━━━ 절대 규칙 ━━━\n' +
    '학생이 쓴 글자를 절대 수정하지 마.\n' +
    '맞춤법·철자 오류가 있어도 그대로 읽어야 해.\n' +
    '예) 학생이 "되요"로 썼으면 → "되요" (❌ "돼요"로 수정 금지)\n' +
    '예) 학생이 "맞추다"로 썼으면 → "맞추다" (❌ "맞히다"로 수정 금지)\n' +
    '예) 학생이 칸을 비웠으면 → "" (빈 문자열)\n\n' +
    '━━━ 인식 방법 ━━━\n' +
    '- 왼쪽 또는 위쪽에 있는 문항 번호(1, 2, 3...)를 기준으로 각 답을 읽어\n' +
    '- 각 문항의 칸들을 왼쪽→오른쪽 순서로 이어 읽어\n' +
    '- 어절(단어) 사이 빈 칸이 있으면 띄어쓰기로 표시해\n' +
    '- 글자를 읽기 어려우면 가장 비슷한 한글 글자로 읽어\n\n' +
    'JSON만 출력 (다른 설명 없음):\n' +
    '{"1":"학생이 쓴 답","2":"학생이 쓴 답","3":"학생이 쓴 답",...}';

  let geminiRes: Response;
  try {
    geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                { inline_data: { mime_type: mimeType, data: base64 } },
              ],
            },
          ],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 2048,
            responseMimeType: 'application/json',
          },
        }),
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `OCR 서버에 연결할 수 없습니다. (${message})` },
      { status: 502 },
    );
  }

  if (!geminiRes.ok) {
    const errText = await geminiRes.text();
    console.error('Gemini OCR error:', errText);
    return NextResponse.json(
      { error: `OCR API 오류 (${geminiRes.status}): ${errText}` },
      { status: geminiRes.status },
    );
  }

  const data = await geminiRes.json();
  // thinking 모델은 parts[0]이 사고 과정(thought:true), parts[1]이 실제 응답
  const parts: { text?: string; thought?: boolean }[] =
    data.candidates?.[0]?.content?.parts ?? [];
  const responsePart = parts.find((p) => !p.thought && p.text != null) ?? parts[0] ?? {};
  const rawContent: string = responsePart.text ?? '{}';
  // 마크다운 코드블록 감싸진 경우 제거
  const content = rawContent.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  console.log('[ocr] gemini result:', content);

  let lines: Record<string, string>;
  try {
    lines = JSON.parse(content) as Record<string, string>;
  } catch {
    console.error('[ocr] parse failed. raw parts:', JSON.stringify(data.candidates?.[0]?.content?.parts));
    return NextResponse.json(
      { error: `OCR 파싱 실패. 응답: ${content.slice(0, 300)}` },
      { status: 422 },
    );
  }

  // text: 사람이 읽기 좋은 형태 (기존 인터페이스 호환)
  const text = Object.entries(lines)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([num, answer]) => `${num} ${answer}`)
    .join('\n');

  return NextResponse.json({ text, lines });
}
