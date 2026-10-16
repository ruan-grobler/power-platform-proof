// Maps appointment requests to and from the cr_appointmentrequest Dataverse table
// and calls the Power Pages Web API through PowerPagesClient.

import { DATAVERSE, FORMATTED_VALUE_SUFFIX } from '../config/dataverse';
import { CONSENT_VERSION } from '../domain/consent';
import type {
  AppointmentRequest,
  NormalisedAppointmentRequest,
  PortalUser,
  RequestStatus,
  TimeWindow,
} from '../domain/types';
import type { PowerPagesClient } from './powerPagesClient';
import { toReference, type RequestsApi, type SubmitResult } from './types';

const COLUMNS = DATAVERSE.columns;
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_ROWS = 50;

export type DataverseRow = Record<string, unknown>;

/** Columns read by "My requests". Each one must be listed in Webapi/cr_appointmentrequest/fields. */
export const SELECT_COLUMNS: readonly string[] = [
  COLUMNS.id,
  COLUMNS.name,
  COLUMNS.phone,
  COLUMNS.email,
  COLUMNS.preferredDate,
  COLUMNS.timeWindow,
  COLUMNS.reason,
  COLUMNS.status,
  COLUMNS.createdOn,
];

export const collectionPath = (): string => `/_api/${DATAVERSE.entitySetName}`;

/** Builds the POST body. Status is left out on purpose: Dataverse defaults it to New. */
export const toDataversePayload = (
  request: NormalisedAppointmentRequest,
  user: PortalUser | null,
  now: Date,
): DataverseRow => {
  const payload: DataverseRow = {
    [COLUMNS.name]: request.fullName,
    [COLUMNS.phone]: request.phone,
    [COLUMNS.email]: request.email,
    [COLUMNS.preferredDate]: request.preferredDate,
    [COLUMNS.timeWindow]: DATAVERSE.timeWindowValues[request.timeWindow],
    [COLUMNS.reason]: request.reason,
    [COLUMNS.popiaConsent]: request.popiaConsent,
    [COLUMNS.consentTimestamp]: now.toISOString(),
    [COLUMNS.consentVersion]: CONSENT_VERSION,
  };
  if (user) {
    if (!GUID.test(user.contactId)) {
      throw new Error('The signed-in user has no valid contact id.');
    }
    // Links the request to the signed-in contact so the Contact-scoped
    // table permission lets them read it back on "My requests".
    payload[`${DATAVERSE.contactNavigationProperty}@odata.bind`] =
      `/${DATAVERSE.contactEntitySetName}(${user.contactId})`;
  }
  return payload;
};

/** GET path for the signed-in contact's requests, newest first. */
export const buildMyRequestsPath = (contactId: string): string => {
  if (!GUID.test(contactId)) {
    throw new Error('A valid contact id is required.');
  }
  // Table permissions already limit rows to this contact. The filter keeps the
  // intent explicit and the result small.
  const query = [
    `$select=${SELECT_COLUMNS.join(',')}`,
    `$filter=${encodeURIComponent(`${COLUMNS.contactValue} eq ${contactId}`)}`,
    `$orderby=${encodeURIComponent(`${COLUMNS.createdOn} desc`)}`,
    `$top=${MAX_ROWS}`,
  ].join('&');
  return `${collectionPath()}?${query}`;
};

const asString = (value: unknown): string => (typeof value === 'string' ? value : '');

const findKey = <T extends string>(values: Record<T, number>, value: unknown): T | null => {
  const match = (Object.keys(values) as T[]).find((key) => values[key] === value);
  return match ?? null;
};

/** Maps a Web API row to the shape the UI uses. */
export const fromDataverseRow = (row: DataverseRow): AppointmentRequest => {
  const id = asString(row[COLUMNS.id]);
  const status = findKey<RequestStatus>(DATAVERSE.statusValues, row[COLUMNS.status]);
  const timeWindow = findKey<TimeWindow>(DATAVERSE.timeWindowValues, row[COLUMNS.timeWindow]);
  const formattedStatus = asString(row[`${COLUMNS.status}${FORMATTED_VALUE_SUFFIX}`]);
  return {
    id,
    reference: toReference(id || null),
    fullName: asString(row[COLUMNS.name]),
    phone: asString(row[COLUMNS.phone]),
    email: asString(row[COLUMNS.email]),
    // Date only columns come back as YYYY-MM-DD. Trim any time part just in case.
    preferredDate: asString(row[COLUMNS.preferredDate]).slice(0, 10),
    timeWindow,
    reason: asString(row[COLUMNS.reason]),
    status: status ?? 'Unknown',
    statusLabel: status ?? (formattedStatus || 'Unknown'),
    createdOn: asString(row[COLUMNS.createdOn]),
  };
};

export const createPowerPagesRequestsApi = (
  client: PowerPagesClient,
  clock: () => Date = () => new Date(),
): RequestsApi => ({
  submitRequest: async (request: NormalisedAppointmentRequest, user: PortalUser | null): Promise<SubmitResult> => {
    const { entityId } = await client.post(collectionPath(), toDataversePayload(request, user, clock()));
    return { id: entityId, reference: toReference(entityId) };
  },
  listMyRequests: async (user: PortalUser): Promise<AppointmentRequest[]> => {
    const data = await client.get<{ value?: DataverseRow[] }>(buildMyRequestsPath(user.contactId));
    return (data.value ?? []).map(fromDataverseRow);
  },
});
