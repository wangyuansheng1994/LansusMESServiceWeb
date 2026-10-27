import { useEffect } from 'react';
import { App } from 'antd';
import { useLocation } from 'react-router-dom';
import { APP_BASE } from '@/api/config';
import { hasFrontendVersionChanged, type FrontendVersionIdentity } from '@/api/modules/version';

const VERSION_URL = `${APP_BASE}version.json`;
const promptedVersions = new Set<string>();
let baseline: FrontendVersionIdentity | null = null;

async function fetchVersion(): Promise<FrontendVersionIdentity> {
  const response = await fetch(VERSION_URL, {
    cache: 'no-cache',
    credentials: 'same-origin',
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
  });
  if (!response.ok) throw new Error(`version.json HTTP ${response.status}`);
  const body: unknown = await response.json();
  if (
    typeof body !== 'object' ||
    body === null ||
    !('frontendCommit' in body) ||
    typeof body.frontendCommit !== 'string' ||
    !('sourceDiffHash' in body) ||
    typeof body.sourceDiffHash !== 'string'
  ) {
    throw new Error('version.json is missing frontendCommit/sourceDiffHash');
  }
  return { frontendCommit: body.frontendCommit, sourceDiffHash: body.sourceDiffHash };
}

export function VersionWatcher() {
  const location = useLocation();
  const { modal } = App.useApp();

  useEffect(() => {
    let disposed = false;

    const check = async () => {
      try {
        baseline ??= await fetchVersion();
        const latest = await fetchVersion();
        const signature = `${latest.frontendCommit}:${latest.sourceDiffHash}`;
        if (
          disposed ||
          !hasFrontendVersionChanged(baseline, latest) ||
          promptedVersions.has(signature)
        ) {
          return;
        }
        promptedVersions.add(signature);
        modal.confirm({
          title: '发现新版本',
          content: '系统已有新的前端版本。为避免新旧资源混用，请刷新页面后继续。',
          okText: '刷新页面',
          cancelText: '稍后',
          onOk: () => window.location.reload(),
        });
      } catch (error) {
        if (!disposed) console.warn('version.json 检查失败', error);
      }
    };

    void check();
    const timer = window.setInterval(() => void check(), 5 * 60_000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [location.key, modal]);

  return null;
}
