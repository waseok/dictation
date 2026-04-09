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

export async function sbLoadSlots(): Promise<Slot[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('answer_slots')
    .select('id, name, group, answers, options')
    .order('group', { ascending: true })
    .order('created_at', { ascending: true });
  if (error || !data) return [];
  return data.map((r) => ({
    id: r.id as string,
    name: r.name as string,
    group: (r.group as string) || '',
    answers: r.answers as string[],
    options: r.options as GradingOptions,
  }));
}

export async function sbSaveSlot(slot: Omit<Slot, 'id'>): Promise<Slot | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('answer_slots')
    .insert({ name: slot.name, group: slot.group ?? '', answers: slot.answers, options: slot.options })
    .select('id, name, group, answers, options')
    .single();
  if (error || !data) return null;
  return {
    id: data.id as string,
    name: data.name as string,
    group: (data.group as string) || '',
    answers: data.answers as string[],
    options: data.options as GradingOptions,
  };
}

export async function sbDeleteSlot(id: string) {
  if (!supabase) return;
  await supabase.from('answer_slots').delete().eq('id', id);
}

/** Loads from Supabase if available, falls back to localStorage */
export async function loadAllSlots(): Promise<Slot[]> {
  if (supabase) {
    const data = await sbLoadSlots();
    if (data.length > 0) return data;
  }
  return lsGetSlots();
}
