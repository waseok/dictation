'use client';

import { useEffect, useRef, useState } from 'react';
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
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  const [ttsError, setTtsError] = useState<string | null>(null);

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

  function pickKoreanVoice() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) return null;
    const koVoices = voices.filter((v) => v.lang.toLowerCase().startsWith('ko'));
    const preferred = koVoices.find((v) => /female|natural|google|sora/i.test(v.name));
    return preferred ?? koVoices[0] ?? voices[0];
  }

  function handleSpeak(realIdx: number) {
    const text = slot.answers[realIdx]?.trim();
    if (!text) return;

    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setTtsError('이 브라우저는 음성 읽기를 지원하지 않습니다.');
      return;
    }

    setTtsError(null);
    setSpeakingIndex(realIdx);
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const voice = pickKoreanVoice();
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else {
      utterance.lang = 'ko-KR';
    }
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    utterance.onend = () => setSpeakingIndex(null);
    utterance.onerror = () => {
      setSpeakingIndex(null);
      setTtsError('음성 재생에 실패했습니다. 다시 시도해주세요.');
    };

    speechRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    // 일부 브라우저는 첫 호출 전에 voiceschanged 이벤트 이후에만 한국어 음성 목록이 완성됩니다.
    const loadVoices = () => window.speechSynthesis.getVoices();
    loadVoices();
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);

    return () => {
      window.speechSynthesis.cancel();
      window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
    };
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-bold text-gray-800">온라인 시험</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          <span className="font-medium text-blue-700">{studentName}</span>
          <span className="mx-1 text-gray-300">·</span>
          {slot.name}
        </p>
        <p className="text-xs text-gray-400 mt-1">번호 옆 듣기 버튼으로 문항을 듣고 입력하세요 (Enter로 다음 칸)</p>
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
            <button
              type="button"
              onClick={() => handleSpeak(realIdx)}
              disabled={speakingIndex !== null}
              className="px-2 py-1 rounded-lg text-xs font-semibold border border-blue-200 text-blue-700
                         bg-blue-50 hover:bg-blue-100 disabled:bg-gray-100 disabled:text-gray-400
                         disabled:border-gray-200 transition-colors shrink-0"
            >
              {speakingIndex === realIdx ? '재생중...' : '듣기'}
            </button>
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

      {ttsError && (
        <p className="text-xs text-red-500 text-center">{ttsError}</p>
      )}

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
