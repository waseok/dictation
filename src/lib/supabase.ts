import { createClient } from '@supabase/supabase-js';

/*
 * Supabase 테이블 설정 (한 번만 실행):
 *
 * CREATE TABLE answer_slots (
 *   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 *   name text NOT NULL,
 *   answers jsonb NOT NULL DEFAULT '[]',
 *   options jsonb NOT NULL DEFAULT '{}',
 *   created_at timestamptz NOT NULL DEFAULT now()
 * );
 * ALTER TABLE answer_slots ENABLE ROW LEVEL SECURITY;
 * CREATE POLICY "public_all" ON answer_slots FOR ALL USING (true) WITH CHECK (true);
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const supabase = url && key ? createClient(url, key) : null;
