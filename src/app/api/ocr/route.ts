import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'OpenAI API 키가 없습니다. .env.local에 OPENAI_API_KEY를 설정해주세요.' },
      { status: 500 }
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
    '이 이미지는 초등학생이 쓴 받아쓰기 답안지입니다. ' +
    '각 문항 번호와 학생이 쓴 답을 정확히 읽어서 아래 형식으로만 출력하세요. ' +
    '절대 내용을 수정하거나 맞춤법을 고치지 마세요. 학생이 쓴 그대로 출력하세요.\n\n' +
    '출력 형식:\n' +
    '1. [1번 답]\n' +
    '2. [2번 답]\n' +
    '3. [3번 답]\n' +
    '...\n\n' +
    '문항 번호가 보이지 않으면 줄 순서대로 번호를 붙이세요. ' +
    '답이 없는 문항은 해당 번호만 쓰고 답 칸을 비워두세요.';

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
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: { url: `data:${mimeType};base64,${base64}` },
              },
            ],
          },
        ],
        max_tokens: 1000,
      }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `OpenAI 서버에 연결할 수 없습니다. (${message})` },
      { status: 502 }
    );
  }

  if (!gptRes.ok) {
    const errText = await gptRes.text();
    console.error('OpenAI API error:', errText);
    return NextResponse.json(
      { error: `OpenAI API 오류 (${gptRes.status}): ${errText}` },
      { status: gptRes.status }
    );
  }

  const data = await gptRes.json();
  const text: string = data.choices?.[0]?.message?.content?.trim() ?? '';

  if (!text) {
    return NextResponse.json({ error: 'GPT가 텍스트를 인식하지 못했습니다.' }, { status: 422 });
  }

  return NextResponse.json({ text });
}
