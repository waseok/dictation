'use client';

import { useEffect, useState } from 'react';
import { GradingOptions } from '@/types';

const SLOTS_KEY = 'dictation-slots';
const MAX_SLOTS = 10;

interface Slot {
  name: string;
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

function getSlots(): Slot[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SLOTS_KEY);
    return raw ? (JSON.parse(raw) as Slot[]) : [];
  } catch {
    return [];
  }
}

function persistSlots(slots: Slot[]) {
  localStorage.setItem(SLOTS_KEY, JSON.stringify(slots));
}

export default function AnswerInput({
  answers,
  onChange,
  options,
  onOptionsChange,
  onNext,
}: AnswerInputProps) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [showLoad, setShowLoad] = useState(false);
  const [saveFlash, setSaveFlash] = useState(false);

  useEffect(() => {
    setSlots(getSlots());
  }, []);

  const hasAny = answers.some((a) => a.trim().length > 0);

  /* 저장하기 – 바로 저장, 이름은 자동 */
  function handleSave() {
    const existing = getSlots(); // 최신 localStorage 값 재확인
    const name = `저장 ${existing.length + 1}`;
    const slot: Slot = { name, answers: [...answers], options };
    const next = [...existing, slot].slice(0, MAX_SLOTS);
    persistSlots(next);
    setSlots(next);
    setSaveFlash(true);
    setTimeout(() => setSaveFlash(false), 1500);
  }

  function doLoad(i: number) {
    const slot = slots[i];
    slot.answers.forEach((a, idx) => onChange(idx, a));
    onOptionsChange(slot.options);
    setShowLoad(false);
  }

  function doDelete(i: number) {
    const next = slots.filter((_, idx) => idx !== i);
    persistSlots(next);
    setSlots(next);
    if (next.length === 0) setShowLoad(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-bold text-gray-800 mb-1">정답 입력</h2>
        <p className="text-sm text-gray-500">
          정답을 입력하고 저장해두면 다음에 바로 불러올 수 있습니다.
        </p>
      </div>

      {/* Save / Load buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => setShowLoad((v) => !v)}
          disabled={slots.length === 0}
          className="flex-1 py-2 rounded-xl text-sm font-semibold text-blue-700
                     border border-blue-300 bg-blue-50 hover:bg-blue-100 transition-colors
                     disabled:opacity-40 disabled:cursor-not-allowed"
        >
          불러오기 ({slots.length})
        </button>
        <button
          onClick={handleSave}
          disabled={!hasAny || slots.length >= MAX_SLOTS}
          className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors
            ${saveFlash
              ? 'bg-green-500 text-white border border-green-500'
              : 'text-gray-600 border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed'
            }`}
        >
          {saveFlash ? '저장 완료 ✓' : slots.length >= MAX_SLOTS ? `저장 (${MAX_SLOTS}/${MAX_SLOTS})` : '저장하기'}
        </button>
      </div>

      {/* Load panel */}
      {showLoad && slots.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex flex-col gap-1">
          <p className="text-xs font-semibold text-blue-700 mb-1">저장된 정답 ({slots.length}개)</p>
          <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
            {slots.map((slot, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white"
              >
                <span className="text-gray-400 text-xs w-4 shrink-0">{i + 1}.</span>
                <span className="flex-1 text-sm truncate">{slot.name}</span>
                <button
                  onClick={() => doLoad(i)}
                  className="shrink-0 px-2 py-1 text-xs font-semibold text-blue-700
                             border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
                >
                  불러오기
                </button>
                <button
                  onClick={() => doDelete(i)}
                  className="shrink-0 w-6 h-6 flex items-center justify-center
                             text-gray-400 hover:text-red-500 transition-colors text-sm"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Answer inputs – notebook lines style */}
      <div className="flex flex-col notebook-lines rounded-xl overflow-hidden border border-amber-100">
        {answers.map((value, i) => (
          <div
            key={i}
            className="flex items-center gap-2 px-3 border-b border-blue-100 last:border-0"
            style={{ minHeight: '40px' }}
          >
            <span className="text-sm font-bold text-red-400 w-5 text-right shrink-0">
              {i + 1}.
            </span>
            <input
              type="text"
              className="flex-1 py-2 text-sm bg-transparent border-0
                         focus:outline-none placeholder-gray-300 text-gray-800"
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
            className="w-4 h-4 rounded accent-blue-700"
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
            className="w-4 h-4 rounded accent-blue-700"
          />
          <span className="text-sm text-gray-700">시험지 첫 줄(이름·학년란) 자동 무시</span>
        </label>
      </div>

      <button
        onClick={onNext}
        disabled={!hasAny}
        className="w-full py-3 rounded-xl font-semibold text-white text-base
                   bg-blue-700 hover:bg-blue-800 active:bg-blue-900
                   disabled:bg-gray-300 disabled:cursor-not-allowed
                   transition-colors"
      >
        다음 →
      </button>
    </div>
  );
}
