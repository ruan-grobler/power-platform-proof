import { dayNumberToIsoDate, dayOfWeek, isoDateToDayNumber, toIsoDate } from './dates';
import { isTimeWindow } from './options';
import type { AppointmentRequestInput, NormalisedAppointmentRequest } from './types';

export const LIMITS = {
  nameMin: 2,
  nameMax: 100,
  emailMax: 100,
  reasonMin: 10,
  reasonMax: 1000,
  /** Earliest bookable day, counted from today. 1 means tomorrow. */
  minDaysAhead: 1,
  maxDaysAhead: 90,
} as const;

export type FieldName = keyof AppointmentRequestInput;

export type ValidationErrors = Partial<Record<FieldName, string>>;

export type ValidationResult =
  | { ok: true; value: NormalisedAppointmentRequest }
  | { ok: false; errors: ValidationErrors };

/** Order used for the error summary, so it matches the order on screen. */
export const FIELD_ORDER: readonly FieldName[] = [
  'fullName',
  'phone',
  'email',
  'preferredDate',
  'timeWindow',
  'reason',
  'popiaConsent',
];

const SUNDAY = 0;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const HAS_LETTER = /\p{L}/u;
const PHONE_SEPARATORS = /[\s().-]/g;
const SA_LOCAL = /^0([1-9]\d{8})$/;
const SA_INTERNATIONAL = /^(?:\+27|0027|27)([1-9]\d{8})$/;

/**
 * Normalises a South African phone number to E.164 (+27XXXXXXXXX).
 * Accepts "082 555 0134", "+27 82 555 0134", "0027825550134" and similar.
 * Returns null when the number is not a valid South African number.
 */
export const normalisePhone = (raw: string): string | null => {
  const compact = raw.trim().replace(PHONE_SEPARATORS, '');
  const match = SA_LOCAL.exec(compact) ?? SA_INTERNATIONAL.exec(compact);
  return match ? `+27${match[1]}` : null;
};

/** Formats +27825550134 as 082 555 0134 for display. */
export const formatPhoneForDisplay = (e164: string): string => {
  const match = /^\+27(\d{2})(\d{3})(\d{4})$/.exec(e164);
  return match ? `0${match[1]} ${match[2]} ${match[3]}` : e164;
};

/** The first and last dates a person may choose, as YYYY-MM-DD. */
export const getDateBounds = (today: Date): { min: string; max: string } => {
  const todayNumber = isoDateToDayNumber(toIsoDate(today));
  if (todayNumber === null) {
    throw new Error('Could not read today\'s date.');
  }
  return {
    min: dayNumberToIsoDate(todayNumber + LIMITS.minDaysAhead),
    max: dayNumberToIsoDate(todayNumber + LIMITS.maxDaysAhead),
  };
};

export const validateFullName = (value: string): string | undefined => {
  const name = value.trim();
  if (name === '') {
    return 'Enter your full name.';
  }
  if (name.length < LIMITS.nameMin || !HAS_LETTER.test(name)) {
    return 'Enter your full name, for example Thandi Mokoena.';
  }
  if (name.length > LIMITS.nameMax) {
    return `Your name must be ${LIMITS.nameMax} characters or fewer.`;
  }
  return undefined;
};

export const validatePhone = (value: string): string | undefined => {
  if (value.trim() === '') {
    return 'Enter a phone number so we can call you back.';
  }
  if (normalisePhone(value) === null) {
    return 'Enter a South African phone number, for example 082 555 0134 or +27 82 555 0134.';
  }
  return undefined;
};

export const validateEmail = (value: string): string | undefined => {
  const email = value.trim();
  if (email === '') {
    return 'Enter your email address.';
  }
  if (email.length > LIMITS.emailMax) {
    return `Your email address must be ${LIMITS.emailMax} characters or fewer.`;
  }
  if (!EMAIL_PATTERN.test(email)) {
    return 'Enter an email address in the right format, for example name@example.com.';
  }
  return undefined;
};

export const validatePreferredDate = (value: string, today: Date): string | undefined => {
  if (value.trim() === '') {
    return 'Choose a preferred date.';
  }
  const chosen = isoDateToDayNumber(value.trim());
  if (chosen === null) {
    return 'Enter a real date, for example 2026-11-03.';
  }
  const bounds = getDateBounds(today);
  const min = isoDateToDayNumber(bounds.min) ?? 0;
  const max = isoDateToDayNumber(bounds.max) ?? 0;
  if (chosen < min) {
    return 'Choose a date from tomorrow onwards.';
  }
  if (chosen > max) {
    return `Choose a date within the next ${LIMITS.maxDaysAhead} days.`;
  }
  if (dayOfWeek(chosen) === SUNDAY) {
    return 'The clinic is closed on Sundays. Choose a day from Monday to Saturday.';
  }
  return undefined;
};

export const validateTimeWindow = (value: string): string | undefined =>
  isTimeWindow(value) ? undefined : 'Choose a preferred time of day.';

export const validateReason = (value: string): string | undefined => {
  const reason = value.trim();
  if (reason === '') {
    return 'Tell us briefly why you would like to see a clinician.';
  }
  if (reason.length < LIMITS.reasonMin) {
    return `Add a little more detail (at least ${LIMITS.reasonMin} characters).`;
  }
  if (reason.length > LIMITS.reasonMax) {
    return `Keep the reason to ${LIMITS.reasonMax} characters or fewer.`;
  }
  return undefined;
};

export const validateConsent = (value: boolean): string | undefined =>
  value ? undefined : 'Tick the consent box so we can use your details to arrange the appointment.';

/** Validates a single field. Used when a field loses focus. */
export const validateField = (
  name: FieldName,
  input: AppointmentRequestInput,
  today: Date,
): string | undefined => {
  switch (name) {
    case 'fullName':
      return validateFullName(input.fullName);
    case 'phone':
      return validatePhone(input.phone);
    case 'email':
      return validateEmail(input.email);
    case 'preferredDate':
      return validatePreferredDate(input.preferredDate, today);
    case 'timeWindow':
      return validateTimeWindow(input.timeWindow);
    case 'reason':
      return validateReason(input.reason);
    case 'popiaConsent':
      return validateConsent(input.popiaConsent);
  }
};

/** Validates the whole form and, if it is valid, returns cleaned values. */
export const validateAppointmentRequest = (
  input: AppointmentRequestInput,
  today: Date = new Date(),
): ValidationResult => {
  const errors: ValidationErrors = {};
  for (const name of FIELD_ORDER) {
    const message = validateField(name, input, today);
    if (message) {
      errors[name] = message;
    }
  }

  const phone = normalisePhone(input.phone);
  if (Object.keys(errors).length > 0 || phone === null || !isTimeWindow(input.timeWindow)) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      fullName: input.fullName.trim().replace(/\s+/g, ' '),
      phone,
      email: input.email.trim().toLowerCase(),
      preferredDate: input.preferredDate.trim(),
      timeWindow: input.timeWindow,
      reason: input.reason.trim(),
      popiaConsent: true,
    },
  };
};
