import { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Avatar, Badge, Dropdown, Layout, Menu, Space, Tag, Typography } from 'antd';
import {
  ApiOutlined,
  BugOutlined,
  DashboardOutlined,
  LineChartOutlined,
  LogoutOutlined,
  TableOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '@/api/session';

const { Header, Sider, Content } = Layout;

/**
 * 应用外壳（菜单 + 顶栏 + 内容区）。
 *
 * ⚠️ 菜单数据目前是硬编码的 Demo 结构。
 *    真实实现要接后端菜单树，复用一个已经存在的方法：
 *      actRuTaskDao.getMenuListByUserCodeAndAssemblyLine(
 *          SmUserUtil.getUser().getUserCode(),
 *          SysConfig.getConfig("ASSEMBLY_LINE"))
 *    注意末尾那个 ASSEMBLY_LINE 参数 —— 菜单是【按业务线分叉】的
 *    （当前配置值 TRADITION），迁移时必须保证两条业务线都覆盖到。
 */
export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const selectedKey = location.pathname === '/' ? '/demo/customer' : location.pathname;

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed} theme="dark">
        <div
          style={{
            height: 56,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 600,
            letterSpacing: 1,
          }}
        >
          {collapsed ? 'MES' : 'MES 前端验证'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          onClick={({ key }) => navigate(key)}
          items={[
            {
              key: 'demo',
              icon: <TableOutlined />,
              label: '业务页验证',
              children: [
                { key: '/demo/customer', label: '客户查询（真接口）' },
                { key: '/demo/errors', label: '错误处理验证', icon: <BugOutlined /> },
              ],
            },
            {
              key: 'placeholder',
              icon: <DashboardOutlined />,
              label: '后续模块（占位）',
              children: [
                { key: '/placeholder/chart', label: '图表验证', icon: <LineChartOutlined /> },
                { key: '/placeholder/api', label: '接口封装说明', icon: <ApiOutlined /> },
              ],
            },
          ]}
        />
      </Sider>

      <Layout>
        <Header
          style={{
            background: '#fff',
            padding: '0 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #f0f0f0',
          }}
        >
          <Space>
            <Typography.Text strong>前后端分离验证工程</Typography.Text>
            <Tag color="blue">demoLst</Tag>
            <Tag color="orange">React 19 + AntD 6</Tag>
          </Space>

          <Dropdown
            menu={{
              items: [
                {
                  key: 'logout',
                  icon: <LogoutOutlined />,
                  label: '退出登录',
                  onClick: () => void logout(),
                },
              ],
            }}
          >
            <Space style={{ cursor: 'pointer' }}>
              <Badge dot color="green">
                <Avatar size="small" icon={<UserOutlined />} />
              </Badge>
              <Typography.Text>{user?.userName ?? user?.userCode ?? '未登录'}</Typography.Text>
            </Space>
          </Dropdown>
        </Header>

        <Content style={{ margin: 16 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
