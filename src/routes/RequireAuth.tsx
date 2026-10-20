import { useEffect, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Spin } from 'antd';
import { useAuthStore } from '@/api/session';

/**
 * 路由守卫。
 *
 * 会话检查策略：
 *  - 首次进入时调 checkSession()，优先打 /api/v1/me（后端待新增），
 *    未实现则退化为探活老接口（见 session.ts）
 *  - 失败 → 跳后端登录页，并把当前路由记在 ?redirect=
 *
 * ⚠️ 这里【不做权限判断】，只判断"有没有登录"。
 *    权限是按钮/菜单级的（PermButton / 菜单过滤），
 *    而真正的安全边界在后端 Shiro 的 perms[] 校验。
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const ready = useAuthStore((s) => s.ready);
  const user = useAuthStore((s) => s.user);
  const checkSession = useAuthStore((s) => s.checkSession);
  const location = useLocation();

  useEffect(() => {
    if (!ready) {
      void checkSession().catch(() => {
        /* 网络类错误不误踢，checkSession 内部已处理未登录情况 */
      });
    }
  }, [ready, checkSession]);

  if (!ready) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 120 }}>
        <Spin size="large" tip="正在校验登录状态…">
          <div style={{ width: 160, height: 40 }} />
        </Spin>
      </div>
    );
  }

  if (!user) {
    // 未登录：本地登录页（走老系统 Shiro 表单登录）
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
