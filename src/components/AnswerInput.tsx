'use client';

interface AnswerInputProps {
  value: string;
  onChange: (value: string) => void;
  onNext: () => void;
}

export default function AnswerInput({ value, onChange, onNext }: AnswerInputProps) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-bold text-gray-800 mb-1">정답 입력</h2>
        <p className="text-sm text-gray-500">받아쓰기 정답 문장을 입력해주세요.</p>
      </div>

      <textarea
        className="w-full h-36 p-3 border border-gray-300 rounded-xl text-base resize-none
                   focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white
                   placeholder-gray-400 leading-relaxed"
        placeholder="예: 나는 학교에 갑니다. 오늘은 날씨가 맑습니다."
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />

      <button
        onClick={onNext}
        disabled={!value.trim()}
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
