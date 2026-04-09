import { supabase } from './supabase';
import { GradingOptions, Slot } from '@/types';

export const SLOTS_KEY = 'dictation-slots';
export const MAX_SLOTS = 10;
export const QUESTION_COUNT = 10;

export function lsGetSlots(): Slot[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SLOTS_KEY);
    return raw ? (JSON.parse(raw) as Slot[]) : [];
  } catch { return []; }
}

export function lsPersistSlots(slots: Slot[]) {
  localStorage.setItem(SLOTS_KEY, JSON.stringify(slots));
}

function mapRowToSlot(row: {
  id: string;
  name: string;
  answers: string[];
  options: GradingOptions;
  group?: string | null;
}): Slot {
  return {
    id: row.id,
    name: row.name,
    group: row.group ?? '',
    answers: row.answers,
    options: row.options,
  };
}

function isMissingGroupColumnError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const msg = String((error as { message?: string }).message ?? '').toLowerCase();
  return msg.includes('group') && msg.includes('column');
}

export async function sbLoadSlots(): Promise<Slot[]> {
  if (!supabase) return [];
  const withGroup = await supabase
    .from('answer_slots')
    .select('id, name, group, answers, options')
    .order('group', { ascending: true })
    .order('created_at', { ascending: true });

  // 기존 테이블에 group 컬럼이 없을 수 있어 하위 호환 조회를 제공합니다.
  if (withGroup.error && isMissingGroupColumnError(withGroup.error)) {
    const withoutGroup = await supabase
      .from('answer_slots')
      .select('id, name, answers, options')
      .order('created_at', { ascending: true });
    if (withoutGroup.error || !withoutGroup.data) return [];
    const slots = withoutGroup.data.map((r) => mapRowToSlot({
      id: r.id as string,
      name: r.name as string,
      answers: r.answers as string[],
      options: r.options as GradingOptions,
    }));
    if (typeof window !== 'undefined') lsPersistSlots(slots);
    return slots;
  }

  if (withGroup.error || !withGroup.data) return [];
  const slots = withGroup.data.map((r) => mapRowToSlot({
    id: r.id as string,
    name: r.name as string,
    group: r.group as string | null,
    answers: r.answers as string[],
    options: r.options as GradingOptions,
  }));
  if (typeof window !== 'undefined') lsPersistSlots(slots);
  return slots;
}

export async function sbSaveSlot(slot: Omit<Slot, 'id'>): Promise<Slot | null> {
  if (!supabase) return null;
  const withGroup = await supabase
    .from('answer_slots')
    .insert({ name: slot.name, group: slot.group ?? '', answers: slot.answers, options: slot.options })
    .select('id, name, group, answers, options')
    .single();

  if (!withGroup.error && withGroup.data) {
    const saved = mapRowToSlot({
      id: withGroup.data.id as string,
      name: withGroup.data.name as string,
      group: withGroup.data.group as string | null,
      answers: withGroup.data.answers as string[],
      options: withGroup.data.options as GradingOptions,
    });
    return saved;
  }

  // group 컬럼이 아직 없는 DB를 위한 하위 호환 저장 경로
  if (isMissingGroupColumnError(withGroup.error)) {
    const withoutGroup = await supabase
      .from('answer_slots')
      .insert({ name: slot.name, answers: slot.answers, options: slot.options })
      .select('id, name, answers, options')
      .single();
    if (withoutGroup.error || !withoutGroup.data) return null;
    const saved = mapRowToSlot({
      id: withoutGroup.data.id as string,
      name: withoutGroup.data.name as string,
      answers: withoutGroup.data.answers as string[],
      options: withoutGroup.data.options as GradingOptions,
    });
    return saved;
  }

  return null;
}

export async function sbDeleteSlot(id: string) {
  if (!supabase) return;
  await supabase.from('answer_slots').delete().eq('id', id);
}

/**
 * Returns null when Supabase connection/table access is healthy,
 * otherwise returns a short error message for UI diagnostics.
 */
export async function sbProbeAnswerSlots(): Promise<string | null> {
  if (!supabase) return 'Supabase 환경변수(URL/ANON KEY)가 비어 있습니다.';
  const { error } = await supabase
    .from('answer_slots')
    .select('id', { head: true, count: 'exact' });
  if (!error) return null;
  return error.message || 'answer_slots 접근에 실패했습니다.';
}

/** Loads from Supabase if available, falls back to localStorage */
export async function loadAllSlots(): Promise<Slot[]> {
  if (supabase) {
    const data = await sbLoadSlots();
    if (data.length > 0) return data;
  }
  return lsGetSlots();
}
