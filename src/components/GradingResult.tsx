'use client';

import { useRef, useState } from 'react';
import { GradeToken, MultiGradeResult, QuestionResult } from '@/types';
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

function StatBox({
  label, value, color,
}: {
  label: string; value: number; color: 'green' | 'red' | 'yellow' | 'gray';
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
        <span className={`w-7 h-7 rounded-full border flex items-center justify-center text-sm font-bold shrink-0 ${iconColor}`}>
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

// ─── 내보내기 전용 카드 (항상 모든 문제 펼침) ─────────────────────────────────
function ExportQuestionRow({ q }: { q: QuestionResult }) {
  const { result } = q;
  const isCorrect = result.score === 100;
  const isPartial = result.score > 0 && result.score < 100;
  const icon = isCorrect ? '✓' : isPartial ? '△' : '✗';
  const iconBg = isCorrect ? '#dcfce7' : isPartial ? '#fef9c3' : '#fee2e2';
  const iconColor = isCorrect ? '#16a34a' : isPartial ? '#ca8a04' : '#dc2626';

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', marginBottom: 8 }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#f9fafb' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#9ca3af', width: 18, textAlign: 'right', flexShrink: 0 }}>
          {q.questionNumber}.
        </span>
        <span style={{ flex: 1, fontSize: 13, color: '#374151' }}>{q.correctAnswer}</span>
        {(result.spellingErrorCount > 0 || result.spacingErrorCount > 0 || result.missingCount > 0) && (
          <span style={{ fontSize: 11, color: '#9ca3af', flexShrink: 0 }}>
            {result.spellingErrorCount > 0 && `맞춤법 ${result.spellingErrorCount} `}
            {result.spacingErrorCount > 0 && `띄어쓰기 ${result.spacingErrorCount} `}
            {result.missingCount > 0 && `누락 ${result.missingCount}`}
          </span>
        )}
        <span style={{
          width: 26, height: 26, borderRadius: '50%', border: `1px solid ${iconColor}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 700, color: iconColor, background: iconBg, flexShrink: 0,
        }}>{icon}</span>
      </div>
      {/* 토큰 diff */}
      <div style={{ padding: '10px 14px', background: '#fff' }}>
        <ExportDiffView tokens={result.tokens} />
        {result.ocrText && (
          <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 8 }}>
            OCR: <span style={{ fontFamily: 'monospace' }}>{result.ocrText}</span>
          </p>
        )}
      </div>
    </div>
  );
}

function ExportDiffView({ tokens }: { tokens: GradeToken[] }) {
  const styleMap: Record<GradeToken['status'], React.CSSProperties> = {
    correct: { background: '#dcfce7', color: '#166534', border: '1px solid #86efac' },
    'spelling-error': { background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' },
    'spacing-error': { background: '#fef9c3', color: '#854d0e', border: '1px solid #fde047' },
    missing: { background: '#f3f4f6', color: '#9ca3af', border: '1px solid #d1d5db', textDecoration: 'line-through' },
  };
  const labelMap: Record<GradeToken['status'], string> = {
    correct: '✓', 'spelling-error': '✗', 'spacing-error': '~', missing: '?',
  };
  const labelColor: Record<GradeToken['status'], string> = {
    correct: '#22c55e', 'spelling-error': '#ef4444', 'spacing-error': '#eab308', missing: '#9ca3af',
  };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {tokens.map((token, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <span style={{ padding: '4px 8px', borderRadius: 8, fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', ...styleMap[token.status] }}>
            {token.status === 'missing' ? token.correct : token.student || token.correct}
          </span>
          {token.status !== 'correct' && token.status !== 'missing' && (
            <span style={{ fontSize: 11, color: '#9ca3af', textDecoration: 'line-through' }}>{token.correct}</span>
          )}
          <span style={{ fontSize: 11, fontWeight: 700, color: labelColor[token.status] }}>
            {labelMap[token.status]}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── 메인 컴포넌트 ─────────────────────────────────────────────────────────────
export default function GradingResult({ result, onReset, onNewStudent }: GradingResultProps) {
  const cardRef = useRef<HTMLDivElement>(null);       // 화면용 요약 카드
  const exportRef = useRef<HTMLDivElement>(null);    // 내보내기 전용 전체 카드
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const correctCount = result.questions.filter((q) => q.result.score === 100).length;
  const totalCount = result.questions.length;
  const totalWords = result.questions.reduce((s, q) => s + q.result.totalCount, 0);
  const totalSpelling = result.questions.reduce((s, q) => s + q.result.spellingErrorCount, 0);
  const totalSpacing = result.questions.reduce((s, q) => s + q.result.spacingErrorCount, 0);
  const totalMissing = result.questions.reduce((s, q) => s + q.result.missingCount, 0);
  const totalCorrectWords = result.questions.reduce((s, q) => s + q.result.correctCount, 0);

  const today = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  async function handleDownload() {
    if (!exportRef.current) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(exportRef.current, {
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
      {/* ── 화면용 요약 카드 ── */}
      <div ref={cardRef}
        className="bg-white rounded-2xl border border-gray-200 p-5 flex flex-col gap-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-800">✏️ 채점 결과</h2>
          <span className="text-xs text-gray-400">{today}</span>
        </div>
        <div className="flex items-center justify-center">
          <ScoreFraction correct={correctCount} total={totalCount} />
        </div>
        <div className="grid grid-cols-4 gap-2 text-center">
          <StatBox label="정답" value={totalCorrectWords} color="green" />
          <StatBox label="맞춤법" value={totalSpelling} color="red" />
          <StatBox label="띄어쓰기" value={totalSpacing} color="yellow" />
          <StatBox label="누락" value={totalMissing} color="gray" />
        </div>
        <p className="text-xs text-gray-400 text-center">
          {totalCount}문제 · 총 {totalWords}단어
        </p>
      </div>

      {/* ── 문제별 결과 (아코디언) ── */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">문제별 결과</p>
        {result.questions.map((q) => (
          <QuestionRow key={q.questionNumber} q={q} />
        ))}
      </div>

      {/* ── 범례 ── */}
      <div className="flex flex-wrap gap-3 text-xs text-gray-500 px-1">
        <span><span className="inline-block w-2 h-2 rounded-sm bg-green-400 mr-1" />정답</span>
        <span><span className="inline-block w-2 h-2 rounded-sm bg-red-400 mr-1" />맞춤법 오류</span>
        <span><span className="inline-block w-2 h-2 rounded-sm bg-yellow-400 mr-1" />띄어쓰기 오류</span>
        <span><span className="inline-block w-2 h-2 rounded-sm bg-gray-300 mr-1" />누락</span>
      </div>

      {downloadError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {downloadError}
        </div>
      )}

      {/* ── 버튼 ── */}
      <div className="flex gap-2">
        <button onClick={onReset}
          className="flex-1 py-3 rounded-xl font-semibold text-gray-600 border border-gray-300
                     hover:bg-gray-50 active:bg-gray-100 transition-colors">
          다시 촬영
        </button>
        <button onClick={onNewStudent}
          className="flex-1 py-3 rounded-xl font-semibold text-white
                     bg-blue-700 hover:bg-blue-800 active:bg-blue-900 transition-colors">
          다음 학생 →
        </button>
        <button onClick={handleDownload} disabled={downloading}
          className="flex-[2] py-3 rounded-xl font-semibold text-white
                     bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800
                     disabled:opacity-60 disabled:cursor-not-allowed
                     transition-colors flex items-center justify-center gap-2">
          {downloading ? (
            <>
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              저장 중...
            </>
          ) : '결과 저장 ↓'}
        </button>
      </div>

      {/* ── 내보내기 전용 전체 카드 (화면 밖) ── */}
      <div style={{ position: 'fixed', left: '-9999px', top: 0, width: 420, pointerEvents: 'none' }}>
        <div ref={exportRef}
          style={{ background: '#fff', padding: 24, fontFamily: 'sans-serif', width: 420 }}>
          {/* 헤더 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={{ fontSize: 18, fontWeight: 900, color: '#111827' }}>✏️ 채점 결과</span>
            <span style={{ fontSize: 12, color: '#9ca3af' }}>{today}</span>
          </div>

          {/* 점수 */}
          <div style={{ textAlign: 'center', padding: '12px 0 16px' }}>
            {(() => {
              const ratio = totalCount > 0 ? correctCount / totalCount : 0;
              const color = ratio >= 0.8 ? '#16a34a' : ratio >= 0.5 ? '#ca8a04' : '#dc2626';
              return (
                <>
                  <span style={{ fontSize: 64, fontWeight: 900, color, lineHeight: 1 }}>{correctCount}</span>
                  <span style={{ fontSize: 28, fontWeight: 700, color: '#9ca3af' }}> / {totalCount}</span>
                  <div style={{ fontSize: 14, color: '#6b7280', marginTop: 8 }}>문제 정답</div>
                </>
              );
            })()}
          </div>

          {/* 통계 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
            {[
              { label: '정답', value: totalCorrectWords, bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
              { label: '맞춤법', value: totalSpelling, bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
              { label: '띄어쓰기', value: totalSpacing, bg: '#fefce8', color: '#ca8a04', border: '#fde047' },
              { label: '누락', value: totalMissing, bg: '#f9fafb', color: '#6b7280', border: '#e5e7eb' },
            ].map(({ label, value, bg, color, border }) => (
              <div key={label} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 12, padding: '8px 4px', textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
                <div style={{ fontSize: 11, color }}>{label}</div>
              </div>
            ))}
          </div>

          <p style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', marginBottom: 16 }}>
            {totalCount}문제 · 총 {totalWords}단어
          </p>

          {/* 문제별 전체 펼침 */}
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
            문제별 결과
          </div>
          {result.questions.map((q) => (
            <ExportQuestionRow key={q.questionNumber} q={q} />
          ))}
        </div>
      </div>
    </div>
  );
}
