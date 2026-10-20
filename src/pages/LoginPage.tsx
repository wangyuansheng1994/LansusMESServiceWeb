import { useState } from 'react';
import { Alert, App, Button, Card, Form, Input, Space, Typography } from 'antd';
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { ApiError } from '@/api/types';
import { resolveErrorMessage } from '@/api/query';
import { useAuthStore } from '@/api/session';

/**
 * 登录页（framework-preview：走后端 JSON 登录接口）。
 *
 * ★ POST /console/aspanse/api/v1/auth/login（AuthApiController）
 *   后端复刻 MobileMainController 的程序化登录先例：
 *   查库比对 MD5(loginName+password) 后，用 "SSO" 哨兵口令走既有
 *   SystemAuthorizingRealm 建立 Shiro Session —— 认证仍是唯一一套，
 *   登录态与老 JSP 页面共享同一个 pw.session.id。
 *
 *   失败文案来自后端 RestResult.msg（与老页面逐字一致），
 *   由适配器解包成 ApiError(business) 在这里展示。
 */
export function LoginPage() {
  const { message } = App.useApp();
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
        background: 'linear-gradient(135deg, #f5f7fa 0%, #e4e9f2 100%)',
        padding: 16,
      }}
    >
      <Card style={{ width: 400 }} variant="outlined">
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <div style={{ textAlign: 'center' }}>
            <Typography.Title level={3} style={{ marginBottom: 4 }}>
              Lansus MES
            </Typography.Title>
            <Typography.Text type="secondary">
              前后端分离 · 本地框架预览版
            </Typography.Text>
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
            message="登录通道"
            description={
              <Typography.Text style={{ fontSize: 12 }}>
                复用 <code>POST /console/aspanse/api/v1/auth/login</code>，登录成功即建立
                Shiro 会话（<code>pw.session.id</code>），与老 JSP 页面登录状态互通。
              </Typography.Text>
            }
          />
        </Space>
      </Card>
    </div>
  );
}
