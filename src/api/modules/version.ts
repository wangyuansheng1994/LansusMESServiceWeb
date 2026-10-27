export interface BackendVersionMetadata {
  backendVersion: string;
  backendCommit: string;
  apiContractVersion: string;
}

export interface FrontendVersionIdentity {
  frontendCommit: string;
  sourceDiffHash: string;
}

export function compareVersions(left: string, right: string): number {
  const parse = (value: string) => {
    const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value);
    if (!match) throw new Error(`Invalid numeric three-part version: ${value}`);
    return match.slice(1).map(Number);
  };
  const a = parse(left);
  const b = parse(right);
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] > b[index] ? 1 : -1;
  }
  return 0;
}

export function getVersionIncompatibility(
  frontendContract: string,
  minBackendVersion: string,
  backend: BackendVersionMetadata,
): string | null {
  if (backend.apiContractVersion !== frontendContract) {
    return `前端契约 ${frontendContract} 与后端契约 ${backend.apiContractVersion} 不一致`;
  }
  try {
    if (compareVersions(backend.backendVersion, minBackendVersion) < 0) {
      return `后端版本 ${backend.backendVersion} 低于最低要求 ${minBackendVersion}`;
    }
  } catch {
    return `后端版本格式无效：${backend.backendVersion}，要求数字三段版本`;
  }
  if (typeof backend.backendCommit !== 'string' || !backend.backendCommit.trim()) {
    return '后端提交标识缺失，无法追溯发布包';
  }
  if (backend.backendCommit.trim().toLowerCase() === 'unknown') {
    return '后端提交为 unknown，无法追溯发布包';
  }
  return null;
}

export function hasFrontendVersionChanged(
  current: FrontendVersionIdentity,
  latest: FrontendVersionIdentity,
): boolean {
  return (
    current.frontendCommit !== latest.frontendCommit ||
    current.sourceDiffHash !== latest.sourceDiffHash
  );
}
