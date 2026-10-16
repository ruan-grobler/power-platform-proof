import { describe, expect, it } from 'vitest';
import { CONSENT_VERSION } from '../domain/consent';
import type { NormalisedAppointmentRequest, PortalUser } from '../domain/types';
import { createFakePowerPages } from '../test/fakePowerPages';
import { createPowerPagesClient } from './powerPagesClient';
import {
  buildMyRequestsPath,
  createPowerPagesRequestsApi,
  fromDataverseRow,
  toDataversePayload,
} from './powerPagesRequests';

const NOW = new Date('2026-10-16T08:00:00.000Z');

const REQUEST: NormalisedAppointmentRequest = {
  fullName: 'Thandi Mokoena',
  phone: '+27825550134',
  email: 'thandi@example.com',
  preferredDate: '2026-10-20',
  timeWindow: 'afternoon',
  reason: 'Annual check-up and blood pressure review.',
  popiaConsent: true,
};

const USER: PortalUser = {
  contactId: '11111111-2222-4333-8444-555555555555',
  firstName: 'Thandi',
  lastName: 'Mokoena',
  email: 'thandi@example.com',
  userName: 'thandi@example.com',
};

describe('toDataversePayload', () => {
  it('maps the form to cr_appointmentrequest columns and records consent', () => {
    expect(toDataversePayload(REQUEST, null, NOW)).toEqual({
      cr_name: 'Thandi Mokoena',
      cr_phone: '+27825550134',
      cr_email: 'thandi@example.com',
      cr_preferreddate: '2026-10-20',
      cr_timewindow: 100000001,
      cr_reason: 'Annual check-up and blood pressure review.',
      cr_popiaconsent: true,
      cr_consenttimestamp: '2026-10-16T08:00:00.000Z',
      cr_consentversion: CONSENT_VERSION,
    });
  });

  it('never sends a status, so the server default (New) applies', () => {
    expect(toDataversePayload(REQUEST, USER, NOW)).not.toHaveProperty('cr_status');
  });

  it('binds the signed-in contact with @odata.bind', () => {
    expect(toDataversePayload(REQUEST, USER, NOW)['cr_Contact@odata.bind']).toBe(`/contacts(${USER.contactId})`);
  });

  it('refuses a contact id that is not a GUID', () => {
    expect(() => toDataversePayload(REQUEST, { ...USER, contactId: "x' or 1 eq 1" }, NOW)).toThrow(/contact id/);
  });
});

describe('buildMyRequestsPath', () => {
  it('selects only listed columns, filters by contact and sorts newest first', () => {
    const path = buildMyRequestsPath(USER.contactId);
    expect(path.startsWith('/_api/cr_appointmentrequests?$select=cr_appointmentrequestid,cr_name,')).toBe(true);
    expect(decodeURIComponent(path)).toContain(`$filter=_cr_contact_value eq ${USER.contactId}`);
    expect(decodeURIComponent(path)).toContain('$orderby=createdon desc');
    expect(path).toContain('$top=50');
  });

  it('rejects anything that is not a GUID', () => {
    expect(() => buildMyRequestsPath('not-a-guid')).toThrow();
  });
});

describe('fromDataverseRow', () => {
  it('maps choice values to statuses and time windows', () => {
    const row = fromDataverseRow({
      cr_appointmentrequestid: 'abcdef12-3456-4789-8abc-def012345678',
      cr_name: 'Thandi Mokoena',
      cr_preferreddate: '2026-10-20',
      cr_timewindow: 100000002,
      cr_status: 100000001,
      createdon: '2026-10-16T08:00:00Z',
    });
    expect(row).toMatchObject({
      reference: 'CR-ABCDEF12',
      status: 'Confirmed',
      statusLabel: 'Confirmed',
      timeWindow: 'late-afternoon',
    });
  });

  it('falls back to the formatted value for a status it does not know', () => {
    const row = fromDataverseRow({
      cr_appointmentrequestid: 'abcdef12-3456-4789-8abc-def012345678',
      cr_status: 100000009,
      'cr_status@OData.Community.Display.V1.FormattedValue': 'Rescheduled',
    });
    expect(row.status).toBe('Unknown');
    expect(row.statusLabel).toBe('Rescheduled');
  });
});

describe('createPowerPagesRequestsApi against a fake Power Pages site', () => {
  it('creates a request and lists it back for the same contact only', async () => {
    const fake = createFakePowerPages();
    const api = createPowerPagesRequestsApi(createPowerPagesClient({ fetchFn: fake.fetch }), () => NOW);

    const saved = await api.submitRequest(REQUEST, USER);
    await api.submitRequest({ ...REQUEST, fullName: 'Someone Else' }, null);

    expect(saved.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(saved.reference).toMatch(/^CR-[0-9A-F]{8}$/);

    const mine = await api.listMyRequests(USER);
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ fullName: 'Thandi Mokoena', status: 'New', timeWindow: 'afternoon' });

    const post = fake.calls.find((call) => call.method === 'POST');
    expect(post?.url).toBe('/_api/cr_appointmentrequests');
  });
});
