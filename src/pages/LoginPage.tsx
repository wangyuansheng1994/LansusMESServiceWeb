import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/api/session';
import { getBackendVersion } from '@/api/modules/meta';
import { CONTEXT_PATH } from '@/api/config';

/**
 * 登录页 —— 对照老页 WEB-INF/views/login/index.jsp 的【实测计算样式】逐项复刻
 * （用浏览器 getComputedStyle 从运行中的老页面提取，非源码推断）：
 *
 *   容器      #login：margin-left 60% / margin-top 10%（均按视口宽解析）
 *   表单      345px、padding 29px、白底、圆角 5px、relative、text-align:left
 *   标题      h1：36px / 行高 43.2px / 字重 500 / #2B6F9C / Helvetica…黑体，
 *             内容宽 287px 下 8 字标题自然折两行（不设 nowrap）
 *   标签      17px / 行高 25.5px / 上下 margin 8px / 颜色 #505D69
 *   输入框    width 93%、height 30px（content-box）、padding 10-5-10-15、
 *             边框 1px #b2b2b2、圆角 3px、内阴影 inset 0 1px 3px rgba(168,168,168,.6)、
 *             margin-top 6px；密码框无眼睛切换（老页就是裸 input[type=password]）
 *   按钮      老页规则 #loginForm input:not([type=checkbox]) 同样命中提交按钮：
 *             93% 宽、同边框/内阴影、背景 #2B6F9C、白字 24px 微软雅黑、
 *             行高 36px、margin-top 25px；渲染总尺寸 289×52
 *   背景      /console/html/images/login_background.jpg（同源老静态资源）；
 *             2026-10-21 经负责人确认改为容器 CSS 背景 cover 始终铺满
 *             （老页 img width:100% 窄窗口偏短），见下方实现处注释
 *
 * 登录通道：POST /console/aspanse/api/v1/auth/login（AuthApiController，
 * 复刻 MobileMainController 程序化登录先例），成功即建立同一套 Shiro Session。
 * 老页本无可见错误区（jQuery validate 落在空容器），失败提示为最小红色文字，
 * 文案取后端 RestResult.msg 原文。
 */
export function LoginPage() {
  const [searchParams] = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const login = useAuthStore((s) => s.login);

  const versionQuery = useQuery({
    queryKey: ['meta-version'],
    queryFn: getBackendVersion,
    staleTime: 10 * 60_000,
    retry: 1,
  });

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!username) return setError('请填写用户名.');
    if (!password) return setError('请填写密码.');
    setLoading(true);
    try {
      await login(username, password);
      // 老页无成功提示，登录成功直接进入系统；
      // 深链接回跳：消费 session.ts/RequireAuth 记下的 ?redirect=（仅放行站内相对路径，防开放重定向）
      const redirect = searchParams.get('redirect');
      const safeTarget =
        redirect && redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : '/';
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
        // 老页同款背景图。老页用 <img width:100%>（窄窗口背景偏短），
        // 经负责人 2026-10-21 确认改为容器 CSS 背景 cover 始终铺满
        // （等比裁切不变形）——与老页观感的有意偏差，登记在此
        background: `#2B6F9C url('${CONTEXT_PATH}/html/images/login_background.jpg') center / cover no-repeat`,
        // 建立 BFC，防止表单 margin-top:10% 与容器发生外边距折叠、在顶部露出一条 body 底色
        overflow: 'hidden',
      }}
    >
      <style>{`
        .legacy-login-input {
          display: block;
          width: 93%;
          height: 30px;
          box-sizing: content-box;
          padding: 10px 5px 10px 15px;
          border: 1px solid rgb(178, 178, 178);
          border-radius: 3px;
          box-shadow: 0 1px 3px 0 rgba(168, 168, 168, 0.6) inset;
          transition: all 0.2s linear;
          font-size: 14px;
          font-family: 'Nunito', sans-serif;
          color: #000;
          margin: 6px 0 0;
          outline: none;
        }
        .legacy-login-input:focus {
          border-color: #2b6f9c;
          box-shadow: 0 0 3px 1px rgba(43, 111, 156, 0.35) inset;
        }
      `}</style>

      {/* 老页 #login { margin-left: 60%; margin-top: 10% } */}
      <div style={{ marginLeft: '60%', marginTop: '10%' }}>
        <form
          onSubmit={onSubmit}
          style={{
            width: 345,
            boxSizing: 'border-box',
            padding: 29,
            background: 'rgb(255, 255, 255)',
            borderRadius: 5,
            position: 'relative',
            textAlign: 'left',
            margin: '20px auto 20px',
            fontFamily: "'Nunito', sans-serif",
            color: 'rgb(80, 93, 105)',
            fontSize: 14.4,
          }}
        >
          <h1
            style={{
              fontFamily: 'Helvetica, Georgia, Arial, sans-serif, 黑体',
              fontSize: 36,
              fontWeight: 500,
              lineHeight: '43.2px',
              color: '#2B6F9C',
              margin: '0 0 35px',
            }}
          >
            {versionQuery.data?.productName ?? ''}
          </h1>

          {error ? (
            <div style={{ color: '#d9534f', fontSize: 14, margin: '0 0 12px' }}>{error}</div>
          ) : null}

          <label
            htmlFor="username"
            style={{ display: 'inline-block', fontSize: 17, lineHeight: '25.5px', margin: '8px 0' }}
          >
            工号
          </label>
          <input
            id="username"
            name="username"
            className="legacy-login-input"
            type="text"
            autoComplete="username"
            placeholder="请输入工号"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
          />

          <label
            htmlFor="password"
            style={{ display: 'inline-block', fontSize: 17, lineHeight: '25.5px', margin: '8px 0' }}
          >
            密码
          </label>
          <input
            id="password"
            name="password"
            className="legacy-login-input"
            type="password"
            autoComplete="current-password"
            placeholder="请输入密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {/* 老页：密码框与按钮之间隔两个空 <p>，实测净距 41px，按钮自身 margin-top 25px */}
          <button
            type="submit"
            disabled={loading}
            className="legacy-login-input"
            style={{
              background: '#2B6F9C',
              color: '#fff',
              fontSize: 24,
              fontFamily: '微软雅黑',
              lineHeight: '36px',
              textAlign: 'center',
              /* 老页密码框→按钮净距 41px（空 <p> 16 + 按钮 margin-top 25，
                 老页靠 <p> 包裹避免 margin 塌陷；这里直接合成 marginTop），
                 按钮下再补 16px 空段距 → 表单总高与老页 487px 一致 */
              marginTop: 41,
              marginBottom: 16,
              cursor: loading ? 'default' : 'pointer',
              opacity: loading ? 0.65 : 1,
            }}
          >
            登录
          </button>
        </form>
      </div>
    </div>
  );
}
