import type { Plugin } from 'vite';
import { registerUser, loginUser, verifyToken, getUserById } from './authService';

export function viteAuthPlugin(): Plugin {
  return {
    name: 'vite-auth-api-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0];

        // Only handle /api/auth/* routes
        if (!url || !url.startsWith('/api/auth/')) {
          return next();
        }

        // Helper to send JSON responses
        const sendJson = (statusCode: number, data: any) => {
          res.statusCode = statusCode;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify(data));
        };

        // Helper to parse JSON body
        const parseBody = (): Promise<any> => {
          return new Promise((resolve, reject) => {
            let body = '';
            req.on('data', (chunk) => {
              body += chunk;
            });
            req.on('end', () => {
              try {
                resolve(body ? JSON.parse(body) : {});
              } catch (e) {
                reject(new Error('Invalid JSON format'));
              }
            });
            req.on('error', reject);
          });
        };

        try {
          // 1. POST /api/auth/register
          if (req.method === 'POST' && url === '/api/auth/register') {
            const body = await parseBody();
            const { name, email, password } = body;
            const result = registerUser(name, email, password);
            return sendJson(200, { success: true, ...result });
          }

          // 2. POST /api/auth/login
          if (req.method === 'POST' && url === '/api/auth/login') {
            const body = await parseBody();
            const { email, password } = body;
            const result = loginUser(email, password);
            return sendJson(200, { success: true, ...result });
          }

          // 3. GET /api/auth/me
          if (req.method === 'GET' && url === '/api/auth/me') {
            const authHeader = req.headers['authorization'];
            const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

            if (!token) {
              return sendJson(401, { success: false, message: 'Chưa đăng nhập hoặc token không hợp lệ' });
            }

            const payload = verifyToken(token);
            if (!payload) {
              return sendJson(401, { success: false, message: 'Phiên đăng nhập đã hết hạn' });
            }

            const user = getUserById(payload.id);
            if (!user) {
              return sendJson(404, { success: false, message: 'Người dùng không tồn tại' });
            }

            return sendJson(200, { success: true, user });
          }

          // 4. POST /api/auth/logout
          if (req.method === 'POST' && url === '/api/auth/logout') {
            return sendJson(200, { success: true, message: 'Đăng xuất thành công' });
          }

          // Not found under /api/auth/
          return sendJson(404, { success: false, message: 'API endpoint not found' });
        } catch (err: any) {
          return sendJson(400, {
            success: false,
            message: err.message || 'Lỗi xử lý yêu cầu xác thực',
          });
        }
      });
    },
  };
}
