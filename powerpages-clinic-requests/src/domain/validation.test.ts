import { describe, expect, it } from 'vitest';
import type { AppointmentRequestInput } from './types';
import {
  FIELD_ORDER,
  formatPhoneForDisplay,
  getDateBounds,
  normalisePhone,
  validateAppointmentRequest,
  validateField,
} from './validation';

// Friday 16 October 2026, local time. Tomorrow is Saturday, the day after is Sunday.
const TODAY = new Date(2026, 9, 16, 10, 30);

const validInput = (overrides: Partial<AppointmentRequestInput> = {}): AppointmentRequestInput => ({
  fullName: '  Thandi   Mokoena ',
  phone: '082 555 0134',
  email: ' Thandi.Mokoena@Example.com ',
  preferredDate: '2026-10-20',
  timeWindow: 'morning',
  reason: 'Annual check-up and blood pressure review.',
  popiaConsent: true,
  ...overrides,
});

const errorsFor = (overrides: Partial<AppointmentRequestInput>): Record<string, string | undefined> => {
  const result = validateAppointmentRequest(validInput(overrides), TODAY);
  return result.ok ? {} : result.errors;
};

describe('validateAppointmentRequest', () => {
  it('accepts a complete request and returns cleaned values', () => {
    const result = validateAppointmentRequest(validInput(), TODAY);
    expect(result).toEqual({
      ok: true,
      value: {
        fullName: 'Thandi Mokoena',
        phone: '+27825550134',
        email: 'thandi.mokoena@example.com',
        preferredDate: '2026-10-20',
        timeWindow: 'morning',
        reason: 'Annual check-up and blood pressure review.',
        popiaConsent: true,
      },
    });
  });

  it('reports every missing field on an empty form, in screen order', () => {
    const result = validateAppointmentRequest(
      {
        fullName: '',
        phone: '',
        email: '',
        preferredDate: '',
        timeWindow: '',
        reason: '',
        popiaConsent: false,
      },
      TODAY,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.errors)).toEqual([...FIELD_ORDER]);
    }
  });

  it('requires POPIA consent', () => {
    expect(errorsFor({ popiaConsent: false }).popiaConsent).toMatch(/tick the consent box/i);
  });

  it('rejects names that are too short, have no letters, or are too long', () => {
    expect(errorsFor({ fullName: 'A' }).fullName).toBeDefined();
    expect(errorsFor({ fullName: '12345' }).fullName).toBeDefined();
    expect(errorsFor({ fullName: 'x'.repeat(101) }).fullName).toMatch(/100 characters/);
    expect(errorsFor({ fullName: 'Zoë Ndlovu' }).fullName).toBeUndefined();
  });

  it('checks the email format', () => {
    expect(errorsFor({ email: 'not-an-email' }).email).toMatch(/right format/);
    expect(errorsFor({ email: 'name@example' }).email).toMatch(/right format/);
    expect(errorsFor({ email: 'name@example.co.za' }).email).toBeUndefined();
  });

  it('checks the reason length', () => {
    expect(errorsFor({ reason: 'Sore' }).reason).toMatch(/at least 10/);
    expect(errorsFor({ reason: 'x'.repeat(1001) }).reason).toMatch(/1000 characters/);
  });

  it('only accepts the three time windows', () => {
    expect(errorsFor({ timeWindow: '' }).timeWindow).toBeDefined();
    expect(errorsFor({ timeWindow: 'evening' as AppointmentRequestInput['timeWindow'] }).timeWindow).toBeDefined();
    expect(errorsFor({ timeWindow: 'late-afternoon' }).timeWindow).toBeUndefined();
  });
});

describe('preferred date rules', () => {
  const dateError = (value: string): string | undefined =>
    validateField('preferredDate', validInput({ preferredDate: value }), TODAY);

  it('rejects today and past dates', () => {
    expect(dateError('2026-10-16')).toMatch(/from tomorrow/);
    expect(dateError('2026-10-01')).toMatch(/from tomorrow/);
  });

  it('accepts tomorrow when it is not a Sunday', () => {
    expect(dateError('2026-10-17')).toBeUndefined();
  });

  it('rejects Sundays', () => {
    expect(dateError('2026-10-18')).toMatch(/closed on Sundays/);
  });

  it('rejects dates more than 90 days ahead', () => {
    expect(dateError('2027-01-14')).toBeUndefined();
    expect(dateError('2027-01-15')).toMatch(/within the next 90 days/);
  });

  it('rejects dates that do not exist or are in the wrong format', () => {
    expect(dateError('2026-02-30')).toMatch(/real date/);
    expect(dateError('20/10/2026')).toMatch(/real date/);
  });

  it('gives the bounds used by the date picker', () => {
    expect(getDateBounds(TODAY)).toEqual({ min: '2026-10-17', max: '2027-01-14' });
  });
});

describe('South African phone numbers', () => {
  it.each([
    ['082 555 0134', '+27825550134'],
    ['0825550134', '+27825550134'],
    ['+27 82 555 0134', '+27825550134'],
    ['+27 82-555-0134', '+27825550134'],
    ['0027825550134', '+27825550134'],
    ['021-555-0100', '+27215550100'],
  ])('normalises %s to %s', (raw, expected) => {
    expect(normalisePhone(raw)).toBe(expected);
  });

  it.each(['12345', '082 555 013', '00825550134', '+44 20 7946 0958', 'phone me'])('rejects %s', (raw) => {
    expect(normalisePhone(raw)).toBeNull();
    expect(validateField('phone', validInput({ phone: raw }), TODAY)).toMatch(/South African phone number/);
  });

  it('formats numbers for display', () => {
    expect(formatPhoneForDisplay('+27825550134')).toBe('082 555 0134');
  });
});
