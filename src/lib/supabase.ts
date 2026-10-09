import { createClient, SupabaseClient, User as SupabaseUser } from '@supabase/supabase-js';
import type { User } from '../types/auth';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('http')
);

let supabaseClientInstance: SupabaseClient | null = null;

if (isSupabaseConfigured) {
  try {
    supabaseClientInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  } catch (err) {
    console.error('Lỗi khởi tạo Supabase Client:', err);
  }
}

export function getSupabase(): SupabaseClient | null {
  return supabaseClientInstance;
}

export function mapSupabaseUser(user: SupabaseUser): User {
  const meta = (user.user_metadata || {}) as Record<string, any>;
  const email = user.email || '';
  const name = meta.full_name || meta.name || email.split('@')[0] || 'Người dùng';
  const role = (meta.role === 'admin' || user.app_metadata?.role === 'admin' || email.toLowerCase().includes('admin')) 
    ? 'admin' 
    : 'user';

  return {
    id: user.id,
    name,
    email,
    role,
    createdAt: user.created_at || new Date().toISOString(),
  };
}
