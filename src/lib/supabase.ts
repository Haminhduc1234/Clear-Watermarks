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

/**
 * Kiểm tra tài khoản đã được Admin phê duyệt trên Supabase hay chưa.
 * Admin phê duyệt bằng cách đặt "is_approved": true (hoặc "approved": true / "role": "admin")
 * trong User app_metadata hoặc user_metadata trên Supabase Console.
 */
export function isUserApproved(user: SupabaseUser): boolean {
  const appMeta = (user.app_metadata || {}) as Record<string, any>;
  const userMeta = (user.user_metadata || {}) as Record<string, any>;
  const email = (user.email || '').toLowerCase();

  // Tài khoản Admin được tự động duyệt
  if (email.startsWith('admin@') || appMeta.role === 'admin' || userMeta.role === 'admin') {
    return true;
  }

  // Kiểm tra cờ duyệt từ app_metadata (an toàn nhất, chỉ Admin Supabase sửa được)
  if (appMeta.is_approved === true || appMeta.approved === true || appMeta.status === 'approved') {
    return true;
  }

  // Kiểm tra cờ duyệt nếu Admin chỉnh sửa trong user_metadata
  if (userMeta.is_approved === true || userMeta.approved === true || userMeta.status === 'approved') {
    return true;
  }

  return false;
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
    isApproved: isUserApproved(user),
    createdAt: user.created_at || new Date().toISOString(),
  };
}
