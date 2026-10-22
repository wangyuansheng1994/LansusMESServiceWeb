import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Layout, Modal, Result } from 'antd';
import { useAuthStore } from '@/api/session';
import { getHome, toLegacyUrl, type MenuNode } from '@/api/modules/home';
import { getBackendVersion, FRONTEND_API_CONTRACT_VERSION } from '@/api/modules/meta';
import { HOME_TAB_KEY, useTabStore } from '@/stores/tabStore';
import { matchPageDef } from '@/routes/pageRegistry';
import { AppHeader } from '@/layouts/AppHeader';
import { AppSiderMenu } from '@/layouts/AppSiderMenu';
import { AppTabsBar } from '@/layouts/AppTabsBar';

const { Content } = Layout;

/**
 * 应用外壳 v1（范围写死，防蔓延 —— 对位老壳六项：菜单树、多标签页、
 * 首页待办、用户区、通知角标、侧栏折叠；通知角标老壳已注释，v1 不做；
 * 顶栏四项（logo/菜单搜索/升级历史/全屏）经负责人 2026-10-21 确认还原）。
 *
 * 结构（三个展示子组件，本文件只持有状态与数据）：
 *   AppHeader     顶栏（logo/折叠/菜单搜索/升级历史/全屏/用户区）
 *   AppSiderMenu  侧栏菜单（加载态/失败态/树/搜索过滤/搜索自动展开）
 *   AppTabsBar    多标签条（卡片式可关闭 + 右键菜单）
 *
 * ★ 菜单数据来自后端 HomeApiController（MenuDao.findALL/findByUserId），
 *   与老 menu.jsp 同源 —— 老系统能看到的菜单这里原样出现（含 7201 排除规则）。
 * ★ 多标签：叶子菜单点击 → tabStore 开标签 → /legacy?src=… 由 LegacyPage
 *   用同源 iframe 打开老 JSP（共享 pw.session.id，老页面零改动）；
 *   所有标签常驻 DOM、display:none 切换，iframe 保留不重载
 *   （对齐老壳 jerichoTab loadOnce:true）；上限 10 个 + LRU 淘汰。
 * ★ 布局约束：侧栏与内容列都钉死在视口内各自内部滚动，
 *   页面整体高度不随菜单层级/内容长度变化。
 */
export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const tabs = useTabStore((s) => s.tabs);
  const activeKey = useTabStore((s) => s.activeKey);
  const openTab = useTabStore((s) => s.openTab);
  const closeTab = useTabStore((s) => s.closeTab);
  const closeOthers = useTabStore((s) => s.closeOthers);
  const closeAll = useTabStore((s) => s.closeAll);

  // 顶栏/侧栏状态：菜单搜索关键字、折叠、升级历史弹窗、全屏
  const [menuKeyword, setMenuKeyword] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen();
  };

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

  /**
   * 版本契约（方案 v3.1 §4.7）：
   *  - meta/version 可用且 apiContractVersion 不一致 → 阻断进入业务页面
   *  - meta/version 未实现/网络异常 → 降级：不阻断，后端补回端点后阻断自动生效
   * 该检查不占用顶栏视觉（老壳无此类元素），只在不匹配时整屏提示。
   */
  const contractMismatch =
    versionQuery.data !== undefined &&
    versionQuery.data.apiContractVersion !== FRONTEND_API_CONTRACT_VERSION;

  // 路由 → 标签同步：进入已登记页面即开标签（已存在则激活）
  useEffect(() => {
    const def = matchPageDef(location.pathname);
    if (!def) return;
    openTab({
      key: location.pathname + location.search,
      title: def.title(new URLSearchParams(location.search)),
    });
  }, [location, openTab]);

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

  // 当前活动标签 → 菜单高亮：/legacy 标签的 src 里带着 MenuID（onMenuClick 时附加），
  // 解析出来喂给菜单 selectedKeys；React 页/首页无对应菜单项，不高亮
  const activeMenuId = useMemo(() => {
    const [pathname, query = ''] = activeKey.split('?');
    if (pathname !== '/legacy' || !query) return undefined;
    const src = new URLSearchParams(query).get('src');
    if (!src) return undefined;
    const qIdx = src.indexOf('?');
    if (qIdx < 0) return undefined;
    return new URLSearchParams(src.slice(qIdx + 1)).get('MenuID') ?? undefined;
  }, [activeKey]);

  const onMenuClick = (key: string) => {
    // React 验证页：key 即路由
    if (key.startsWith('/demo') || key.startsWith('/placeholder')) {
      navigate(key);
      return;
    }
    const node = nodeIndex.get(key);
    if (!node || (node.children?.length ?? 0) > 0) return; // 分组节点不开页
    if (!node.url) return;
    // 老壳 URL 契约（menu.jsp:79-84）：打开页面时 URL 追加 SessionID=user.rowId & MenuID=菜单id，
    // 老页面有按这两个参数做数据/权限过滤的，漏带会导致与老壳行为不一致
    const sep = node.url.includes('?') ? '&' : '?';
    const legacySrc = `${node.url}${sep}SessionID=${encodeURIComponent(
      homeQuery.data?.rowId ?? '',
    )}&MenuID=${encodeURIComponent(node.id)}`;
    // 老页面 → 开标签：/legacy?src=…（同源 iframe，深链接可还原）
    navigate(`/legacy?src=${encodeURIComponent(legacySrc)}&name=${encodeURIComponent(node.name)}`);
  };

  const handleCloseTab = (key: string) => {
    const wasActive = key === activeKey;
    closeTab(key);
    if (wasActive) navigate(useTabStore.getState().activeKey);
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <AppHeader
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(!collapsed)}
        menuKeyword={menuKeyword}
        onMenuKeywordChange={setMenuKeyword}
        onOpenHistory={() => setHistoryOpen(true)}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
        userName={homeQuery.data?.userName ?? user?.userName ?? user?.userCode ?? '未登录'}
        onLogout={() => void logout()}
      />

      <Layout>
        <AppSiderMenu
          collapsed={collapsed}
          onCollapse={setCollapsed}
          loading={homeQuery.isLoading}
          error={homeQuery.isError}
          onRetry={() => void homeQuery.refetch()}
          menuTree={homeQuery.data?.menuTree}
          keyword={menuKeyword}
          selectedMenuId={activeMenuId}
          onMenuClick={onMenuClick}
        />
        {/* 内容列钉死在视口内：标签条固定，内容区内部滚动 */}
        <Layout style={{ height: 'calc(100vh - 80px)' }}>
          {contractMismatch ? (
            <Content style={{ margin: 16, overflow: 'auto' }}>
              <Result
                status="warning"
                title="前后端版本契约不匹配"
                subTitle={`前端 apiContractVersion=${FRONTEND_API_CONTRACT_VERSION}，后端=${versionQuery.data?.apiContractVersion}。为避免新旧版本错配造成数据问题，已阻止进入业务页面，请联系管理员（方案 v3.1 §4.7）。`}
              />
            </Content>
          ) : (
            <>
              <AppTabsBar
                tabs={tabs}
                activeKey={activeKey}
                onNavigate={(key) => navigate(key)}
                onCloseTab={handleCloseTab}
                onCloseOthers={(key) => {
                  closeOthers(key);
                  navigate(key);
                }}
                onCloseAll={() => {
                  closeAll();
                  navigate(HOME_TAB_KEY);
                }}
              />
              <Content style={{ margin: 12, flex: 1, minHeight: 0, overflow: 'auto' }}>
                {/* keep-alive：所有标签常驻 DOM，display:none 切换 ——
                    iframe 标签保留不重载（对齐老壳 jerichoTab loadOnce:true） */}
                {tabs.map((t) => {
                  const [pathname, query = ''] = t.key.split('?');
                  const def = matchPageDef(pathname);
                  if (!def) return null;
                  return (
                    <div
                      key={t.key}
                      style={{ display: t.key === activeKey ? 'block' : 'none', height: '100%' }}
                    >
                      {def.render(new URLSearchParams(query), t.key)}
                    </div>
                  );
                })}
              </Content>
            </>
          )}
        </Layout>
      </Layout>

      {/* 系统升级历史（老壳 modal 复刻：iframe 嵌 /main/main/showDetailed，后端零改动） */}
      <Modal
        title="系统升级历史"
        open={historyOpen}
        onCancel={() => setHistoryOpen(false)}
        footer={null}
        width={900}
      >
        <iframe
          title="系统升级历史"
          src={toLegacyUrl('/main/main/showDetailed')}
          style={{ width: '100%', height: '60vh', border: 0 }}
        />
      </Modal>
    </Layout>
  );
}
