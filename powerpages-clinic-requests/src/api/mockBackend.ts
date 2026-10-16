// Offline stand-in for Power Pages, used on localhost so `npm run dev` works
// without a Dataverse environment. It mirrors the server rules that matter:
// anonymous requests are saved but nobody can read them back, and signed-in
// users only ever see requests linked to their own contact.

import { addDaysIso, toIsoDate } from '../domain/dates';
import type {
  AppointmentRequest,
  NormalisedAppointmentRequest,
  PortalUser,
  RequestStatus,
  TimeWindow,
} from '../domain/types';
import { toReference, type AuthApi, type Backend, type RequestsApi, type SubmitResult } from './types';

export const DEMO_USER: PortalUser = {
  contactId: '5f0dc39a-89dd-48e2-bee3-10f648be97fc',
  firstName: 'Demo',
  lastName: 'Patient',
  email: 'demo.patient@example.com',
  userName: 'demo.patient@example.com',
};

interface StoredRequest {
  id: string;
  contactId: string | null;
  fullName: string;
  phone: string;
  email: string;
  preferredDate: string;
  timeWindow: TimeWindow;
  reason: string;
  status: RequestStatus;
  createdOn: string;
}

/** Small key-value store. Browsers pass sessionStorage or localStorage; tests pass nothing. */
export interface KeyValueStore {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

export interface MockBackendOptions {
  storage?: KeyValueStore | null;
  sessionStorage?: KeyValueStore | null;
  latencyMs?: number;
  now?: () => Date;
  newId?: () => string;
}

const REQUESTS_KEY = 'contoso-clinic.mock.requests.v1';
const SIGNED_IN_KEY = 'contoso-clinic.mock.signed-in';

const safeGet = (store: KeyValueStore | null | undefined, key: string): string | null => {
  try {
    return store ? store.getItem(key) : null;
  } catch {
    return null;
  }
};

const safeSet = (store: KeyValueStore | null | undefined, key: string, value: string | null): void => {
  try {
    if (!store) {
      return;
    }
    if (value === null) {
      store.removeItem(key);
    } else {
      store.setItem(key, value);
    }
  } catch {
    // Storage can be blocked (private windows, previews). The mock still works in memory.
  }
};

const hoursAgo = (now: Date, hours: number): string => new Date(now.getTime() - hours * 3_600_000).toISOString();

/** Adds days and moves a Sunday to the Monday, because the clinic is closed on Sundays. */
const openDay = (today: string, offset: number): string => {
  const date = addDaysIso(today, offset);
  return new Date(`${date}T00:00:00Z`).getUTCDay() === 0 ? addDaysIso(date, 1) : date;
};

/** Seed data: one request in each status for the demo user, plus one anonymous request. */
export const createSeedRequests = (now: Date): StoredRequest[] => {
  const today = toIsoDate(now);
  return [
    {
      id: 'a3c1f0d2-6b1e-4f43-9a0e-2f7d8c1b5e01',
      contactId: DEMO_USER.contactId,
      fullName: 'Demo Patient',
      phone: '+27825550134',
      email: DEMO_USER.email,
      preferredDate: openDay(today, 9),
      timeWindow: 'afternoon',
      reason: 'Follow-up after a chest cold. Still coughing at night.',
      status: 'New',
      createdOn: hoursAgo(now, 3),
    },
    {
      id: 'b7e2a4c9-1d3f-4b8a-8c6e-7a9b0c1d2e02',
      contactId: DEMO_USER.contactId,
      fullName: 'Demo Patient',
      phone: '+27825550134',
      email: DEMO_USER.email,
      preferredDate: openDay(today, 3),
      timeWindow: 'morning',
      reason: 'Annual check-up and blood pressure review.',
      status: 'Confirmed',
      createdOn: hoursAgo(now, 50),
    },
    {
      id: 'c9f3b5d1-2e4a-4c7b-9d8f-6e5a4b3c2d03',
      contactId: DEMO_USER.contactId,
      fullName: 'Demo Patient',
      phone: '+27825550134',
      email: DEMO_USER.email,
      preferredDate: openDay(today, -4),
      timeWindow: 'late-afternoon',
      reason: 'Travel vaccinations before a trip next month.',
      status: 'Declined',
      createdOn: hoursAgo(now, 290),
    },
    {
      id: 'd1a2b3c4-5e6f-4a7b-8c9d-0e1f2a3b4c04',
      contactId: null,
      fullName: 'Walk-in Visitor',
      phone: '+27215550199',
      email: 'visitor@example.com',
      preferredDate: openDay(today, 2),
      timeWindow: 'morning',
      reason: 'Needs a sick note after a stomach bug.',
      status: 'New',
      createdOn: hoursAgo(now, 1),
    },
  ];
};

const toAppointmentRequest = (row: StoredRequest): AppointmentRequest => ({
  id: row.id,
  reference: toReference(row.id),
  fullName: row.fullName,
  phone: row.phone,
  email: row.email,
  preferredDate: row.preferredDate,
  timeWindow: row.timeWindow,
  reason: row.reason,
  status: row.status,
  statusLabel: row.status,
  createdOn: row.createdOn,
});

const wait = (ms: number): Promise<void> =>
  ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();

export const createMockBackend = (options: MockBackendOptions = {}): Backend => {
  const now = options.now ?? ((): Date => new Date());
  const newId = options.newId ?? ((): string => crypto.randomUUID());
  const latencyMs = options.latencyMs ?? 0;
  const storage = options.storage ?? null;
  const session = options.sessionStorage ?? null;

  const loadRequests = (): StoredRequest[] => {
    const raw = safeGet(storage, REQUESTS_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as StoredRequest[];
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch {
        // Fall through to fresh seed data.
      }
    }
    return createSeedRequests(now());
  };

  let rows: StoredRequest[] = loadRequests();
  let signedIn = safeGet(session, SIGNED_IN_KEY) === 'true';

  const save = (): void => safeSet(storage, REQUESTS_KEY, JSON.stringify(rows));

  const requests: RequestsApi = {
    submitRequest: async (request: NormalisedAppointmentRequest, user: PortalUser | null): Promise<SubmitResult> => {
      await wait(latencyMs);
      const id = newId();
      rows = [
        {
          id,
          contactId: user ? user.contactId : null,
          fullName: request.fullName,
          phone: request.phone,
          email: request.email,
          preferredDate: request.preferredDate,
          timeWindow: request.timeWindow,
          reason: request.reason,
          status: 'New',
          createdOn: now().toISOString(),
        },
        ...rows,
      ];
      save();
      return { id, reference: toReference(id) };
    },
    listMyRequests: async (user: PortalUser): Promise<AppointmentRequest[]> => {
      await wait(latencyMs);
      return rows
        .filter((row) => row.contactId !== null && row.contactId === user.contactId)
        .sort((a, b) => b.createdOn.localeCompare(a.createdOn))
        .map(toAppointmentRequest);
    },
  };

  const auth: AuthApi = {
    getUser: (): PortalUser | null => (signedIn ? DEMO_USER : null),
    signIn: async (): Promise<PortalUser | null> => {
      await wait(latencyMs / 2);
      signedIn = true;
      safeSet(session, SIGNED_IN_KEY, 'true');
      return DEMO_USER;
    },
    signOut: async (): Promise<void> => {
      signedIn = false;
      safeSet(session, SIGNED_IN_KEY, null);
    },
  };

  return { mode: 'mock', requests, auth };
};
