'use client';

import { useState } from 'react';
import AnswerInput from '@/components/AnswerInput';

const ADMIN_PASSWORD = '8714';

export default function AdminPage() {
  const [input, setInput] = useState('');
  const [authed, setAuthed] = useState(false);
  const [error, setError] = useState(false);

  function handleLogin() {
    if (input === ADMIN_PASSWORD) {
      setAuthed(true);
    } else {
      setError(true);
      setInput('');
      setTimeout(() => setError(false), 1500);
    }
  }

  if (!authed) {
    return (
      <main className="min-h-screen bg-amber-50 flex flex-col items-center justify-center py-6 px-4">
        <div className="w-full max-w-xs flex flex-col gap-4">
          <div className="text-center">
            <div className="text-3xl mb-1">✏️</div>
            <h1 className="text-xl font-black text-gray-900">선생님 페이지</h1>
            <p className="text-sm text-gray-500 mt-1">비밀번호를 입력해주세요</p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-amber-200 p-5 flex flex-col gap-3">
            <input
              type="password"
              className={`w-full px-4 py-3 rounded-xl border text-center text-2xl font-bold tracking-widest focus:outline-none transition-colors
                ${error ? 'border-red-300 bg-red-50 text-red-600 animate-shake' : 'border-gray-200 focus:border-blue-400'}`}
              placeholder="••••"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleLogin(); }}
              autoFocus
              maxLength={8}
            />
            {error && (
              <p className="text-center text-sm text-red-500 font-medium">비밀번호가 틀렸습니다</p>
            )}
            <button
              onClick={handleLogin}
              className="w-full py-3 rounded-xl font-semibold text-white bg-blue-700 hover:bg-blue-800 transition-colors"
            >
              확인
            </button>
          </div>

          <a href="/"
            className="text-center text-sm text-gray-400 hover:text-gray-600 transition-colors">
            ← 학생 페이지로
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-amber-50 flex flex-col items-center py-6 px-4">
      <div className="w-full max-w-md flex flex-col gap-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-gray-900">✏️ 선생님 페이지</h1>
            <p className="text-sm text-gray-500 mt-0.5">정답을 등록하고 관리하세요</p>
          </div>
          <a href="/"
            className="text-sm text-gray-500 hover:text-gray-800 px-3 py-1.5
                       border border-gray-200 rounded-lg bg-white hover:bg-gray-50 transition-colors">
            학생 페이지 →
          </a>
        </div>

        {/* 정답 관리 카드 */}
        <div className="bg-white rounded-2xl shadow-sm border border-amber-200 p-5">
          <AnswerInput adminMode />
        </div>

        <p className="text-center text-xs text-gray-400">Powered by Google Gemini</p>
      </div>
    </main>
  );
}
