import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Form, Input } from 'antd';
import { useAuthStore } from '@/api/session';
import { getBackendVersion } from '@/api/modules/meta';
import { CONTEXT_PATH, appUrl } from '@/api/config';

/**
 * 登录页（2026-10-28 改版：负责人裁决弃用「原生元素逐像素复刻老页」方案，统一 antd 组件）。
 *
 * 保留老页构图骨架：背景图（/html/images/login_background.jpg）、容器 margin-left 60%、
 * 白色圆角卡片 345px、产品名大标题。表单控件全面 antd 化：
 *   Form（必填校验替代手写检查）+ Input.Password + Button loading（自转圈+禁用，替代手写 spinner）。
 * 固定高度错误位保留：Alert 出现/消失不推挤布局（2026-10-28 修复的表单跳动不回归）。
 *
 * 登录通道不变：POST /console/aspanse/api/v1/auth/login（AuthApiController，Session 轨，
 * 复用 jar 内桌面登录同款 token 与密码策略）；成功即建立同一套 Shiro Session。
 * 深链接回跳：消费 ?redirect=（仅放行站内相对路径，防开放重定向）；默认回 SPA 挂载点，
 * 不能用裸 '/'——那是服务器根路径，形态 B 下会落到 Tomcat ROOT 欢迎页。
 */
export function LoginPage() {
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(() =>
    searchParams.get('reason') === 'timeout' ? '登录已超时，请重新登录' : null,
  );
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);

  const versionQuery = useQuery({
    queryKey: ['meta-version'],
    queryFn: getBackendVersion,
    staleTime: 10 * 60_000,
    retry: 1,
  });

  const onFinish = async (values: { username: string; password: string }) => {
    setError(null);
    setLoading(true);
    try {
      await login(values.username, values.password);
      // 深链接回跳：无 redirect 时回 SPA 挂载点（appUrl('/')=/console/app/），
      // 不能用裸 '/'——那是服务器根路径，形态 B 下会落到 Tomcat ROOT 欢迎页
      const redirect = searchParams.get('redirect');
      const safeTarget =
        redirect && redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : appUrl('/');
      window.location.replace(safeTarget);
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        margin: 0,
        padding: 0,
        // 老页同款背景图（容器 CSS 背景 cover 始终铺满，负责人 2026-10-21 确认）
        background: `#2B6F9C url('${CONTEXT_PATH}/html/images/login_background.jpg') center / cover no-repeat`,
        // 建立 BFC，防止卡片 margin-top 与容器发生外边距折叠
        overflow: 'hidden',
      }}
    >
      {/* 老页构图：容器 margin-left 60%，卡片在其内水平居中 */}
      <div style={{ marginLeft: '60%', marginTop: '10%' }}>
        <div
          style={{
            width: 345,
            boxSizing: 'border-box',
            padding: 29,
            background: 'rgb(255, 255, 255)',
            borderRadius: 5,
            position: 'relative',
            margin: '20px auto 20px',
          }}
        >
          <h1
            style={{
              fontFamily: 'Helvetica, Georgia, Arial, sans-serif, 黑体',
              fontSize: 36,
              fontWeight: 500,
              lineHeight: '43.2px',
              color: '#2B6F9C',
              margin: '0 0 16px',
            }}
          >
            {versionQuery.data?.productName ?? ''}
          </h1>

          {/* 固定高度错误位（2026-10-28 修复）：Alert 出现/替换/消失不推挤下方字段 */}
          <div style={{ minHeight: 40, marginBottom: 4 }}>
            {error ? (
              <Alert
                type="error"
                showIcon
                message={error}
                style={{ padding: '4px 12px', fontSize: 14 }}
              />
            ) : null}
          </div>

          <Form layout="vertical" requiredMark={false} onFinish={onFinish} autoComplete="on">
            <Form.Item
              label="工号"
              name="username"
              rules={[{ required: true, message: '请填写用户名.' }]}
            >
              <Input placeholder="请输入工号" autoFocus autoComplete="username" />
            </Form.Item>

            <Form.Item
              label="密码"
              name="password"
              rules={[{ required: true, message: '请填写密码.' }]}
            >
              <Input.Password placeholder="请输入密码" autoComplete="current-password" />
            </Form.Item>

            <Form.Item style={{ marginBottom: 16 }}>
              <Button type="primary" htmlType="submit" block loading={loading}>
                登录
              </Button>
            </Form.Item>
          </Form>
        </div>
      </div>
    </div>
  );
}
