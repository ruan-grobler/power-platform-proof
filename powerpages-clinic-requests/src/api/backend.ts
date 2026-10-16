import { createPowerPagesAuth } from '../auth/powerPagesAuth';
import { createMockBackend, type KeyValueStore } from './mockBackend';
import { createPowerPagesClient } from './powerPagesClient';
import { createPowerPagesRequestsApi } from './powerPagesRequests';
import type { Backend, BackendMode } from './types';

export interface HostInfo {
  hostname: string;
  /** True when Power Pages has added window.Microsoft.Dynamic365.Portal to the page. */
  hasPortalObject: boolean;
}

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]', '::1', '0.0.0.0']);

export const isLocalHost = (hostname: string): boolean =>
  LOCAL_HOSTNAMES.has(hostname) || hostname.endsWith('.localhost');

/**
 * Picks the data layer.
 * - VITE_DATA_ADAPTER=mock or powerpages forces one.
 * - Otherwise (auto): localhost always uses the mock. Any other host uses the
 *   Power Pages Web API only when Power Pages has injected its Portal object,
 *   so a static preview somewhere else still falls back to the mock.
 */
export const resolveBackendMode = (setting: string | undefined, host: HostInfo): BackendMode => {
  const choice = (setting ?? 'auto').trim().toLowerCase();
  if (choice === 'mock' || choice === 'powerpages') {
    return choice;
  }
  if (isLocalHost(host.hostname)) {
    return 'mock';
  }
  return host.hasPortalObject ? 'powerpages' : 'mock';
};

export const readHostInfo = (win: Window): HostInfo => ({
  hostname: win.location.hostname,
  hasPortalObject: Boolean(win.Microsoft?.Dynamic365?.Portal),
});

const browserStore = (getStore: () => Storage): KeyValueStore | null => {
  try {
    return getStore();
  } catch {
    return null;
  }
};

export const createBackend = (win: Window = window): Backend => {
  const mode = resolveBackendMode(import.meta.env.VITE_DATA_ADAPTER, readHostInfo(win));
  if (mode === 'mock') {
    return createMockBackend({
      storage: browserStore(() => win.localStorage),
      sessionStorage: browserStore(() => win.sessionStorage),
      latencyMs: 450,
    });
  }
  const client = createPowerPagesClient();
  return {
    mode,
    requests: createPowerPagesRequestsApi(client),
    auth: createPowerPagesAuth(client, win),
  };
};
