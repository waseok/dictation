'use client';

interface AnswerInputProps {
  answers: string[];
  onChange: (index: number, value: string) => void;
  onNext: () => void;
}

export default function AnswerInput({ answers, onChange, onNext }: AnswerInputProps) {
  const hasAny = answers.some((a) => a.trim().length > 0);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-bold text-gray-800 mb-1">정답 입력</h2>
        <p className="text-sm text-gray-500">문제별 정답을 입력해주세요. 비워두면 해당 문제는 채점에서 제외됩니다.</p>
      </div>

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
