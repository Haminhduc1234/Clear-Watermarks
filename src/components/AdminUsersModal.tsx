import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Users,
  CheckCircle2,
  Ban,
  Trash2,
  Search,
  RefreshCw,
  ShieldCheck,
  AlertCircle,
  KeyRound,
  Loader2,
  UserCheck,
  UserX
} from 'lucide-react';
import type { User } from '../types/auth';

interface AdminUsersModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
}

interface ManagedUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  isApproved: boolean;
  createdAt: string;
  lastSignInAt?: string;
}

const LOCAL_SERVICE_KEY = 'clearmark_service_role_key';

export default function AdminUsersModal({ isOpen, onClose, currentUser }: AdminUsersModalProps) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved'>('all');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Service role key input state (if missing from .env.local)
  const [missingKey, setMissingKey] = useState(false);
  const [serviceKeyInput, setServiceKeyInput] = useState(() => localStorage.getItem(LOCAL_SERVICE_KEY) || '');

  const getHeaders = useCallback(() => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const key = (serviceKeyInput || localStorage.getItem(LOCAL_SERVICE_KEY) || '').trim();
    if (key) {
      headers['x-supabase-service-key'] = key;
    }
    return headers;
  }, [serviceKeyInput]);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/users', {
        headers: getHeaders(),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.missingServiceKey) {
          setMissingKey(true);
        }
        throw new Error(data.message || 'Không thể tải danh sách người dùng');
      }

      setMissingKey(false);
      setUsers(data.users || []);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi tải dữ liệu người dùng');
    } finally {
      setIsLoading(false);
    }
  }, [getHeaders]);

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
    }
  }, [isOpen, fetchUsers]);

  const handleSaveServiceKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceKeyInput.trim()) return;
    localStorage.setItem(LOCAL_SERVICE_KEY, serviceKeyInput.trim());
    setMissingKey(false);
    fetchUsers();
  };

  const handleToggleApproval = async (userId: string, targetApproved: boolean) => {
    setActionLoadingId(userId);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch('/api/admin/approve-user', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ userId, approve: targetApproved }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Không thể cập nhật quyền người dùng');
      }

      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, isApproved: targetApproved } : u))
      );
      setSuccessMsg(targetApproved ? 'Đã duyệt người dùng thành công!' : 'Đã khóa tài khoản thành công!');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi thực hiện thao tác');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeleteUser = async (userId: string, email: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa vĩnh viễn tài khoản ${email}?`)) {
      return;
    }

    setActionLoadingId(userId);
    setError(null);
    try {
      const res = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Không thể xóa người dùng');
      }

      setUsers((prev) => prev.filter((u) => u.id !== userId));
      setSuccessMsg(`Đã xóa tài khoản ${email}`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi xóa người dùng');
    } finally {
      setActionLoadingId(null);
    }
  };

  if (!isOpen) return null;

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.name.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (filter === 'pending') return !u.isApproved && u.role !== 'admin';
    if (filter === 'approved') return u.isApproved || u.role === 'admin';
    return true;
  });

  const pendingCount = users.filter((u) => !u.isApproved && u.role !== 'admin').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-600/20 shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                  Quản lý & Duyệt người dùng
                </h2>
                {pendingCount > 0 && (
                  <span className="px-2 py-0.5 text-xs font-bold bg-amber-500 text-white rounded-full animate-pulse">
                    {pendingCount} chờ duyệt
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Duyệt hoặc thu hồi quyền truy cập của người dùng ngay trên hệ thống
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchUsers}
              disabled={isLoading}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Làm mới danh sách"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Đóng cửa sổ"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 flex-1 overflow-y-auto space-y-4">
          
          {/* Missing Service Key Alert / Prompt */}
          {missingKey && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs space-y-3">
              <div className="flex items-start gap-2.5">
                <KeyRound className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-sm text-amber-700 dark:text-amber-300">
                    Cần cung cấp Supabase Service Role Key
                  </h4>
                  <p className="mt-1 text-slate-600 dark:text-slate-300 leading-relaxed">
                    Để quản lý và duyệt danh sách người dùng ngay trên giao diện này, bạn cần điền{' '}
                    <code className="font-mono font-bold bg-amber-100 dark:bg-amber-950/60 px-1.5 py-0.5 rounded text-amber-800 dark:text-amber-300">
                      SUPABASE_SERVICE_ROLE_KEY
                    </code>{' '}
                    vào file <code className="font-mono font-bold">.env.local</code> hoặc dán trực tiếp vào ô bên dưới:
                  </p>
                </div>
              </div>

              <form onSubmit={handleSaveServiceKey} className="flex gap-2 pt-1">
                <input
                  type="password"
                  placeholder="Dán service_role secret key (eyJhbGciOi...)..."
                  value={serviceKeyInput}
                  onChange={(e) => setServiceKeyInput(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700/60 rounded-xl focus:outline-hidden font-mono"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs"
                >
                  Áp dụng & Tải lại
                </button>
              </form>
            </div>
          )}

          {/* Success / Error Banners */}
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/30 text-green-700 dark:text-green-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-green-500" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Controls: Search & Tabs */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm theo tên hoặc email người dùng..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 text-xs sm:text-sm bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:border-blue-500 transition-colors"
              />
            </div>

            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shrink-0">
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  filter === 'all'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Tất cả ({users.length})
              </button>
              <button
                type="button"
                onClick={() => setFilter('pending')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  filter === 'pending'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Chờ duyệt ({pendingCount})
              </button>
              <button
                type="button"
                onClick={() => setFilter('approved')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  filter === 'approved'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Đã duyệt ({users.length - pendingCount})
              </button>
            </div>
          </div>

          {/* User Table / List */}
          {isLoading && users.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              <span className="text-xs">Đang tải danh sách người dùng từ Supabase...</span>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-16 text-center text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
              <UserX className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
              <p className="text-sm font-medium">Không tìm thấy người dùng nào</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {searchQuery ? 'Thử tìm với từ khóa khác' : 'Chưa có tài khoản nào được tạo'}
              </p>
            </div>
          ) : (
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900/60 shadow-2xs">
              {filteredUsers.map((u) => {
                const isCurrent = u.id === currentUser.id;
                const isAdmin = u.role === 'admin';
                const isWorking = actionLoadingId === u.id;

                return (
                  <div
                    key={u.id}
                    className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    {/* User profile info */}
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-sm uppercase shrink-0 shadow-xs">
                        {u.name.charAt(0) || u.email.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                            {u.name}
                          </span>
                          {isAdmin && (
                            <span className="px-2 py-0.5 text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 rounded-full border border-indigo-200 dark:border-indigo-800">
                              Quản trị viên
                            </span>
                          )}
                          {isCurrent && (
                            <span className="px-1.5 py-0.2 text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-full font-medium">
                              Bạn
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {u.email}
                        </div>
                        <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                          Đăng ký: {new Date(u.createdAt).toLocaleDateString('vi-VN')}
                        </div>
                      </div>
                    </div>

                    {/* Status & Action buttons */}
                    <div className="flex items-center gap-2 self-end sm:self-center">
                      {/* Status badge */}
                      {isAdmin || u.isApproved ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Đã kích hoạt</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 animate-pulse">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>Chờ duyệt</span>
                        </span>
                      )}

                      {/* Action buttons */}
                      {!isAdmin && !isCurrent && (
                        <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200 dark:border-slate-800">
                          {!u.isApproved ? (
                            <button
                              type="button"
                              disabled={isWorking}
                              onClick={() => handleToggleApproval(u.id, true)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all shadow-xs cursor-pointer disabled:opacity-50"
                              title="Duyệt cho phép người dùng đăng nhập"
                            >
                              {isWorking ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <UserCheck className="w-3.5 h-3.5" />
                              )}
                              <span>Duyệt</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={isWorking}
                              onClick={() => handleToggleApproval(u.id, false)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-amber-50 dark:bg-slate-800 dark:hover:bg-amber-950/50 text-slate-700 hover:text-amber-600 dark:text-slate-300 dark:hover:text-amber-400 text-xs font-medium border border-slate-200 dark:border-slate-700 transition-colors"
                              title="Khóa quyền đăng nhập của người dùng"
                            >
                              {isWorking ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Ban className="w-3.5 h-3.5" />
                              )}
                              <span>Khóa</span>
                            </button>
                          )}

                          <button
                            type="button"
                            disabled={isWorking}
                            onClick={() => handleDeleteUser(u.id, u.email)}
                            className="p-1.5 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                            title="Xóa vĩnh viễn người dùng"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="p-3.5 sm:p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span>Tổng số: <strong>{users.length}</strong> tài khoản</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs transition-colors"
          >
            Đóng
          </button>
        </div>

      </div>
    </div>
  );
}
