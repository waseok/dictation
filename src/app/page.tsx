'use client';

import { useState } from 'react';
import ImageCapture from '@/components/ImageCapture';
import GradingResult from '@/components/GradingResult';
import SlotSelector from '@/components/SlotSelector';
import OnlineExam from '@/components/OnlineExam';
import { gradeMultiple, gradeMultipleDirect } from '@/lib/grading';
import { ExamType, LoadingPhase, MultiGradeResult, Slot, StudentStep } from '@/types';

export default function Home() {
  const [step, setStep] = useState<StudentStep>('name');
  const [studentName, setStudentName] = useState('');
  const [examType, setExamType] = useState<ExamType>('paper');
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  const [gradeResult, setGradeResult] = useState<MultiGradeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState<LoadingPhase>('idle');
  const [error, setError] = useState<string | null>(null);

  // ── 종이 시험: OCR → 채점 ──────────────────────────────────────────────────
  async function handlePaperGrade(file: File) {
    if (!selectedSlot) return;
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
      const result = gradeMultiple(selectedSlot.answers, json.text ?? '', selectedSlot.options);
      setGradeResult(result);
      setStep('result');
    } catch {
      setError('네트워크 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
      setLoadingPhase('idle');
    }
  }

  // ── 온라인 시험: 직접 입력 → 채점 ─────────────────────────────────────────
  function handleOnlineGrade(studentAnswers: string[]) {
    if (!selectedSlot) return;
    const result = gradeMultipleDirect(selectedSlot.answers, studentAnswers, selectedSlot.options);
    setGradeResult(result);
    setStep('result');
  }

  function handleReset() {
    setStep(examType === 'online' ? 'online' : 'paper');
    setGradeResult(null);
    setError(null);
  }

  function handleNewStudent() {
    setStep('name');
    setStudentName('');
    setGradeResult(null);
    setError(null);
  }

  // ── 스텝 인디케이터 ────────────────────────────────────────────────────────
  const stepIndexMap: Record<StudentStep, number> = {
    name: 0, type: 1, slot: 1, paper: 2, online: 2, result: 3,
  };
  const stepIndex = stepIndexMap[step];
  const stepLabels = ['이름 입력', '시험 선택', examType === 'online' ? '답 입력' : '사진 촬영', '채점 결과'];

  return (
    <main className="min-h-screen bg-amber-50 flex flex-col items-center py-6 px-4">
      <div className="w-full max-w-md flex flex-col gap-6">

        {/* Header */}
        <div className="text-center">
          <div className="text-3xl mb-1">✏️</div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">받아쓰기 채점기</h1>
          <p className="text-sm text-gray-500 mt-1">
            {studentName
              ? <span className="text-blue-600 font-medium">{studentName}</span>
              : '사진 한 장으로 자동 채점'
            }
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-1">
          {stepLabels.map((label, i) => (
            <div key={i} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                  ${i < stepIndex ? 'bg-blue-700 text-white'
                    : i === stepIndex ? 'bg-blue-700 text-white ring-2 ring-blue-200'
                    : 'bg-gray-200 text-gray-400'}`}>
                  {i < stepIndex ? '✓' : i + 1}
                </div>
                <span className={`text-xs mt-1 ${i === stepIndex ? 'text-blue-700 font-semibold' : 'text-gray-400'}`}>
                  {label}
                </span>
              </div>
              {i < stepLabels.length - 1 && (
                <div className={`h-0.5 flex-1 mx-1 mb-4 ${i < stepIndex ? 'bg-blue-400' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Content card */}
        <div className="bg-white rounded-2xl shadow-sm border border-amber-200 p-5">

          {/* Step 1: 이름 입력 */}
          {step === 'name' && (
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="text-lg font-bold text-gray-800">이름을 입력해주세요</h2>
                <p className="text-sm text-gray-500 mt-0.5">채점 결과에 표시됩니다</p>
              </div>
              <input
                type="text"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-400 focus:outline-none text-lg font-medium"
                placeholder="홍길동"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && studentName.trim()) setStep('type'); }}
                autoFocus
              />
              <button
                onClick={() => setStep('type')}
                disabled={!studentName.trim()}
                className="w-full py-3 rounded-xl font-semibold text-white text-base
                           bg-blue-700 hover:bg-blue-800 active:bg-blue-900
                           disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                다음 →
              </button>
            </div>
          )}

          {/* Step 2: 시험 방식 선택 */}
          {step === 'type' && (
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="text-lg font-bold text-gray-800">시험 방식 선택</h2>
                <p className="text-sm text-gray-500 mt-0.5">어떤 방식으로 시험을 볼까요?</p>
              </div>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => { setExamType('paper'); setStep('slot'); }}
                  className="w-full text-left px-5 py-4 bg-white border-2 border-gray-200 rounded-xl
                             hover:border-blue-400 hover:bg-blue-50 transition-colors group"
                >
                  <div className="text-2xl mb-1">📄</div>
                  <div className="font-bold text-gray-800 group-hover:text-blue-700">종이 시험</div>
                  <div className="text-sm text-gray-500 mt-0.5">시험지를 촬영하면 자동으로 채점</div>
                </button>
                <button
                  onClick={() => { setExamType('online'); setStep('slot'); }}
                  className="w-full text-left px-5 py-4 bg-white border-2 border-gray-200 rounded-xl
                             hover:border-blue-400 hover:bg-blue-50 transition-colors group"
                >
                  <div className="text-2xl mb-1">⌨️</div>
                  <div className="font-bold text-gray-800 group-hover:text-blue-700">온라인 시험</div>
                  <div className="text-sm text-gray-500 mt-0.5">선생님이 불러주는 답을 직접 입력</div>
                </button>
              </div>
              <button onClick={() => setStep('name')}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-gray-500
                           border border-gray-200 hover:bg-gray-50 transition-colors">
                ← 뒤로
              </button>
            </div>
          )}

          {/* Step 3: 시험 선택 */}
          {step === 'slot' && (
            <SlotSelector
              onSelect={(slot) => {
                setSelectedSlot(slot);
                setStep(examType === 'online' ? 'online' : 'paper');
              }}
              onBack={() => setStep('type')}
            />
          )}

          {/* Step 4a: 종이 시험 – 촬영 */}
          {step === 'paper' && (
            <>
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                  {error}
                </div>
              )}
              {selectedSlot && (
                <p className="mb-3 text-sm text-gray-500">
                  <span className="font-medium text-blue-700">{studentName}</span>
                  <span className="mx-1 text-gray-300">·</span>
                  {selectedSlot.name}
                </p>
              )}
              <ImageCapture
                onGrade={handlePaperGrade}
                onBack={() => { setError(null); setStep('slot'); }}
                loading={loading}
                loadingPhase={loadingPhase}
              />
            </>
          )}

          {/* Step 4b: 온라인 시험 – 직접 입력 */}
          {step === 'online' && selectedSlot && (
            <OnlineExam
              slot={selectedSlot}
              studentName={studentName}
              onGrade={handleOnlineGrade}
              onBack={() => setStep('slot')}
            />
          )}

          {/* Step 5: 채점 결과 */}
          {step === 'result' && gradeResult && (
            <GradingResult
              result={gradeResult}
              studentName={studentName}
              examType={examType}
              onReset={handleReset}
              onNewStudent={handleNewStudent}
            />
          )}
        </div>

        <div className="flex items-center justify-center gap-3 text-xs text-gray-400">
          <span>Powered by Google Gemini</span>
          <span>·</span>
          <a href="/admin" className="hover:text-gray-600 underline underline-offset-2">선생님 페이지</a>
        </div>
      </div>
    </main>
  );
}
