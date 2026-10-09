import type { Plugin } from 'vite';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load .env and .env.local
dotenv.config();
if (fs.existsSync(path.resolve(process.cwd(), '.env.local'))) {
  const envConfig = dotenv.parse(fs.readFileSync(path.resolve(process.cwd(), '.env.local')));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
}

function getAdminClient(customKey?: string) {
  const supabaseUrl = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim();
  const serviceRoleKey = (
    customKey ||
    process.env.SUPABASE_SERVICE_ROLE_KEY || 
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 
    ''
  ).trim();

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function viteAdminPlugin(): Plugin {
  return {
    name: 'vite-supabase-admin-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0];

        if (!url?.startsWith('/api/admin/')) {
          return next();
        }

        // Set JSON response header
        res.setHeader('Content-Type', 'application/json');

        const headerKey = (req.headers['x-supabase-service-key'] as string) || '';
        const adminClient = getAdminClient(headerKey);
        if (!adminClient) {
          res.statusCode = 503;
          res.end(
            JSON.stringify({
              success: false,
              message:
                'Chưa cấu hình SUPABASE_SERVICE_ROLE_KEY trong file .env.local. Vui lòng lấy service_role key tại Supabase Dashboard > Project Settings > API.',
              missingServiceKey: true,
            })
          );
          return;
        }

        // Handle GET /api/admin/users
        if (url === '/api/admin/users' && req.method === 'GET') {
          try {
            const { data, error } = await adminClient.auth.admin.listUsers({
              page: 1,
              perPage: 100,
            });

            if (error) {
              res.statusCode = 500;
              res.end(JSON.stringify({ success: false, message: error.message }));
              return;
            }

            const users = data.users.map((u) => {
              const appMeta = u.app_metadata || {};
              const userMeta = u.user_metadata || {};
              const isApproved =
                appMeta.is_approved === true ||
                appMeta.approved === true ||
                userMeta.is_approved === true ||
                userMeta.approved === true ||
                (u.email || '').toLowerCase().startsWith('admin@');

              return {
                id: u.id,
                email: u.email,
                name: userMeta.name || userMeta.full_name || u.email?.split('@')[0] || 'Chưa đặt tên',
                role: appMeta.role === 'admin' || (u.email || '').toLowerCase().startsWith('admin@') ? 'admin' : 'user',
                isApproved,
                createdAt: u.created_at,
                lastSignInAt: u.last_sign_in_at,
              };
            });

            res.statusCode = 200;
            res.end(JSON.stringify({ success: true, users }));
            return;
          } catch (err: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ success: false, message: err.message }));
            return;
          }
        }

        // Read request body helper
        const readBody = async (): Promise<any> => {
          return new Promise((resolve, reject) => {
            let body = '';
            req.on('data', (chunk) => (body += chunk));
            req.on('end', () => {
              try {
                resolve(body ? JSON.parse(body) : {});
              } catch (e) {
                reject(e);
              }
            });
            req.on('error', reject);
          });
        };

        // Handle POST /api/admin/approve-user
        if (url === '/api/admin/approve-user' && req.method === 'POST') {
          try {
            const body = await readBody();
            const { userId, approve = true } = body;

            if (!userId) {
              res.statusCode = 400;
              res.end(JSON.stringify({ success: false, message: 'Thiếu userId' }));
              return;
            }

            // Update user in Supabase
            const { data, error } = await adminClient.auth.admin.updateUserById(userId, {
              app_metadata: { is_approved: approve },
              user_metadata: { is_approved: approve },
            });

            if (error) {
              res.statusCode = 500;
              res.end(JSON.stringify({ success: false, message: error.message }));
              return;
            }

            res.statusCode = 200;
            res.end(
              JSON.stringify({
                success: true,
                message: approve ? 'Đã duyệt tài khoản thành công' : 'Đã khóa/hủy duyệt tài khoản',
                user: data.user,
              })
            );
            return;
          } catch (err: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ success: false, message: err.message }));
            return;
          }
        }

        // Handle DELETE /api/admin/delete-user
        if (url === '/api/admin/delete-user' && req.method === 'POST') {
          try {
            const body = await readBody();
            const { userId } = body;

            if (!userId) {
              res.statusCode = 400;
              res.end(JSON.stringify({ success: false, message: 'Thiếu userId' }));
              return;
            }

            const { error } = await adminClient.auth.admin.deleteUser(userId);

            if (error) {
              res.statusCode = 500;
              res.end(JSON.stringify({ success: false, message: error.message }));
              return;
            }

            res.statusCode = 200;
            res.end(JSON.stringify({ success: true, message: 'Đã xóa người dùng thành công' }));
            return;
          } catch (err: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ success: false, message: err.message }));
            return;
          }
        }

        // Handle POST /api/admin/register (Đăng ký tài khoản không gửi email xác thực, chờ admin duyệt)
        if (url === '/api/admin/register' && req.method === 'POST') {
          try {
            const body = await readBody();
            const { email, password, name } = body;

            if (!email || !password) {
              res.statusCode = 400;
              res.end(JSON.stringify({ success: false, message: 'Vui lòng cung cấp email và mật khẩu' }));
              return;
            }

            // Tạo user bằng Supabase Admin với email_confirm: true để bỏ qua bước gửi email
            const { data, error } = await adminClient.auth.admin.createUser({
              email: email.trim(),
              password: password,
              email_confirm: true, // Không gửi email xác thực, không bị rate limit
              user_metadata: {
                name: name?.trim() || undefined,
                is_approved: false, // Chờ admin duyệt
              },
              app_metadata: {
                is_approved: false,
              },
            });

            if (error) {
              res.statusCode = 400;
              res.end(JSON.stringify({ success: false, message: error.message }));
              return;
            }

            res.statusCode = 200;
            res.end(
              JSON.stringify({
                success: true,
                message: 'Đăng ký thành công, đang chờ Admin duyệt',
                user: data.user,
              })
            );
            return;
          } catch (err: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ success: false, message: err.message }));
            return;
          }
        }

        res.statusCode = 404;
        res.end(JSON.stringify({ success: false, message: 'Route không tồn tại' }));
      });
    },
  };
}
