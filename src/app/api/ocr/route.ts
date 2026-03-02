import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

interface ClovaField {
  inferText: string;
  lineBreak: boolean;
}

interface ClovaImage {
  inferResult: string;
  message: string;
  fields: ClovaField[];
}

interface ClovaResponse {
  images: ClovaImage[];
}

export async function POST(req: NextRequest) {
  const invokeUrl = process.env.CLOVA_OCR_INVOKE_URL;
  const secret = process.env.CLOVA_OCR_SECRET;

  if (!invokeUrl || !secret) {
    return NextResponse.json(
      { error: 'OCR API 설정이 없습니다. .env.local에 CLOVA_OCR_INVOKE_URL과 CLOVA_OCR_SECRET을 설정해주세요.' },
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

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const format = ext === 'jpg' ? 'jpeg' : ext;

  const body = {
    version: 'V2',
    requestId: randomUUID(),
    timestamp: 0,
    lang: 'ko',
    images: [
      {
        format,
        name: file.name,
        data: base64,
      },
    ],
  };

  let clovaRes: Response;
  try {
    clovaRes = await fetch(invokeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-OCR-SECRET': secret,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('CLOVA OCR fetch error:', message);
    return NextResponse.json(
      { error: `OCR 서버에 연결할 수 없습니다. (${message}) — Vercel 환경변수(CLOVA_OCR_INVOKE_URL, CLOVA_OCR_SECRET)가 설정되어 있는지 확인해주세요.` },
      { status: 502 }
    );
  }

  if (!clovaRes.ok) {
    const errText = await clovaRes.text();
    console.error('CLOVA OCR error response:', errText);
    return NextResponse.json(
      { error: `OCR API 오류 (${clovaRes.status}): ${errText}` },
      { status: clovaRes.status }
    );
  }

  const data: ClovaResponse = await clovaRes.json();
  const image = data.images?.[0];

  if (!image || image.inferResult !== 'SUCCESS') {
    return NextResponse.json(
      { error: `OCR 인식 실패: ${image?.message ?? '알 수 없는 오류'}` },
      { status: 422 }
    );
  }

  // Reconstruct text from fields, respecting line breaks
  const text = (image.fields ?? [])
    .map((field) => field.inferText + (field.lineBreak ? '\n' : ' '))
    .join('')
    .trim();

  return NextResponse.json({ text });
}
