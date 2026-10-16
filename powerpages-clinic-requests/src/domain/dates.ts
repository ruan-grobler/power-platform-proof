// Date-only helpers. Appointment dates have no time zone, so we work in
// whole days (UTC midnight) to avoid daylight saving surprises.

const DAY_MS = 24 * 60 * 60 * 1000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad = (value: number): string => String(value).padStart(2, '0');

/** Local calendar date of `date` as YYYY-MM-DD. */
export const toIsoDate = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** Day number (days since 1970-01-01) for a YYYY-MM-DD string, or null if it is not a real date. */
export const isoDateToDayNumber = (value: string): number | null => {
  const match = ISO_DATE.exec(value);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const time = Date.UTC(year, month - 1, day);
  const check = new Date(time);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    return null;
  }
  return Math.round(time / DAY_MS);
};

export const dayNumberToIsoDate = (dayNumber: number): string => {
  const date = new Date(dayNumber * DAY_MS);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
};

/** Day of week for a day number. 0 is Sunday. */
export const dayOfWeek = (dayNumber: number): number => new Date(dayNumber * DAY_MS).getUTCDay();

export const addDaysIso = (value: string, days: number): string => {
  const dayNumber = isoDateToDayNumber(value);
  if (dayNumber === null) {
    throw new Error(`Not a valid date: ${value}`);
  }
  return dayNumberToIsoDate(dayNumber + days);
};

/** Formats YYYY-MM-DD for people, for example "Tuesday, 20 October 2026". */
export const formatIsoDate = (value: string): string => {
  const dayNumber = isoDateToDayNumber(value);
  if (dayNumber === null) {
    return value;
  }
  return new Intl.DateTimeFormat('en-ZA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(dayNumber * DAY_MS));
};

/** Formats an ISO timestamp, for example "16 Oct 2026, 09:30". */
export const formatTimestamp = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};
