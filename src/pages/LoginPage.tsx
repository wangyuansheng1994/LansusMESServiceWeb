import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, App, Button, Form, Input } from 'antd';
import { ApiError } from '@/api/types';
import { resolveErrorMessage } from '@/api/query';
import { useAuthStore } from '@/api/session';
import { getBackendVersion } from '@/api/modules/meta';

/**
 * 登录页 —— 视觉与文案对照老页 WEB-INF/views/login/index.jsp 逐项移植：
 *
 *   全屏背景图 /console/html/images/login_background.jpg（老系统静态资源，同源直引）
 *   表单右置（左 60%、上 10%）、345px 白卡片、5px 圆角、29px 内边距
 *   标题 = 后端配置 productName（老页 ${pw:getConfig('productName')} 同源，
 *          经 /api/v1/meta/version 透出，不写死）
 *   标题 36px 蓝字 #2B6F9C、标签 17px、全宽大按钮
 *   必填文案逐字照搬："请填写用户名." / "请填写密码."
 *
 * ★ 登录走 POST /console/aspanse/api/v1/auth/login（AuthApiController），
 *   复刻 MobileMainController 的程序化登录先例（"SSO" 哨兵 +
 *   SystemAuthorizingRealm），成功即建立同一套 Shiro Session，
 *   与老 JSP 页面共享 pw.session.id。失败文案来自后端 RestResult.msg。
 */
export function LoginPage() {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const login = useAuthStore((s) => s.login);

  const versionQuery = useQuery({
    queryKey: ['meta-version'],
    queryFn: getBackendVersion,
    staleTime: 10 * 60_000,
    retry: 1,
  });

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
    <div style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden' }}>
      {/* 老页同款背景图：position:absolute / left:0 / top:0 / bottom:0 / width:100% */}
      <img
        src="/console/html/images/login_background.jpg"
        alt=""
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: -1,
          width: '100%',
          border: 0,
        }}
      />

      {/* 老页：#login { margin-left: 60%; margin-top: 10% } */}
      <div style={{ marginLeft: '60%', marginTop: '10%', width: 345 }}>
        <div
          style={{
            width: 345,
            padding: 29,
            background: '#fff',
            borderRadius: 5,
            textAlign: 'left',
          }}
        >
          {/* 老页 h1.form-signin-heading：36px / #2B6F9C，值为配置 productName */}
          <h1
            style={{
              fontSize: 36,
              color: '#2B6F9C',
              fontFamily: 'Helvetica, Georgia, Arial, sans-serif, 黑体',
              margin: 0,
              marginBottom: 35,
              whiteSpace: 'nowrap',
            }}
          >
            {versionQuery.data?.productName ?? ''}
          </h1>

          {/* 老页 #messageBox 错误区的等价物 */}
          {error ? <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} /> : null}

          <Form layout="vertical" onFinish={onFinish} autoComplete="off" requiredMark={false}>
            <Form.Item
              name="username"
              label="工号"
              validateTrigger="onSubmit"
              rules={[{ required: true, message: '请填写用户名.' }]}
              style={{ marginBottom: 8 }}
            >
              <Input
                id="username"
                name="username"
                placeholder="请输入工号"
                size="large"
                autoFocus
              />
            </Form.Item>

            <Form.Item
              name="password"
              label="密码"
              validateTrigger="onSubmit"
              rules={[{ required: true, message: '请填写密码.' }]}
              style={{ marginBottom: 24 }}
            >
              <Input.Password id="password" name="password" placeholder="请输入密码" size="large" />
            </Form.Item>

            <Button
              type="primary"
              htmlType="submit"
              block
              size="large"
              loading={loading}
              style={{ height: 48, fontSize: 24, background: '#2B6F9C' }}
            >
              登录
            </Button>
          </Form>
        </div>
      </div>
    </div>
  );
}
