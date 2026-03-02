'use client';

import { useRef, useState } from 'react';
import { MultiGradeResult, QuestionResult } from '@/types';
import DiffView from './DiffView';

interface GradingResultProps {
  result: MultiGradeResult;
  onReset: () => void;
  onNewStudent: () => void;
}

function ScoreFraction({ correct, total }: { correct: number; total: number }) {
  const ratio = total > 0 ? correct / total : 0;
  const color =
    ratio >= 0.8 ? 'text-green-600' : ratio >= 0.5 ? 'text-yellow-500' : 'text-red-500';
  return (
    <div className="flex flex-col items-center py-2">
      <div className={`tabular-nums font-black leading-none ${color}`}>
        <span className="text-6xl">{correct}</span>
        <span className="text-3xl text-gray-400 font-bold"> / {total}</span>
      </div>
      <div className="text-sm text-gray-500 mt-2 font-medium">문제 정답</div>
    </div>
  );
}

function QuestionRow({ q }: { q: QuestionResult }) {
  const [open, setOpen] = useState(false);
  const { result } = q;

  const isCorrect = result.score === 100;
  const isPartial = result.score > 0 && result.score < 100;
  const icon = isCorrect ? '✓' : isPartial ? '△' : '✗';
  const iconColor = isCorrect
    ? 'text-green-600 bg-green-50 border-green-200'
    : isPartial
    ? 'text-yellow-600 bg-yellow-50 border-yellow-200'
    : 'text-red-600 bg-red-50 border-red-200';

  const hasError =
    result.spellingErrorCount > 0 || result.spacingErrorCount > 0 || result.missingCount > 0;

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <span className="text-sm font-bold text-gray-400 w-5 shrink-0">{q.questionNumber}.</span>
        <span className="flex-1 text-sm text-gray-700 truncate">{q.correctAnswer}</span>
        {hasError && (
          <span className="text-xs text-gray-400 shrink-0">
            {result.spellingErrorCount > 0 && `맞춤법 ${result.spellingErrorCount} `}
            {result.spacingErrorCount > 0 && `띄어쓰기 ${result.spacingErrorCount} `}
            {result.missingCount > 0 && `누락 ${result.missingCount}`}
          </span>
        )}
        <span
          className={`w-7 h-7 rounded-full border flex items-center justify-center text-sm font-bold shrink-0 ${iconColor}`}
        >
          {icon}
        </span>
        <span className="text-gray-400 text-xs shrink-0">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-4 py-3 bg-white flex flex-col gap-3">
          <DiffView tokens={result.tokens} />
          {result.ocrText && (
            <p className="text-xs text-gray-400">
              OCR: <span className="font-mono">{result.ocrText}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function GradingResult({ result, onReset, onNewStudent }: GradingResultProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const correctCount = result.questions.filter((q) => q.result.score === 100).length;
  const totalCount = result.questions.length;
  const totalWords = result.questions.reduce((s, q) => s + q.result.totalCount, 0);
  const totalSpelling = result.questions.reduce((s, q) => s + q.result.spellingErrorCount, 0);
  const totalSpacing = result.questions.reduce((s, q) => s + q.result.spacingErrorCount, 0);
  const totalMissing = result.questions.reduce((s, q) => s + q.result.missingCount, 0);

  const today = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  async function handleDownload() {
    if (!cardRef.current) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
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
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error('Download failed:', err);
      setDownloadError('저장에 실패했습니다. 브라우저의 스크린샷 기능을 사용해주세요.');
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
          <h2 className="text-lg font-bold text-gray-800">✏️ 채점 결과</h2>
          <span className="text-xs text-gray-400">{today}</span>
        </div>

        {/* Overall score as fraction */}
        <div className="flex items-center justify-center">
          <ScoreFraction correct={correctCount} total={totalCount} />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 text-center">
          <StatBox label="정답" value={totalCount - totalSpelling - totalSpacing - totalMissing > 0 ? result.questions.reduce((s, q) => s + q.result.correctCount, 0) : 0} color="green" />
          <StatBox label="맞춤법" value={totalSpelling} color="red" />
          <StatBox label="띄어쓰기" value={totalSpacing} color="yellow" />
          <StatBox label="누락" value={totalMissing} color="gray" />
        </div>

        <p className="text-xs text-gray-400 text-center">
          {totalCount}문제 · 총 {totalWords}단어
        </p>
      </div>

      {/* Per-question breakdown */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">문제별 결과</p>
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

      {/* Download error */}
      {downloadError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {downloadError}
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
                     bg-blue-700 hover:bg-blue-800 active:bg-blue-900 transition-colors"
        >
          다음 학생 →
        </button>
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="flex-[2] py-3 rounded-xl font-semibold text-white
                     bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800
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
