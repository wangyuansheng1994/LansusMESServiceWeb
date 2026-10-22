/**
 * 浏览器本地存储统一入口（方案 v3.1 §7.3）。
 *
 * 纪律：
 *  - localStorage 一律走这里：key 自动加 `mes:` 前缀 + 版本号，便于将来整体失效/迁移；
 *  - 只放非敏感偏好（主题、语言、表格列宽/显隐、标签页布局、表单草稿）；
 *    任何 token、密码、敏感业务数据【禁止】进 localStorage（XSS 可窃取）；
 *  - 隐私模式/禁用场景下 storage 不可写，所有方法静默降级不抛错。
 *
 * 用法：
 *   const theme = storageLocal.get<'light' | 'dark'>('ui.theme', 'light');
 *   storageLocal.set('ui.theme', 'dark');
 */
export const STORAGE_PREFIX = 'mes:';
export const STORAGE_VERSION = 'v1';

function buildKey(key: string): string {
  return `${STORAGE_PREFIX}${STORAGE_VERSION}:${key}`;
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

interface StorageApi {
  get<T>(key: string, fallback: T): T;
  set(key: string, value: unknown): void;
  remove(key: string): void;
}

function wrap(store: Storage): StorageApi {
  return {
    get<T>(key: string, fallback: T): T {
      try {
        return safeParse(store.getItem(buildKey(key)), fallback);
      } catch {
        return fallback;
      }
    },
    set(key: string, value: unknown): void {
      try {
        store.setItem(buildKey(key), JSON.stringify(value));
      } catch {
        /* 存储不可写（隐私模式/配额满）：静默降级 */
      }
    },
    remove(key: string): void {
      try {
        store.removeItem(buildKey(key));
      } catch {
        /* 同上 */
      }
    },
  };
}

/** 长期偏好（主题/语言/列宽等） */
export const storageLocal: StorageApi = wrap(window.localStorage);
/** 会话级状态（标签页布局等，关标签即失效） */
export const storageSession: StorageApi = wrap(window.sessionStorage);
