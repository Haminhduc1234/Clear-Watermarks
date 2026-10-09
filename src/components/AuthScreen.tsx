import React, { useState } from 'react';
import {
  Lock,
  Mail,
  User as UserIcon,
  LogIn,
  UserPlus,
  ShieldCheck,
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2
} from 'lucide-react';
import type { User } from '../types/auth';
import {
  getSupabase,
  isSupabaseConfigured,
  mapSupabaseUser
} from '../lib/supabase';

interface AuthScreenProps {
  onAuthSuccess: (user: User, token: string) => void;
}

export default function AuthScreen({ onAuthSuccess }: AuthScreenProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);
    setIsLoading(true);

    if (!isSupabaseConfigured) {
      setError('Chưa cấu hình VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY trong file .env.local.');
      setIsLoading(false);
      return;
    }

    const supabase = getSupabase();
    if (!supabase) {
      setError('Không thể kết nối tới Supabase. Vui lòng kiểm tra lại thông tin cấu hình trong file .env.local.');
      setIsLoading(false);
      return;
    }

    try {
      if (mode === 'login') {
        const { data, error: loginError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (loginError) {
          throw loginError;
        }

        if (data.user && data.session) {
          const appUser = mapSupabaseUser(data.user);
          onAuthSuccess(appUser, data.session.access_token);
        } else {
          throw new Error('Không thể khởi tạo phiên đăng nhập.');
        }
      } else {
        // Mode: Register
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              name: name.trim() || undefined,
            },
          },
        });

        if (signUpError) {
          throw signUpError;
        }

        if (data.session && data.user) {
          // Auto-login if email confirmation is disabled
          const appUser = mapSupabaseUser(data.user);
          onAuthSuccess(appUser, data.session.access_token);
        } else if (data.user) {
          // Email confirmation is required
          setInfoMessage(
            'Tài khoản đã tạo thành công! Vui lòng kiểm tra email để kích hoạt tài khoản (hoặc tắt Confirm email trong Supabase Console).'
          );
          setMode('login');
        }
      }
    } catch (err: any) {
      console.error('Supabase Auth error:', err);
      let msg = err.message || 'Đã có lỗi xảy ra. Vui lòng thử lại.';
      if (msg.includes('Invalid login credentials')) {
        msg = 'Email hoặc mật khẩu không chính xác.';
      } else if (msg.includes('User already registered')) {
        msg = 'Email này đã được đăng ký. Vui lòng chuyển sang tab Đăng nhập.';
      } else if (msg.includes('Password should be at least')) {
        msg = 'Mật khẩu phải có ít nhất 6 ký tự.';
      }
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white flex flex-col justify-center items-center px-4 py-8 sm:px-6 relative overflow-hidden font-sans">
      {/* Background ambient decorative glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-blue-600/20 blur-[140px] rounded-full pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[320px] h-[320px] bg-indigo-500/15 blur-[120px] rounded-full pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-md bg-slate-900/85 backdrop-blur-2xl border border-slate-700/60 rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10 animate-in fade-in zoom-in-95 duration-300">

        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/25 mb-3.5">
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            ClearMark
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Ứng dụng xóa watermark hoàn toàn miễn phí
          </p>
        </div>

        {/* Missing ENV Warning */}
        {!isSupabaseConfigured && (
          <div className="mb-5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
            <div className="leading-relaxed">
              <strong>Chưa tìm thấy biến môi trường:</strong> Vui lòng điền <code className="text-amber-300 font-mono">VITE_SUPABASE_URL</code> và <code className="text-amber-300 font-mono">VITE_SUPABASE_ANON_KEY</code> vào file <code className="text-white font-mono">.env.local</code>.
            </div>
          </div>
        )}

        {/* Mode Toggle (Tabs) */}
        <div className="grid grid-cols-2 p-1 bg-slate-800/80 rounded-xl mb-5 border border-slate-700/50">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
              setInfoMessage(null);
            }}
            className={`py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${mode === 'login'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
              }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Đăng nhập</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError(null);
              setInfoMessage(null);
            }}
            className={`py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${mode === 'register'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
              }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Tạo tài khoản</span>
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-start gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
            <span className="leading-snug">{error}</span>
          </div>
        )}

        {/* Info Message Alert */}
        {infoMessage && (
          <div className="mb-4 p-3 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-200 text-xs flex items-start gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-blue-400" />
            <span className="leading-snug">{infoMessage}</span>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Họ và tên
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nguyễn Văn A"
                  className="w-full bg-slate-800/60 border border-slate-700/80 rounded-xl py-2.5 pl-10 pr-3.5 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Địa chỉ Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tenban@example.com"
                className="w-full bg-slate-800/60 border border-slate-700/80 rounded-xl py-2.5 pl-10 pr-3.5 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Mật khẩu
              </label>
              <span className="text-[11px] text-slate-400">
                Tối thiểu 6 ký tự
              </span>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-800/60 border border-slate-700/80 rounded-xl py-2.5 pl-10 pr-10 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || !isSupabaseConfigured}
            className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang kết nối...</span>
              </>
            ) : mode === 'login' ? (
              <>
                <LogIn className="w-4 h-4" />
                <span>Đăng nhập</span>
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                <span>Đăng ký</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Bottom Footer Info */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-xs text-slate-500">
        <span>JWT Session Storage</span>
        <span>•</span>
        <span>Xử lý video ngoại tuyến an toàn</span>
      </div>
    </div>
  );
}
