import type { AppointmentRequest, NormalisedAppointmentRequest, PortalUser } from '../domain/types';

export type BackendMode = 'mock' | 'powerpages';

export interface SubmitResult {
  id: string | null;
  /** Short reference to read out over the phone, for example CR-1A2B3C4D. */
  reference: string;
}

export interface RequestsApi {
  /** Creates a request. Signed-in users have it linked to their contact. */
  submitRequest: (request: NormalisedAppointmentRequest, user: PortalUser | null) => Promise<SubmitResult>;
  /** Lists the signed-in user's own requests, newest first. */
  listMyRequests: (user: PortalUser) => Promise<AppointmentRequest[]>;
}

export interface AuthApi {
  getUser: () => PortalUser | null;
  /**
   * Starts sign-in. The mock returns the demo user straight away. On Power
   * Pages the browser leaves the page for the identity provider, so it
   * resolves to null.
   */
  signIn: (returnPath: string) => Promise<PortalUser | null>;
  signOut: () => Promise<void>;
}

export interface Backend {
  mode: BackendMode;
  requests: RequestsApi;
  auth: AuthApi;
}

export const toReference = (id: string | null): string =>
  id ? `CR-${id.replace(/-/g, '').slice(0, 8).toUpperCase()}` : 'CR-PENDING';
