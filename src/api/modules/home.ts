/**
 * 首页数据接口（后端 HomeApiController，已随 fanbianyi 恢复）。
 *
 * GET ${adminPath}/api/v1/home → RestResult<HomeData>
 * 一次请求拿当前用户 + 三级菜单树。
 */
import { get } from '@/api/request';
import { API_V1, CTX } from '@/api/config';

export interface MenuNode {
  id: string;
  name: string;
  nameEn?: string | null;
  nameTc?: string | null;
  /** 老 ad_menu.menu_url：相对路径需补 /console 前缀（规则见 toLegacyUrl） */
  url?: string | null;
  icon?: string | null;
  target?: string | null;
  orderNum?: number | null;
  permission?: string | null;
  remark?: string | null;
  level: number;
  children: MenuNode[];
}

export interface HomeData {
  userCode: string;
  userName?: string | null;
  rowId?: string | null;
  isAdmin: boolean;
  assemblyLine?: string | null;
  menuTree: MenuNode[];
}

export function getHome(): Promise<HomeData> {
  return get<HomeData>(`${API_V1}/home`);
}

/**
 * 老 menuUrl → 可打开的同源地址。
 *
 * 规则与老 menu.jsp:162 完全一致：
 *   funurl = (menuUrl 含 "://" ? 原样 : ${ctx} + menuUrl)
 * 其中 ${ctx} = contextPath + adminPath（taglib.jsp:11，unit 环境 = /console/aspanse）。
 * menu_url 数据本身【不含】adminPath（如 `/lot/define/...`），
 * 兼容带不带前导斜杠两种历史数据。
 *
 * ⚠️ 2026-10-21 修复：曾误拼为 /console + menuUrl（漏 adminPath），
 *   导致全部老页面 iframe 404——拼写依据以 taglib.jsp + Controller
 *   的 ${adminPath} 映射为准，不以路径直感猜测。
 */
export function toLegacyUrl(menuUrl: string): string {
  if (menuUrl.includes('://')) return menuUrl;
  return CTX + (menuUrl.startsWith('/') ? '' : '/') + menuUrl;
}
