'use client';

import { useRef, useState } from 'react';
import { GradeResult } from '@/types';
import DiffView from './DiffView';

interface GradingResultProps {
  result: GradeResult;
  onReset: () => void;
}

function ScoreRing({ score }: { score: number }) {
  const color =
    score >= 80 ? 'text-green-500' : score >= 50 ? 'text-yellow-500' : 'text-red-500';
  return (
    <div className={`text-6xl font-black ${color} tabular-nums`}>
      {score}
      <span className="text-3xl font-bold">점</span>
    </div>
  );
}

export default function GradingResult({ result, onReset }: GradingResultProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [showOcr, setShowOcr] = useState(false);

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

  const today = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="flex flex-col gap-4">
      {/* Downloadable card */}
      <div
        ref={cardRef}
        className="bg-white rounded-2xl border border-gray-200 p-5 flex flex-col gap-4 shadow-sm"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-800">채점 결과</h2>
          <span className="text-xs text-gray-400">{today}</span>
        </div>

        {/* Score */}
        <div className="flex items-center justify-center py-2">
          <ScoreRing score={result.score} />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 text-center">
          <StatBox label="정답" value={result.correctCount} color="green" />
          <StatBox label="맞춤법" value={result.spellingErrorCount} color="red" />
          <StatBox label="띄어쓰기" value={result.spacingErrorCount} color="yellow" />
          <StatBox label="누락" value={result.missingCount} color="gray" />
        </div>

        {/* Word diff */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            단어별 채점
          </p>
          <DiffView tokens={result.tokens} />
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 text-xs text-gray-500">
          <span>
            <span className="inline-block w-2 h-2 rounded-sm bg-green-400 mr-1" />
            정답
          </span>
          <span>
            <span className="inline-block w-2 h-2 rounded-sm bg-red-400 mr-1" />
            맞춤법 오류
          </span>
          <span>
            <span className="inline-block w-2 h-2 rounded-sm bg-yellow-400 mr-1" />
            띄어쓰기 오류
          </span>
          <span>
            <span className="inline-block w-2 h-2 rounded-sm bg-gray-300 mr-1" />
            누락
          </span>
        </div>
      </div>

      {/* OCR raw text (collapsible, outside the card) */}
      <div className="rounded-xl border border-gray-200 overflow-hidden">
        <button
          onClick={() => setShowOcr((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 text-sm font-medium text-gray-600 hover:bg-gray-100"
        >
          <span>OCR 인식 원문</span>
          <span>{showOcr ? '▲' : '▼'}</span>
        </button>
        {showOcr && (
          <div className="px-4 py-3 text-sm text-gray-700 whitespace-pre-wrap bg-white">
            {result.ocrText || '(인식된 텍스트 없음)'}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={onReset}
          className="flex-1 py-3 rounded-xl font-semibold text-gray-600 border border-gray-300
                     hover:bg-gray-50 active:bg-gray-100 transition-colors"
        >
          다시 채점
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

function StatBox({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: 'green' | 'red' | 'yellow' | 'gray';
}) {
  const colorMap = {
    green: 'text-green-600 bg-green-50 border-green-200',
    red: 'text-red-600 bg-red-50 border-red-200',
    yellow: 'text-yellow-600 bg-yellow-50 border-yellow-200',
    gray: 'text-gray-500 bg-gray-50 border-gray-200',
  };
  return (
    <div className={`rounded-xl border py-2 flex flex-col items-center ${colorMap[color]}`}>
      <span className="text-xl font-bold tabular-nums">{value}</span>
      <span className="text-xs">{label}</span>
    </div>
  );
}
