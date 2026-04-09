'use client';

import { useEffect, useRef, useState } from 'react';
import { GradingOptions, Slot } from '@/types';
import { supabase } from '@/lib/supabase';
import {
  MAX_SLOTS,
  QUESTION_COUNT,
  lsGetSlots,
  lsPersistSlots,
  sbLoadSlots,
  sbSaveSlot,
  sbDeleteSlot,
} from '@/lib/slots';

const DEFAULT_OPTIONS: GradingOptions = { ignorePunctuation: false, skipHeaderLine: true };

interface AnswerInputProps {
  /** Controlled mode (student flow) */
  answers?: string[];
  onChange?: (index: number, value: string) => void;
  options?: GradingOptions;
  onOptionsChange?: (opts: GradingOptions) => void;
  /** If provided, shows "다음 →" button */
  onNext?: () => void;
  /** Admin mode: manages own state, hides next button */
  adminMode?: boolean;
}

// ─── CSV ──────────────────────────────────────────────────────────────────────
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current); current = '';
    } else { current += ch; }
  }
  result.push(current);
  return result;
}
function csvCell(v: string) { return `"${v.replace(/"/g, '""')}"`; }

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────
export default function AnswerInput({
  answers: extAnswers,
  onChange: extOnChange,
  options: extOptions,
  onOptionsChange: extOnOptionsChange,
  onNext,
  adminMode = false,
}: AnswerInputProps) {
  // Internal state for admin mode
  const [intAnswers, setIntAnswers] = useState<string[]>(Array(QUESTION_COUNT).fill(''));
  const [intOptions, setIntOptions] = useState<GradingOptions>(DEFAULT_OPTIONS);

  const answers = extAnswers ?? intAnswers;
  const options = extOptions ?? intOptions;

  function handleAnswerChange(index: number, value: string) {
    if (extOnChange) extOnChange(index, value);
    else setIntAnswers((prev) => { const next = [...prev]; next[index] = value; return next; });
  }
  function handleOptionsChange(opts: GradingOptions) {
    if (extOnOptionsChange) extOnOptionsChange(opts);
    else setIntOptions(opts);
  }

  // ─── Slots state ───────────────────────────────────────────────────────────
  const [slots, setSlots] = useState<Slot[]>([]);
  const [showLoad, setShowLoad] = useState(false);
  const [expandedSlot, setExpandedSlot] = useState<number | null>(null);
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveGroup, setSaveGroup] = useState('');
  const [saveFlash, setSaveFlash] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const saveInputRef = useRef<HTMLInputElement>(null);

  // 기존 그룹 목록 (자동완성용)
  const existingGroups = Array.from(new Set(slots.map((s) => s.group ?? '').filter(Boolean)));

  useEffect(() => {
    async function load() {
      if (supabase) {
        setSlotsLoading(true);
        const data = await sbLoadSlots();
        setSlotsLoading(false);
        if (data.length > 0) { setSlots(data); return; }
      }
      setSlots(lsGetSlots());
    }
    load();
  }, []);

  useEffect(() => {
    if (showSaveInput) setTimeout(() => saveInputRef.current?.focus(), 50);
  }, [showSaveInput]);

  const hasAny = answers.some((a) => a.trim().length > 0);

  async function confirmSave() {
    const name = saveName.trim() || `저장 ${slots.length + 1}`;
    const newSlot: Omit<Slot, 'id'> = { name, group: saveGroup.trim(), answers: [...answers], options };
    let ok = false;
    if (supabase) {
      const saved = await sbSaveSlot(newSlot);
      if (saved) {
        setSlots((prev) => [...prev, saved].slice(0, MAX_SLOTS));
        ok = true;
      } else {
        const existing = lsGetSlots();
        const next = [...existing, newSlot].slice(0, MAX_SLOTS);
        lsPersistSlots(next);
        setSlots(next);
        ok = true;
        setSaveError(true);
        setTimeout(() => setSaveError(false), 3000);
      }
    } else {
      const existing = lsGetSlots();
      const next = [...existing, newSlot].slice(0, MAX_SLOTS);
      lsPersistSlots(next);
      setSlots(next);
      ok = true;
    }
    setShowSaveInput(false);
    setSaveName('');
    setSaveGroup('');
    if (ok) {
      setSaveFlash(true);
      setTimeout(() => setSaveFlash(false), 1500);
    }
  }

  function doLoad(i: number) {
    const slot = slots[i];
    slot.answers.forEach((a, idx) => handleAnswerChange(idx, a));
    handleOptionsChange(slot.options);
    setShowLoad(false);
    setExpandedSlot(null);
  }

  async function doDelete(i: number) {
    const slot = slots[i];
    if (supabase && slot.id) await sbDeleteSlot(slot.id);
    const next = slots.filter((_, idx) => idx !== i);
    if (!supabase) lsPersistSlots(next);
    setSlots(next);
    if (next.length === 0) { setShowLoad(false); setExpandedSlot(null); }
    else if (expandedSlot === i) setExpandedSlot(null);
  }

  function handleExport() {
    if (slots.length === 0) return;
    const header = ['이름', ...Array.from({ length: QUESTION_COUNT }, (_, i) => `${i + 1}번`)];
    const rows = slots.map((s) => [s.name, ...s.answers]);
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = '받아쓰기정답.csv';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        let text = (evt.target?.result as string) ?? '';
        if (text.startsWith('\uFEFF')) text = text.slice(1);
        const lines = text.split(/\r?\n/).filter((l) => l.trim());
        if (lines.length < 2) { setImportMsg('데이터가 없습니다.'); return; }
        const imported: Omit<Slot, 'id'>[] = lines.slice(1).map((line) => {
          const cells = parseCSVLine(line);
          return {
            name: cells[0]?.trim() || '가져온 정답',
            answers: Array.from({ length: QUESTION_COUNT }, (_, i) => cells[i + 1]?.trim() ?? ''),
            options: DEFAULT_OPTIONS,
          };
        }).filter((s) => s.answers.some((a) => a.length > 0));
        if (imported.length === 0) { setImportMsg('유효한 데이터가 없습니다.'); return; }
        if (supabase) {
          const saved: Slot[] = [];
          for (const s of imported) {
            if (slots.length + saved.length >= MAX_SLOTS) break;
            const result = await sbSaveSlot(s);
            if (result) saved.push(result);
          }
          setSlots((prev) => [...prev, ...saved].slice(0, MAX_SLOTS));
        } else {
          const existing = lsGetSlots();
          const next = [...existing, ...imported].slice(0, MAX_SLOTS);
          lsPersistSlots(next); setSlots(next);
        }
        setImportMsg(`${imported.length}개 정답 가져오기 완료!`);
        setTimeout(() => setImportMsg(null), 2500);
      } catch {
        setImportMsg('파일을 읽는 중 오류가 발생했습니다.');
        setTimeout(() => setImportMsg(null), 2500);
      }
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-bold text-gray-800 mb-1">
          {adminMode ? '정답 관리' : '정답 입력'}
        </h2>
        <p className="text-sm text-gray-500">
          정답을 입력하고 저장해두면 다음에 바로 불러올 수 있습니다.
          {supabase && <span className="ml-1 text-blue-500 font-medium">☁ 클라우드 저장</span>}
        </p>
      </div>

      {/* 불러오기 / 저장하기 */}
      <div className="flex gap-2">
        <button
          onClick={() => { setShowLoad((v) => !v); setShowSaveInput(false); }}
          disabled={slots.length === 0 || slotsLoading}
          className="flex-1 py-2 rounded-xl text-sm font-semibold text-blue-700
                     border border-blue-300 bg-blue-50 hover:bg-blue-100 transition-colors
                     disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {slotsLoading ? '로딩...' : `불러오기 (${slots.length})`}
        </button>
        <button
          onClick={() => { setShowSaveInput((v) => !v); setShowLoad(false); }}
          disabled={!hasAny || slots.length >= MAX_SLOTS}
          className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors
            ${saveFlash
              ? 'bg-green-500 text-white border border-green-500'
              : showSaveInput
              ? 'text-blue-700 border border-blue-400 bg-blue-50'
              : 'text-gray-600 border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed'
            }`}
        >
          {saveFlash ? '저장 완료 ✓' : slots.length >= MAX_SLOTS ? `저장 (${MAX_SLOTS}/${MAX_SLOTS})` : '저장하기'}
        </button>
      </div>

      {/* 저장 입력 */}
      {showSaveInput && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 flex flex-col gap-2">
          {/* 그룹 입력 */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-blue-600 font-semibold shrink-0 w-8">그룹</span>
            <input
              type="text"
              list="group-suggestions"
              placeholder="예: 3학년, 4학년 (선택사항)"
              value={saveGroup}
              onChange={(e) => setSaveGroup(e.target.value)}
              className="flex-1 text-sm bg-white border border-blue-200 rounded-lg px-2 py-1
                         focus:outline-none focus:border-blue-400 text-gray-800 placeholder-gray-400"
            />
            <datalist id="group-suggestions">
              {existingGroups.map((g) => <option key={g} value={g} />)}
            </datalist>
          </div>
          {/* 이름 입력 */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-blue-600 font-semibold shrink-0 w-8">이름</span>
            <input
              ref={saveInputRef}
              type="text"
              placeholder="예: 3월 2주차 받아쓰기"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') confirmSave(); if (e.key === 'Escape') setShowSaveInput(false); }}
              className="flex-1 text-sm bg-white border border-blue-200 rounded-lg px-2 py-1
                         focus:outline-none focus:border-blue-400 text-gray-800 placeholder-gray-400"
            />
            <button
              onClick={confirmSave}
              className="shrink-0 px-3 py-1 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              저장
            </button>
            <button
              onClick={() => setShowSaveInput(false)}
              className="shrink-0 text-gray-400 hover:text-gray-600 text-sm"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* CSV */}
      <div className="flex gap-2">
        <button onClick={handleExport} disabled={slots.length === 0}
          className="flex-1 py-1.5 rounded-xl text-xs font-semibold text-gray-500
                     border border-gray-200 hover:bg-gray-50 transition-colors
                     disabled:opacity-40 disabled:cursor-not-allowed">
          CSV 내보내기 ↓
        </button>
        <label className="flex-1 py-1.5 rounded-xl text-xs font-semibold text-gray-500
                          border border-gray-200 hover:bg-gray-50 transition-colors
                          text-center cursor-pointer">
          CSV 가져오기 ↑
          <input ref={importRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleImport} />
        </label>
      </div>

      {saveError && (
        <div className="px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-xl text-sm text-yellow-700 text-center">
          ⚠️ 클라우드 저장 실패 – 이 기기 로컬에만 저장됐습니다
        </div>
      )}
      {importMsg && (
        <div className="px-3 py-2 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700 text-center">
          {importMsg}
        </div>
      )}

      {/* 불러오기 패널 */}
      {showLoad && slots.length > 0 && (() => {
        // 그룹별 묶기
        const grouped = slots.reduce<Record<string, { slot: Slot; idx: number }[]>>((acc, slot, idx) => {
          const g = slot.group?.trim() || '미분류';
          if (!acc[g]) acc[g] = [];
          acc[g].push({ slot, idx });
          return acc;
        }, {});
        const groupKeys = Object.keys(grouped).sort((a, b) =>
          a === '미분류' ? 1 : b === '미분류' ? -1 : a.localeCompare(b)
        );

        return (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex flex-col gap-2">
            <p className="text-xs font-semibold text-blue-700">저장된 정답 ({slots.length}개)</p>
            <div className="flex flex-col gap-3 max-h-80 overflow-y-auto">
              {groupKeys.map((groupName) => (
                <div key={groupName}>
                  <p className="text-xs font-bold text-blue-500 uppercase tracking-wide mb-1 px-1">
                    📁 {groupName}
                  </p>
                  <div className="flex flex-col gap-1">
                    {grouped[groupName].map(({ slot, idx: i }) => {
                      const nonEmpty = slot.answers
                        .map((a, idx) => a.trim() ? `${idx + 1}. ${a}` : null)
                        .filter(Boolean) as string[];
                      const preview = nonEmpty.slice(0, 3).join('  ');
                      const isExpanded = expandedSlot === i;

                      return (
                        <div key={slot.id ?? i} className="border border-gray-200 rounded-xl overflow-hidden bg-white">
                          <div className="flex items-center gap-2 px-3 py-2">
                            <button
                              onClick={() => setExpandedSlot(isExpanded ? null : i)}
                              className="flex-1 text-left flex items-center gap-2 min-w-0"
                            >
                              <span className="text-sm font-semibold text-gray-800 truncate">{slot.name}</span>
                              <span className="text-gray-400 text-xs shrink-0">{isExpanded ? '▲' : '▼'}</span>
                            </button>
                            <button onClick={() => doLoad(i)}
                              className="shrink-0 px-2 py-1 text-xs font-semibold text-blue-700
                                         border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors">
                              불러오기
                            </button>
                            <button onClick={() => doDelete(i)}
                              className="shrink-0 w-6 h-6 flex items-center justify-center
                                         text-gray-400 hover:text-red-500 transition-colors text-sm">
                              ✕
                            </button>
                          </div>
                          {!isExpanded && nonEmpty.length > 0 && (
                            <div className="px-3 pb-2">
                              <p className="text-xs text-gray-400 truncate">
                                {preview}{nonEmpty.length > 3 ? ` 외 ${nonEmpty.length - 3}개` : ''}
                              </p>
                            </div>
                          )}
                          {isExpanded && (
                            <div className="px-3 pb-3 grid grid-cols-2 gap-x-4 gap-y-0.5 border-t border-gray-100 pt-2">
                              {slot.answers.map((a, idx) =>
                                a.trim() ? (
                                  <div key={idx} className="flex gap-1 items-baseline">
                                    <span className="text-xs font-bold text-red-400 shrink-0 w-4 text-right">{idx + 1}.</span>
                                    <span className="text-xs text-gray-700 truncate">{a}</span>
                                  </div>
                                ) : null
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* 정답 입력 */}
      <div className="flex flex-col notebook-lines rounded-xl overflow-hidden border border-amber-100">
        {answers.map((value, i) => (
          <div key={i} className="flex items-center gap-2 px-3 border-b border-blue-100 last:border-0"
            style={{ minHeight: '40px' }}>
            <span className="text-sm font-bold text-red-400 w-5 text-right shrink-0">{i + 1}.</span>
            <input type="text"
              className="flex-1 py-2 text-sm bg-transparent border-0 focus:outline-none placeholder-gray-300 text-gray-800"
              placeholder={`${i + 1}번 정답`}
              value={value}
              onChange={(e) => handleAnswerChange(i, e.target.value)}
            />
          </div>
        ))}
      </div>

      {/* 채점 설정 */}
      <div className="flex flex-col gap-2 border-t border-gray-100 pt-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">채점 설정</p>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" checked={options.ignorePunctuation}
            onChange={(e) => handleOptionsChange({ ...options, ignorePunctuation: e.target.checked })}
            className="w-4 h-4 rounded accent-blue-700" />
          <span className="text-sm text-gray-700">문장부호 채점 제외</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" checked={options.skipHeaderLine}
            onChange={(e) => handleOptionsChange({ ...options, skipHeaderLine: e.target.checked })}
            className="w-4 h-4 rounded accent-blue-700" />
          <span className="text-sm text-gray-700">시험지 첫 줄(이름·학년란) 자동 무시</span>
        </label>
      </div>

      {!adminMode && onNext && (
        <button onClick={onNext} disabled={!hasAny}
          className="w-full py-3 rounded-xl font-semibold text-white text-base
                     bg-blue-700 hover:bg-blue-800 active:bg-blue-900
                     disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors">
          다음 →
        </button>
      )}
    </div>
  );
}
