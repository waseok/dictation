'use client';

import { useState } from 'react';
import AnswerInput from '@/components/AnswerInput';
import ImageCapture from '@/components/ImageCapture';
import GradingResult from '@/components/GradingResult';
import { gradeMultiple } from '@/lib/grading';
import { MultiGradeResult } from '@/types';

type Step = 'input' | 'capture' | 'result';

const QUESTION_COUNT = 10;

export default function Home() {
  const [step, setStep] = useState<Step>('input');
  const [answers, setAnswers] = useState<string[]>(Array(QUESTION_COUNT).fill(''));
  const [gradeResult, setGradeResult] = useState<MultiGradeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleAnswerChange(index: number, value: string) {
    setAnswers((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  async function handleGrade(file: File) {
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('image', file);

      const res = await fetch('/api/ocr', { method: 'POST', body: formData });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? 'OCR 처리 중 오류가 발생했습니다.');
        setLoading(false);
        return;
      }

      const ocrText: string = json.text ?? '';
      const result = gradeMultiple(answers, ocrText);
      setGradeResult(result);
      setStep('result');
    } catch {
      setError('네트워크 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setStep('input');
    setGradeResult(null);
    setError(null);
    setAnswers(Array(QUESTION_COUNT).fill(''));
  }

  const stepLabels = ['정답 입력', '사진 촬영', '채점 결과'];
  const stepIndex = step === 'input' ? 0 : step === 'capture' ? 1 : 2;

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center py-6 px-4">
      <div className="w-full max-w-md flex flex-col gap-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-black text-gray-900">받아쓰기 채점기</h1>
          <p className="text-sm text-gray-500 mt-1">사진 한 장으로 자동 채점</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-1">
          {stepLabels.map((label, i) => (
            <div key={i} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                    ${i < stepIndex ? 'bg-blue-500 text-white' : i === stepIndex ? 'bg-blue-500 text-white ring-2 ring-blue-200' : 'bg-gray-200 text-gray-400'}`}
                >
                  {i < stepIndex ? '✓' : i + 1}
                </div>
                <span className={`text-xs mt-1 ${i === stepIndex ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>
                  {label}
                </span>
              </div>
              {i < stepLabels.length - 1 && (
                <div className={`h-0.5 flex-1 mx-1 mb-4 ${i < stepIndex ? 'bg-blue-400' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
          {step === 'input' && (
            <AnswerInput
              answers={answers}
              onChange={handleAnswerChange}
              onNext={() => setStep('capture')}
            />
          )}

          {step === 'capture' && (
            <>
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                  {error}
                </div>
              )}
              <ImageCapture
                onGrade={handleGrade}
                onBack={() => { setError(null); setStep('input'); }}
                loading={loading}
              />
            </>
          )}

          {step === 'result' && gradeResult && (
            <GradingResult result={gradeResult} onReset={handleReset} />
          )}
        </div>

        <p className="text-center text-xs text-gray-400">
          Powered by Naver CLOVA OCR
        </p>
      </div>
    </main>
  );
}
