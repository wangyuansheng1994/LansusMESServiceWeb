import { Alert, Card, Descriptions, Space, Tag, Typography } from 'antd';
import { ADAPTERS_DOC } from '@/api/adaptersDoc';

/**
 * 接口封装说明页 —— 把关键契约放到界面上，
 * 避免后人接手时改坏那三条铁律。
 */
export function ApiDocPage() {
  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Alert
        type="info"
        showIcon
        message="这个后端有 4 种响应信封，全部由适配器注册表归一化"
        description="全部来自对真实代码的排查，不是推测。遇到第 5 种时只需加一个适配器 + 一行注册，调用层零改动。"
      />

      {ADAPTERS_DOC.map((a) => (
        <Card
          key={a.name}
          size="small"
          title={
            <Space>
              <Tag color="blue">{a.priority}</Tag>
              {a.name}
            </Space>
          }
        >
          <Descriptions size="small" column={1} bordered>
            <Descriptions.Item label="识别条件">
              <Typography.Text code>{a.test}</Typography.Text>
            </Descriptions.Item>
            <Descriptions.Item label="真实来源">
              <Typography.Text code style={{ fontSize: 12 }}>
                {a.source}
              </Typography.Text>
            </Descriptions.Item>
            <Descriptions.Item label="归一化">
              <Typography.Text style={{ fontSize: 12 }}>{a.normalize}</Typography.Text>
            </Descriptions.Item>
          </Descriptions>
        </Card>
      ))}

      <Card size="small" title="三条必须记住的契约（改坏就是线上事故）">
        <Descriptions size="small" column={1} bordered>
          <Descriptions.Item label="X-Requested-With">
            必须带。后端 <code>Servlets.isAjaxRequest</code> 依赖它决定 500 时输出纯文本还是渲染
            HTML 页面。老前端靠 jQuery <code>$.ajax</code> 的默认行为无意间满足了这个条件。
          </Descriptions.Item>
          <Descriptions.Item label="baseURL 必须同源">
            只能走 Vite proxy / Nginx 反代。改成跨域绝对地址 → Shiro 1.2.6 不写 SameSite → 浏览器按
            Lax 处理 → <code>pw.session.id</code> 静默不发送。
          </Descriptions.Item>
          <Descriptions.Item label="withCredentials: true">
            携带 <code>pw.session.id</code>。漏了就是"登录成功但每个请求都未登录"。
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card size="small" title="为什么保留 session 而不是换 token">
        <Typography.Paragraph>
          认证与权限解析在 <code>SystemAuthorizingRealm</code> 里，而它
          <strong>不在工作区源码中</strong>： 全仓库搜不到该 .java 文件，只在{' '}
          <code>spring-context-shiro.xml:100</code> 被引用， sources jar 是 1
          KB（空）。安全层实现读不到、改不动，换 token 必然形成两套认证并行。
        </Typography.Paragraph>
        <Typography.Paragraph style={{ marginBottom: 0 }}>
          同源反代下 cookie 自动携带、自动过期、自动跨标签页共享，session 本身就是更安全的 token
          （HttpOnly 防 XSS）。真正要补的是心跳保活、可见性联动、草稿保护 —— 见{' '}
          <code>src/api/session.ts</code>。
        </Typography.Paragraph>
      </Card>
    </Space>
  );
}
