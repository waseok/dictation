'use client';

import { useRef, useState } from 'react';

interface ImageCaptureProps {
  onGrade: (file: File) => void;
  onBack: () => void;
  loading: boolean;
}

async function applyRotation(file: File, degrees: number): Promise<File> {
  if (degrees === 0) return file;
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const rad = (degrees * Math.PI) / 180;

      if (degrees === 90 || degrees === 270) {
        canvas.width = h;
        canvas.height = w;
      } else {
        canvas.width = w;
        canvas.height = h;
      }

      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(rad);
      ctx.drawImage(img, -w / 2, -h / 2);
      URL.revokeObjectURL(url);

      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error('캔버스 변환 실패'));
          resolve(new File([blob], 'rotated.jpg', { type: 'image/jpeg' }));
        },
        'image/jpeg',
        0.92,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('이미지 로드 실패')); };
    img.src = url;
  });
}

export default function ImageCapture({ onGrade, onBack, loading }: ImageCaptureProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [rotation, setRotation] = useState(0);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setRotation(0);
    const url = URL.createObjectURL(file);
    setPreview(url);
  }

  function handleReset() {
    setPreview(null);
    setSelectedFile(null);
    setRotation(0);
    if (inputRef.current) inputRef.current.value = '';
  }

  function rotate(delta: number) {
    setRotation((prev) => (prev + delta + 360) % 360);
  }

  async function handleGrade() {
    if (!selectedFile) return;
    const rotated = await applyRotation(selectedFile, rotation);
    onGrade(rotated);
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-bold text-gray-800 mb-1">답안지 촬영</h2>
        <p className="text-sm text-gray-500">학생이 쓴 답안지를 사진으로 찍거나 업로드해주세요.</p>
      </div>

      {!preview ? (
        <div
          onClick={() => inputRef.current?.click()}
          className="w-full h-52 border-2 border-dashed border-gray-300 rounded-xl
                     flex flex-col items-center justify-center gap-2 cursor-pointer
                     hover:border-blue-400 hover:bg-blue-50 transition-colors bg-gray-50"
        >
          <span className="text-4xl">📷</span>
          <span className="text-sm font-medium text-gray-600">사진 찍기 / 파일 선택</span>
          <span className="text-xs text-gray-400">JPG, PNG, HEIC 지원</span>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {/* Preview */}
          <div
            className="relative w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-50
                       flex items-center justify-center"
            style={{ height: '280px' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="답안지 미리보기"
              style={{
                transform: `rotate(${rotation}deg)`,
                transition: 'transform 0.25s ease',
                maxWidth: rotation % 180 !== 0 ? '280px' : '100%',
                maxHeight: rotation % 180 !== 0 ? '100%' : '280px',
                objectFit: 'contain',
              }}
            />
            <button
              onClick={handleReset}
              className="absolute top-2 right-2 bg-white border border-gray-300 rounded-full
                         w-8 h-8 flex items-center justify-center text-gray-500
                         hover:bg-gray-100 shadow-sm z-10"
            >
              ✕
            </button>
          </div>

          {/* Rotation buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => rotate(-90)}
              className="flex-1 py-2 rounded-xl text-sm font-semibold text-gray-600
                         border border-gray-300 hover:bg-gray-50 transition-colors"
            >
              ↺ 왼쪽 회전
            </button>
            <button
              onClick={() => rotate(90)}
              className="flex-1 py-2 rounded-xl text-sm font-semibold text-gray-600
                         border border-gray-300 hover:bg-gray-50 transition-colors"
            >
              ↻ 오른쪽 회전
            </button>
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="flex gap-2">
        <button
          onClick={onBack}
          disabled={loading}
          className="flex-1 py-3 rounded-xl font-semibold text-gray-600 border border-gray-300
                     hover:bg-gray-50 active:bg-gray-100 transition-colors
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          ← 이전
        </button>
        <button
          onClick={handleGrade}
          disabled={!selectedFile || loading}
          className="flex-[2] py-3 rounded-xl font-semibold text-white text-base
                     bg-green-500 hover:bg-green-600 active:bg-green-700
                     disabled:bg-gray-300 disabled:cursor-not-allowed
                     transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              채점 중...
            </>
          ) : (
            '채점하기 ✓'
          )}
        </button>
      </div>
    </div>
  );
}
