import { NextRequest, NextResponse } from 'next/server';

// GPT-4o Vision으로 그리드 방식 받아쓰기 시험지 인식
// CLOVA OCR 대비 장점: 이미지 전체 맥락 이해, 한국어 손글씨에 강함, 문항 번호 기준 구조화

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'OPENAI_API_KEY가 없습니다.' },
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

  let visionRes: Response;
  try {
    visionRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: { url: `data:${mimeType};base64,${base64}`, detail: 'high' },
              },
            ],
          },
        ],
        max_tokens: 600,
        temperature: 0,
        response_format: { type: 'json_object' },
      }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `OCR 서버에 연결할 수 없습니다. (${message})` },
      { status: 502 },
    );
  }

  if (!visionRes.ok) {
    const errText = await visionRes.text();
    console.error('GPT-4o Vision OCR error:', errText);
    return NextResponse.json(
      { error: `OCR API 오류 (${visionRes.status}): ${errText}` },
      { status: visionRes.status },
    );
  }

  const data = await visionRes.json();
  const content: string = data.choices?.[0]?.message?.content ?? '{}';
  console.log('[ocr] vision result:', content);

  let lines: Record<string, string>;
  try {
    lines = JSON.parse(content) as Record<string, string>;
  } catch {
    return NextResponse.json(
      { error: 'OCR 결과를 파싱할 수 없습니다.' },
      { status: 422 },
    );
  }

  // text: 사람이 읽기 좋은 형태로 변환 (기존 인터페이스 호환)
  const text = Object.entries(lines)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([num, answer]) => `${num} ${answer}`)
    .join('\n');

  return NextResponse.json({ text, lines });
}
