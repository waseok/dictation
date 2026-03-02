'use client';

import { useEffect, useState } from 'react';
import { GradingOptions } from '@/types';

const STORAGE_KEY = 'dictation-teacher-data';

interface StoredData {
  answers: string[];
  options: GradingOptions;
}

interface AnswerInputProps {
  answers: string[];
  onChange: (index: number, value: string) => void;
  options: GradingOptions;
  onOptionsChange: (opts: GradingOptions) => void;
  onNext: () => void;
}

export default function AnswerInput({
  answers,
  onChange,
  options,
  onOptionsChange,
  onNext,
}: AnswerInputProps) {
  const [hasSaved, setHasSaved] = useState(false);
  const [saveFlash, setSaveFlash] = useState(false);
  const [hasStored, setHasStored] = useState(false);

  useEffect(() => {
    setHasStored(!!localStorage.getItem(STORAGE_KEY));
  }, []);

  const hasAny = answers.some((a) => a.trim().length > 0);

  function handleSave() {
    const data: StoredData = { answers, options };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    setHasStored(true);
    setHasSaved(true);
    setSaveFlash(true);
    setTimeout(() => setSaveFlash(false), 1500);
  }

  function handleLoad() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data: StoredData = JSON.parse(raw);
    data.answers.forEach((a, i) => onChange(i, a));
    onOptionsChange(data.options);
    setHasSaved(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-bold text-gray-800 mb-1">정답 입력</h2>
        <p className="text-sm text-gray-500">
          선생님이 정답을 입력하고 저장하면, 다음부터 바로 불러올 수 있습니다.
        </p>
      </div>

      {/* Save / Load */}
      <div className="flex gap-2">
        {hasStored && (
          <button
            onClick={handleLoad}
            className="flex-1 py-2 rounded-xl text-sm font-semibold text-blue-600
                       border border-blue-300 bg-blue-50 hover:bg-blue-100 transition-colors"
          >
            저장된 정답 불러오기 ↑
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={!hasAny}
          className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors
            ${saveFlash
              ? 'bg-green-500 text-white border border-green-500'
              : 'text-gray-600 border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed'
            }`}
        >
          {saveFlash ? '저장 완료 ✓' : '정답 저장하기 ↓'}
        </button>
      </div>

      {/* Answer inputs */}
      <div className="flex flex-col gap-2">
        {answers.map((value, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-sm font-bold text-gray-400 w-6 text-right shrink-0">
              {i + 1}.
            </span>
            <input
              type="text"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white
                         placeholder-gray-400"
              placeholder={`${i + 1}번 정답`}
              value={value}
              onChange={(e) => onChange(i, e.target.value)}
            />
          </div>
        ))}
      </div>

      {/* Grading options */}
      <div className="flex flex-col gap-2 border-t border-gray-100 pt-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">채점 설정</p>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={options.ignorePunctuation}
            onChange={(e) =>
              onOptionsChange({ ...options, ignorePunctuation: e.target.checked })
            }
            className="w-4 h-4 rounded accent-blue-500"
          />
          <span className="text-sm text-gray-700">문장부호 채점 제외 (마침표·쉼표·느낌표 등)</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={options.skipHeaderLine}
            onChange={(e) =>
              onOptionsChange({ ...options, skipHeaderLine: e.target.checked })
            }
            className="w-4 h-4 rounded accent-blue-500"
          />
          <span className="text-sm text-gray-700">시험지 첫 줄(이름·학년란) 자동 무시</span>
        </label>
      </div>

      <button
        onClick={onNext}
        disabled={!hasAny}
        className="w-full py-3 rounded-xl font-semibold text-white text-base
                   bg-blue-500 hover:bg-blue-600 active:bg-blue-700
                   disabled:bg-gray-300 disabled:cursor-not-allowed
                   transition-colors"
      >
        다음 →
      </button>
    </div>
  );
}
