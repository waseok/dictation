'use client';

import { useEffect, useState } from 'react';
import { Slot } from '@/types';
import { loadAllSlots } from '@/lib/slots';

interface SlotSelectorProps {
  onSelect: (slot: Slot) => void;
  onBack: () => void;
}

export default function SlotSelector({ onSelect, onBack }: SlotSelectorProps) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAllSlots().then((data) => {
      setSlots(data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-3">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-400">시험 목록 불러오는 중...</p>
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <div className="text-center py-10 text-gray-400">
          <p className="text-3xl mb-3">📭</p>
          <p className="font-semibold text-gray-600">저장된 시험이 없습니다</p>
          <p className="text-sm mt-1">선생님 페이지에서 정답을 먼저 등록해주세요</p>
        </div>
        <a href="/admin"
          className="w-full py-2.5 rounded-xl text-sm font-semibold text-blue-700
                     border border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors text-center block">
          선생님 페이지로 →
        </a>
        <button onClick={onBack}
          className="w-full py-2.5 rounded-xl text-sm font-semibold text-gray-500
                     border border-gray-200 hover:bg-gray-50 transition-colors">
          ← 뒤로
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="text-lg font-bold text-gray-800">시험 선택</h2>
        <p className="text-sm text-gray-500 mt-0.5">채점할 시험을 선택해주세요</p>
      </div>

      <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
        {slots.map((slot, i) => {
          const nonEmpty = slot.answers.filter((a) => a.trim());
          const preview = nonEmpty
            .slice(0, 3)
            .map((a, j) => `${j + 1}. ${a}`)
            .join('  ');

          return (
            <button
              key={slot.id ?? i}
              onClick={() => onSelect(slot)}
              className="w-full text-left px-4 py-3 bg-white border border-gray-200 rounded-xl
                         hover:border-blue-400 hover:bg-blue-50 transition-colors group"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-gray-800 group-hover:text-blue-700 truncate">
                  {slot.name}
                </span>
                <span className="text-xs text-gray-400 shrink-0">{nonEmpty.length}문제</span>
              </div>
              {preview && (
                <p className="text-xs text-gray-400 mt-0.5 truncate">
                  {preview}{nonEmpty.length > 3 ? ` 외 ${nonEmpty.length - 3}개` : ''}
                </p>
              )}
            </button>
          );
        })}
      </div>

      <button onClick={onBack}
        className="w-full py-2.5 rounded-xl text-sm font-semibold text-gray-500
                   border border-gray-200 hover:bg-gray-50 transition-colors">
        ← 뒤로
      </button>
    </div>
  );
}
