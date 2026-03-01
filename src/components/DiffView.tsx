'use client';

import { GradeToken } from '@/types';

interface DiffViewProps {
  tokens: GradeToken[];
}

const statusStyle: Record<GradeToken['status'], string> = {
  correct: 'bg-green-100 text-green-800 border-green-300',
  'spelling-error': 'bg-red-100 text-red-800 border-red-300',
  'spacing-error': 'bg-yellow-100 text-yellow-800 border-yellow-300',
  missing: 'bg-gray-100 text-gray-400 border-gray-300 line-through',
};

const statusLabel: Record<GradeToken['status'], string> = {
  correct: '✓',
  'spelling-error': '✗',
  'spacing-error': '~',
  missing: '?',
};

export default function DiffView({ tokens }: DiffViewProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {tokens.map((token, i) => (
        <div key={i} className="flex flex-col items-center gap-0.5">
          <span
            className={`px-2 py-1 rounded-lg border text-sm font-medium whitespace-nowrap ${statusStyle[token.status]}`}
          >
            {token.status === 'missing' ? token.correct : token.student || token.correct}
          </span>
          {token.status !== 'correct' && token.status !== 'missing' && (
            <span className="text-xs text-gray-400 line-through whitespace-nowrap">
              {token.correct}
            </span>
          )}
          <span
            className={`text-xs font-bold ${
              token.status === 'correct'
                ? 'text-green-500'
                : token.status === 'spacing-error'
                ? 'text-yellow-500'
                : token.status === 'missing'
                ? 'text-gray-400'
                : 'text-red-500'
            }`}
          >
            {statusLabel[token.status]}
          </span>
        </div>
      ))}
    </div>
  );
}
