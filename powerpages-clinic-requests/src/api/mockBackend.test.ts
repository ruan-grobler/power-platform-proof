import { describe, expect, it } from 'vitest';
import type { NormalisedAppointmentRequest, PortalUser } from '../domain/types';
import { resolveBackendMode } from './backend';
import { DEMO_USER, createMockBackend, type KeyValueStore } from './mockBackend';

const NOW = new Date('2026-10-16T08:00:00.000Z');

const REQUEST: NormalisedAppointmentRequest = {
  fullName: 'Demo Patient',
  phone: '+27825550134',
  email: 'demo.patient@example.com',
  preferredDate: '2026-10-22',
  timeWindow: 'morning',
  reason: 'Repeat prescription for asthma pump.',
  popiaConsent: true,
};

const memoryStore = (): KeyValueStore & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string): string | null => data.get(key) ?? null,
    setItem: (key: string, value: string): void => {
      data.set(key, value);
    },
    removeItem: (key: string): void => {
      data.delete(key);
    },
  };
};

describe('mock backend requests', () => {
  it('seeds one request in each status for the demo user, newest first', async () => {
    const backend = createMockBackend({ now: () => NOW });
    const items = await backend.requests.listMyRequests(DEMO_USER);
    expect(items.map((item) => item.status)).toEqual(['New', 'Confirmed', 'Declined']);
  });

  it('never seeds a preferred date on a Sunday, when the clinic is closed', async () => {
    for (let day = 0; day < 7; day += 1) {
      const backend = createMockBackend({ now: () => new Date(Date.UTC(2026, 9, 12 + day, 8)) });
      const items = await backend.requests.listMyRequests(DEMO_USER);
      for (const item of items) {
        expect(new Date(`${item.preferredDate}T00:00:00Z`).getUTCDay()).not.toBe(0);
      }
    }
  });

  it('adds a signed-in submission to the top of My requests with status New', async () => {
    const backend = createMockBackend({ now: () => NOW, newId: () => 'e1e2e3e4-0000-4000-8000-000000000001' });
    const saved = await backend.requests.submitRequest(REQUEST, DEMO_USER);
    const items = await backend.requests.listMyRequests(DEMO_USER);

    expect(saved.reference).toBe('CR-E1E2E3E4');
    expect(items[0]).toMatchObject({ id: saved.id, status: 'New', reason: REQUEST.reason });
  });

  it('keeps anonymous submissions out of every list, like a Create-only permission', async () => {
    const backend = createMockBackend({ now: () => NOW });
    const before = (await backend.requests.listMyRequests(DEMO_USER)).length;
    await backend.requests.submitRequest(REQUEST, null);
    expect(await backend.requests.listMyRequests(DEMO_USER)).toHaveLength(before);
  });

  it('never shows one contact the requests of another', async () => {
    const backend = createMockBackend({ now: () => NOW });
    const stranger: PortalUser = { ...DEMO_USER, contactId: '99999999-9999-4999-8999-999999999999' };
    expect(await backend.requests.listMyRequests(stranger)).toEqual([]);
  });

  it('persists requests when storage is available and survives broken storage', async () => {
    const storage = memoryStore();
    const first = createMockBackend({ now: () => NOW, storage });
    await first.requests.submitRequest(REQUEST, DEMO_USER);
    const second = createMockBackend({ now: () => NOW, storage });
    expect(await second.requests.listMyRequests(DEMO_USER)).toHaveLength(4);

    const broken: KeyValueStore = {
      getItem: (): string | null => {
        throw new Error('blocked');
      },
      setItem: (): void => {
        throw new Error('blocked');
      },
      removeItem: (): void => {
        throw new Error('blocked');
      },
    };
    const resilient = createMockBackend({ now: () => NOW, storage: broken, sessionStorage: broken });
    await expect(resilient.requests.submitRequest(REQUEST, DEMO_USER)).resolves.toMatchObject({ reference: expect.any(String) });
  });
});

describe('mock backend sign-in', () => {
  it('signs the demo user in and out', async () => {
    const session = memoryStore();
    const backend = createMockBackend({ sessionStorage: session });
    expect(backend.auth.getUser()).toBeNull();
    await expect(backend.auth.signIn('/my-requests')).resolves.toEqual(DEMO_USER);
    expect(backend.auth.getUser()).toEqual(DEMO_USER);
    expect(createMockBackend({ sessionStorage: session }).auth.getUser()).toEqual(DEMO_USER);
    await backend.auth.signOut();
    expect(backend.auth.getUser()).toBeNull();
  });
});

describe('resolveBackendMode', () => {
  it('uses the mock on localhost even if a portal object exists', () => {
    expect(resolveBackendMode(undefined, { hostname: 'localhost', hasPortalObject: true })).toBe('mock');
    expect(resolveBackendMode('auto', { hostname: '127.0.0.1', hasPortalObject: false })).toBe('mock');
  });

  it('uses the Web API on a Power Pages host', () => {
    expect(resolveBackendMode(undefined, { hostname: 'contoso-clinic.powerappsportals.com', hasPortalObject: true })).toBe(
      'powerpages',
    );
  });

  it('falls back to the mock on other hosts without the portal object', () => {
    expect(resolveBackendMode(undefined, { hostname: 'preview.example.com', hasPortalObject: false })).toBe('mock');
  });

  it('honours an explicit VITE_DATA_ADAPTER setting', () => {
    expect(resolveBackendMode('powerpages', { hostname: 'localhost', hasPortalObject: false })).toBe('powerpages');
    expect(resolveBackendMode('MOCK', { hostname: 'contoso.powerappsportals.com', hasPortalObject: true })).toBe('mock');
  });
});
