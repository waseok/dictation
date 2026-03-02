'use client';

import { useState } from 'react';
import AnswerInput from '@/components/AnswerInput';
import ImageCapture from '@/components/ImageCapture';
import GradingResult from '@/components/GradingResult';
import { gradeMultiple } from '@/lib/grading';
import { GradingOptions, LoadingPhase, MultiGradeResult } from '@/types';

type Step = 'input' | 'capture' | 'result';

const QUESTION_COUNT = 10;

const DEFAULT_OPTIONS: GradingOptions = {
  ignorePunctuation: false,
  skipHeaderLine: true,
};

export default function Home() {
  const [step, setStep] = useState<Step>('input');
  const [answers, setAnswers] = useState<string[]>(Array(QUESTION_COUNT).fill(''));
  const [options, setOptions] = useState<GradingOptions>(DEFAULT_OPTIONS);
  const [gradeResult, setGradeResult] = useState<MultiGradeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState<LoadingPhase>('idle');
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
    setLoadingPhase('ocr');
    setError(null);

    try {
      const formData = new FormData();
      formData.append('image', file);

      const res = await fetch('/api/ocr', { method: 'POST', body: formData });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? 'OCR 처리 중 오류가 발생했습니다.');
        return;
      }

      setLoadingPhase('grading');
      const ocrText: string = json.text ?? '';
      const result = gradeMultiple(answers, ocrText, options);
      setGradeResult(result);
      setStep('result');
    } catch {
      setError('네트워크 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
      setLoadingPhase('idle');
    }
  }

  function handleReset() {
    setStep('capture');
    setGradeResult(null);
    setError(null);
  }

  function handleNewStudent() {
    setStep('capture');
    setGradeResult(null);
    setError(null);
  }

  const stepLabels = ['정답 입력', '사진 촬영', '채점 결과'];
  const stepIndex = step === 'input' ? 0 : step === 'capture' ? 1 : 2;

  return (
    <main className="min-h-screen bg-amber-50 flex flex-col items-center py-6 px-4">
      <div className="w-full max-w-md flex flex-col gap-6">
        {/* Header */}
        <div className="text-center">
          <div className="text-3xl mb-1">✏️</div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">받아쓰기 채점기</h1>
          <p className="text-sm text-gray-500 mt-1">사진 한 장으로 자동 채점</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-1">
          {stepLabels.map((label, i) => (
            <div key={i} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                    ${i < stepIndex
                      ? 'bg-blue-700 text-white'
                      : i === stepIndex
                      ? 'bg-blue-700 text-white ring-2 ring-blue-200'
                      : 'bg-gray-200 text-gray-400'
                    }`}
                >
                  {i < stepIndex ? '✓' : i + 1}
                </div>
                <span
                  className={`text-xs mt-1 ${
                    i === stepIndex ? 'text-blue-700 font-semibold' : 'text-gray-400'
                  }`}
                >
                  {label}
                </span>
              </div>
              {i < stepLabels.length - 1 && (
                <div
                  className={`h-0.5 flex-1 mx-1 mb-4 ${
                    i < stepIndex ? 'bg-blue-400' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Content card */}
        <div className="bg-white rounded-2xl shadow-sm border border-amber-200 p-5">
          {step === 'input' && (
            <AnswerInput
              answers={answers}
              onChange={handleAnswerChange}
              options={options}
              onOptionsChange={setOptions}
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
                loadingPhase={loadingPhase}
              />
            </>
          )}

          {step === 'result' && gradeResult && (
            <GradingResult
              result={gradeResult}
              onReset={handleReset}
              onNewStudent={handleNewStudent}
            />
          )}
        </div>

        <p className="text-center text-xs text-gray-400">
          Powered by Google Gemini
        </p>
      </div>
    </main>
  );
}
