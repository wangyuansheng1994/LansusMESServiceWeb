import { useMemo } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Alert, Avatar, Badge, Dropdown, Layout, Menu, Space, Spin, Tag, Typography } from 'antd';
import type { MenuProps } from 'antd';
import {
  ApiOutlined,
  AppstoreOutlined,
  BugOutlined,
  ExperimentOutlined,
  GlobalOutlined,
  LogoutOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '@/api/session';
import { getHome, type MenuNode } from '@/api/modules/home';
import { getBackendVersion, FRONTEND_API_CONTRACT_VERSION } from '@/api/modules/meta';

const { Header, Sider, Content } = Layout;

type MenuItem = Required<MenuProps>['items'][number];

/** MenuNode → antd Menu item；叶子 key = 菜单 id，点击时查表拿 url */
function toMenuItem(node: MenuNode): MenuItem {
  const hasChildren = (node.children?.length ?? 0) > 0;
  return {
    key: node.id,
    icon: node.level === 1 ? <AppstoreOutlined /> : undefined,
    label: node.name,
    children: hasChildren ? node.children.map(toMenuItem) : undefined,
  };
}

/** React 侧框架验证页（预览版保留，用真实 React 页与旧 JSP 页对照展示） */
const FRAME_ITEMS: MenuItem[] = [
  {
    key: 'frame-demo',
    icon: <ExperimentOutlined />,
    label: '框架验证（React 页）',
    children: [
      { key: '/demo/customer', label: '客户查询（真接口）' },
      { key: '/demo/errors', label: '错误处理验证', icon: <BugOutlined /> },
    ],
  },
];

/**
 * 应用外壳：左侧真实菜单树（/api/v1/home）+ 顶栏（版本契约）+ 内容区。
 *
 * ★ 菜单数据来自后端 HomeApiController（MenuDao.findALL/findByUserId），
 *   与老 menu.jsp 同源 —— 老系统能看到的菜单这里原样出现（含 7201 排除规则）。
 * ★ 叶子菜单点击 → /legacy?src=… 由 LegacyPage 用同源 iframe 打开老 JSP
 *   （共享 pw.session.id，老页面零改动）。
 */
export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const homeQuery = useQuery({
    queryKey: ['home'],
    queryFn: getHome,
    staleTime: 10 * 60_000,
    retry: 1,
  });

  const versionQuery = useQuery({
    queryKey: ['meta-version'],
    queryFn: getBackendVersion,
    staleTime: 10 * 60_000,
    retry: 1,
  });

  const contractMismatch =
    versionQuery.data !== undefined &&
    versionQuery.data.apiContractVersion !== FRONTEND_API_CONTRACT_VERSION;

  // id → MenuNode 查表（点击叶子时拿 url）
  const nodeIndex = useMemo(() => {
    const map = new Map<string, MenuNode>();
    const walk = (nodes: MenuNode[]) => {
      nodes.forEach((n) => {
        map.set(n.id, n);
        if (n.children?.length) walk(n.children);
      });
    };
    walk(homeQuery.data?.menuTree ?? []);
    return map;
  }, [homeQuery.data]);

  const menuItems = useMemo<MenuItem[]>(() => {
    if (!homeQuery.data?.menuTree?.length) return FRAME_ITEMS;
    return [...homeQuery.data.menuTree.map(toMenuItem), ...FRAME_ITEMS];
  }, [homeQuery.data]);

  const onMenuClick: MenuProps['onClick'] = ({ key }) => {
    // React 验证页：key 即路由
    if (key.startsWith('/demo') || key.startsWith('/placeholder')) {
      navigate(key);
      return;
    }
    const node = nodeIndex.get(key);
    if (!node || (node.children?.length ?? 0) > 0) return; // 分组节点不开页
    if (!node.url) return;
    // 老页面 → LegacyPage（同源 iframe，深链接可还原）
    navigate(
      `/legacy?src=${encodeURIComponent(node.url)}&name=${encodeURIComponent(node.name)}`,
    );
  };

  const menu = homeQuery.isLoading ? (
    <div style={{ padding: 24, textAlign: 'center' }}>
      <Spin size="large" tip="正在加载菜单…" />
    </div>
  ) : homeQuery.isError ? (
    <div style={{ padding: 16 }}>
      <Alert
        type="error"
        showIcon
        message="菜单加载失败"
        description="无法连接后端 /aspanse/api/v1/home，请确认本地 Tomcat 已启动。"
        action={
          <a onClick={() => void homeQuery.refetch()} style={{ fontSize: 12 }}>
            重试
          </a>
        }
      />
    </div>
  ) : (
    <Menu
      theme="dark"
      mode="inline"
      selectedKeys={[location.pathname]}
      onClick={onMenuClick}
      items={menuItems}
    />
  );

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible theme="dark" width={220}>
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
          Lansus MES
        </div>
        {menu}
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
            <Typography.Text strong>前后端分离 · 本地框架预览版</Typography.Text>
            <Tag color="blue">React 19 + AntD 6</Tag>
            {versionQuery.data ? (
              <>
                <Tag icon={<ApiOutlined />} color="geekblue">
                  后端 {versionQuery.data.backendVersion}
                </Tag>
                {contractMismatch ? (
                  <Tag color="red">契约不匹配：前端 {FRONTEND_API_CONTRACT_VERSION} / 后端 {versionQuery.data.apiContractVersion}</Tag>
                ) : (
                  <Tag color="green">契约 v{FRONTEND_API_CONTRACT_VERSION}</Tag>
                )}
              </>
            ) : (
              <Tag icon={<GlobalOutlined />} color="default">
                版本检测中…
              </Tag>
            )}
            {homeQuery.data?.assemblyLine ? (
              <Tag color="orange">业务线 {homeQuery.data.assemblyLine}</Tag>
            ) : null}
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
          {contractMismatch ? (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 12 }}
              message="前后端版本契约不匹配"
              description={`前端 apiContractVersion=${FRONTEND_API_CONTRACT_VERSION}，后端=${versionQuery.data?.apiContractVersion}。正式版将阻止进入业务页面，预览版仅提示。`}
            />
          ) : null}
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
