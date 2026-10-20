import { useState } from 'react';
import { Alert, Button, Card, Form, Input, Space, Typography, message } from 'antd';
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { ApiError } from '@/api/types';
import { resolveErrorMessage } from '@/api/query';
import { useAuthStore } from '@/api/session';

/**
 * 登录页。
 *
 * ★ 关键设计：直接复用老系统的 Shiro 表单登录，【零后端改动】
 *     POST /console/aspanse/login  (application/x-www-form-urlencoded)
 *     body: username=xxx&password=yyy
 *
 *   成功 → 302 到 ${adminPath}?login ；失败 → 302 回 ${adminPath}/login
 *   XHR 自动跟随 302，所以靠"落点是不是登录页"判断成败（见 session.ts）。
 *
 *   这样做的价值：Phase 0 不需要等后端新增 /api/v1/login 就能跑通完整链路，
 *   而且登录态与老 JSP 页面天然共享 —— 同一个 pw.session.id。
 *   等后端 JSON 版登录就绪后，只改 session.ts 的 login()，本页无需改动。
 */
export function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const login = useAuthStore((s) => s.login);

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true);
    setError(null);
    try {
      await login(values.username, values.password);
      message.success('登录成功');
      // 回到 / 由路由守卫接管
      window.location.replace('/');
    } catch (e) {
      setError(e instanceof ApiError ? resolveErrorMessage(e) : '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f0f2f5',
        padding: 16,
      }}
    >
      <Card style={{ width: 400 }} variant="outlined">
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <div style={{ textAlign: 'center' }}>
            <Typography.Title level={3} style={{ marginBottom: 4 }}>
              MES 前端验证
            </Typography.Title>
            <Typography.Text type="secondary">React 19 + Ant Design 6</Typography.Text>
          </div>

          {error ? <Alert type="error" showIcon message={error} /> : null}

          <Form layout="vertical" onFinish={onFinish} autoComplete="off" requiredMark={false}>
            <Form.Item
              name="username"
              label="工号"
              rules={[{ required: true, message: '请输入工号' }]}
            >
              <Input
                prefix={<UserOutlined />}
                placeholder="请输入工号"
                size="large"
                autoFocus
              />
            </Form.Item>

            <Form.Item
              name="password"
              label="密码"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="请输入密码" size="large" />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0 }}>
              <Button type="primary" htmlType="submit" block size="large" loading={loading}>
                登录
              </Button>
            </Form.Item>
          </Form>

          <Alert
            type="info"
            showIcon
            message="登录走老系统的 Shiro 表单登录"
            description={
              <Typography.Text style={{ fontSize: 12 }}>
                复用 <code>POST /console/aspanse/login</code>，与老 JSP 页面共享同一个{' '}
                <code>pw.session.id</code>，因此新老页面登录状态互通。
              </Typography.Text>
            }
          />
        </Space>
      </Card>
    </div>
  );
}
