'use client';

import { useRef, useState } from 'react';
import { MultiGradeResult, QuestionResult } from '@/types';
import DiffView from './DiffView';

interface GradingResultProps {
  result: MultiGradeResult;
  ocrText?: string;
  onReset: () => void;
  onNewStudent: () => void;
}

function QuestionRow({ q }: { q: QuestionResult }) {
  const isCorrect = q.result.score === 100;
  const [showOcr, setShowOcr] = useState(false);

  return (
    <div className={`rounded-xl overflow-hidden border ${isCorrect ? 'border-green-200' : 'border-red-200'}`}>
      {/* Header */}
      <div className={`flex items-center gap-3 px-4 py-3 ${isCorrect ? 'bg-green-50' : 'bg-red-50'}`}>
        <span className="text-sm font-bold text-gray-500 w-6 shrink-0">{q.questionNumber}.</span>
        <span className="flex-1 text-sm text-gray-800 font-medium">{q.correctAnswer}</span>
        <span className={`text-lg font-bold shrink-0 ${isCorrect ? 'text-green-600' : 'text-red-500'}`}>
          {isCorrect ? '✓' : '✗'}
        </span>
      </div>

      {/* Error detail — always visible when wrong */}
      {!isCorrect && (
        <div className="px-4 py-3 bg-white flex flex-col gap-2">
          <DiffView tokens={q.result.tokens} />
          {q.result.ocrText && (
            <button
              onClick={() => setShowOcr((v) => !v)}
              className="text-left text-xs text-gray-400 hover:text-gray-600"
            >
              {showOcr ? '▲ 인식 원문 숨기기' : '▼ 인식 원문 보기'}
            </button>
          )}
          {showOcr && q.result.ocrText && (
            <p className="text-xs font-mono text-gray-500 bg-gray-50 rounded px-2 py-1">
              {q.result.ocrText}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function GradingResult({ result, ocrText, onReset, onNewStudent }: GradingResultProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [showRawOcr, setShowRawOcr] = useState(false);

  const correctCount = result.questions.filter((q) => q.result.score === 100).length;
  const totalCount = result.questions.length;

  const today = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  async function handleDownload() {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });
      const dataUrl = canvas.toDataURL('image/png');

      const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
      if (isMobile && navigator.share && navigator.canShare) {
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], '채점결과.png', { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: '받아쓰기 채점 결과' });
          return;
        }
      }

      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = '채점결과.png';
      a.click();
    } catch (err) {
      console.error('Download failed:', err);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Downloadable summary card */}
      <div
        ref={cardRef}
        className="bg-white rounded-2xl border border-gray-200 p-5 flex flex-col gap-4 shadow-sm"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-800">채점 결과</h2>
          <span className="text-xs text-gray-400">{today}</span>
        </div>

        {/* Summary */}
        <div className="flex items-center justify-center gap-3 py-1">
          <span className={`text-4xl font-black tabular-nums ${correctCount === totalCount ? 'text-green-500' : 'text-red-500'}`}>
            {correctCount}
          </span>
          <span className="text-xl text-gray-400 font-bold">/</span>
          <span className="text-4xl font-black tabular-nums text-gray-700">{totalCount}</span>
          <span className="text-sm text-gray-500 ml-1">정답</span>
        </div>

        {/* Per-question list */}
        <div className="flex flex-col gap-2">
          {result.questions.map((q) => (
            <QuestionRow key={q.questionNumber} q={q} />
          ))}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 text-xs text-gray-500 px-1">
          <span><span className="inline-block w-2 h-2 rounded-sm bg-green-400 mr-1" />정답</span>
          <span><span className="inline-block w-2 h-2 rounded-sm bg-red-400 mr-1" />맞춤법 오류</span>
          <span><span className="inline-block w-2 h-2 rounded-sm bg-yellow-400 mr-1" />띄어쓰기 오류</span>
          <span><span className="inline-block w-2 h-2 rounded-sm bg-gray-300 mr-1" />누락</span>
        </div>
      </div>

      {/* Raw OCR debug panel */}
      {ocrText && (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <button
            onClick={() => setShowRawOcr((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-2 bg-gray-50 hover:bg-gray-100 text-xs text-gray-500"
          >
            <span>CLOVA OCR 인식 원문</span>
            <span>{showRawOcr ? '▲' : '▼'}</span>
          </button>
          {showRawOcr && (
            <pre className="px-4 py-3 text-xs font-mono text-gray-700 whitespace-pre-wrap bg-white">
              {ocrText}
            </pre>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={onReset}
          className="flex-1 py-3 rounded-xl font-semibold text-gray-600 border border-gray-300
                     hover:bg-gray-50 active:bg-gray-100 transition-colors"
        >
          다시 촬영
        </button>
        <button
          onClick={onNewStudent}
          className="flex-1 py-3 rounded-xl font-semibold text-white
                     bg-blue-500 hover:bg-blue-600 active:bg-blue-700 transition-colors"
        >
          다음 학생 →
        </button>
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="flex-[2] py-3 rounded-xl font-semibold text-white
                     bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700
                     disabled:opacity-60 disabled:cursor-not-allowed
                     transition-colors flex items-center justify-center gap-2"
        >
          {downloading ? (
            <>
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              저장 중...
            </>
          ) : (
            '결과 저장 ↓'
          )}
        </button>
      </div>
    </div>
  );
}
