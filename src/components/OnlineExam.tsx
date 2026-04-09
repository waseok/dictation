'use client';

import { useRef, useState } from 'react';
import { Slot } from '@/types';

interface OnlineExamProps {
  slot: Slot;
  studentName: string;
  onGrade: (answers: string[]) => void;
  onBack: () => void;
}

export default function OnlineExam({ slot, studentName, onGrade, onBack }: OnlineExamProps) {
  const [answers, setAnswers] = useState<string[]>(Array(10).fill(''));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Only show rows where the correct answer exists
  const activeIndices = slot.answers
    .map((a, i) => (a.trim() ? i : -1))
    .filter((i) => i >= 0);

  const filledCount = activeIndices.filter((i) => answers[i]?.trim()).length;

  function handleChange(i: number, value: string) {
    setAnswers((prev) => {
      const next = [...prev];
      next[i] = value;
      return next;
    });
  }

  function handleKeyDown(e: React.KeyboardEvent, activePos: number) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const nextRealIdx = activeIndices[activePos + 1];
      if (nextRealIdx !== undefined) {
        inputRefs.current[nextRealIdx]?.focus();
      }
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-bold text-gray-800">온라인 시험</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          <span className="font-medium text-blue-700">{studentName}</span>
          <span className="mx-1 text-gray-300">·</span>
          {slot.name}
        </p>
        <p className="text-xs text-gray-400 mt-1">선생님이 불러주는 순서대로 입력하세요 (Enter로 다음 칸)</p>
      </div>

      <div className="flex flex-col notebook-lines rounded-xl overflow-hidden border border-amber-100">
        {activeIndices.map((realIdx, activePos) => (
          <div
            key={realIdx}
            className="flex items-center gap-2 px-3 border-b border-blue-100 last:border-0"
            style={{ minHeight: '40px' }}
          >
            <span className="text-sm font-bold text-red-400 w-5 text-right shrink-0">
              {realIdx + 1}.
            </span>
            <input
              ref={(el) => { inputRefs.current[realIdx] = el; }}
              type="text"
              className="flex-1 py-2 text-sm bg-transparent border-0 focus:outline-none placeholder-gray-300 text-gray-800"
              placeholder={`${realIdx + 1}번 답 입력`}
              value={answers[realIdx]}
              onChange={(e) => handleChange(realIdx, e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, activePos)}
              autoFocus={activePos === 0}
            />
          </div>
        ))}
      </div>

      <div className="text-xs text-center text-gray-400">
        {filledCount} / {activeIndices.length} 문제 입력됨
      </div>

      <div className="flex gap-2">
        <button
          onClick={onBack}
          className="flex-1 py-3 rounded-xl font-semibold text-gray-600
                     border border-gray-300 hover:bg-gray-50 transition-colors"
        >
          ← 뒤로
        </button>
        <button
          onClick={() => onGrade(answers)}
          disabled={filledCount === 0}
          className="flex-[2] py-3 rounded-xl font-semibold text-white
                     bg-blue-700 hover:bg-blue-800 active:bg-blue-900
                     disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          채점하기 →
        </button>
      </div>
    </div>
  );
}
