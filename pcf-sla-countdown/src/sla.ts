/*
 * Pure SLA maths for the SLA Countdown Badge.
 *
 * No DOM and no PCF types live here, so every rule (thresholds, rounding,
 * wording) can be unit-tested in Node without the Power Apps runtime.
 */

export type SlaState = 'onTrack' | 'warning' | 'critical' | 'overdue' | 'none';

export interface SlaThresholds {
  /** Remaining time, in hours, at or below which the badge turns amber. */
  warningHours: number;
  /** Remaining time, in hours, at or below which the badge turns red. */
  criticalHours: number;
}

export interface SlaResult {
  state: SlaState;
  /** Short text shown inside the badge, for example "3h 12m left". */
  text: string;
  /** Full sentence for assistive technology, for example "Due in 3 hours 12 minutes, critical". */
  ariaLabel: string;
  /** Milliseconds until the due date. Negative when overdue, null when there is no valid date. */
  remainingMs: number | null;
}

export interface DurationParts {
  days: number;
  hours: number;
  minutes: number;
}

export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

export const DEFAULT_WARNING_HOURS = 24;
export const DEFAULT_CRITICAL_HOURS = 4;

export const DEFAULT_THRESHOLDS: Readonly<SlaThresholds> = Object.freeze({
  warningHours: DEFAULT_WARNING_HOURS,
  criticalHours: DEFAULT_CRITICAL_HOURS,
});

export const STATE_LABELS: Readonly<Record<SlaState, string>> = Object.freeze({
  onTrack: 'on track',
  warning: 'warning',
  critical: 'critical',
  overdue: 'overdue',
  none: 'no due date',
});

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;

const toThreshold = (value: number | null | undefined, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : fallback;

/**
 * Turns raw manifest inputs into safe thresholds.
 * Missing or non-numeric values fall back to the defaults, negatives clamp to 0.
 */
export const normaliseThresholds = (
  warningHours?: number | null,
  criticalHours?: number | null,
): SlaThresholds => ({
  warningHours: toThreshold(warningHours, DEFAULT_WARNING_HOURS),
  criticalHours: toThreshold(criticalHours, DEFAULT_CRITICAL_HOURS),
});

/** Whole minutes in a duration, always rounded down so the badge never overstates time left. */
export const toWholeMinutes = (ms: number): number => Math.floor(Math.abs(ms) / MINUTE_MS);

export const splitDuration = (ms: number): DurationParts => {
  const totalMinutes = toWholeMinutes(ms);
  return {
    days: Math.floor(totalMinutes / MINUTES_PER_DAY),
    hours: Math.floor((totalMinutes % MINUTES_PER_DAY) / MINUTES_PER_HOUR),
    minutes: totalMinutes % MINUTES_PER_HOUR,
  };
};

/**
 * Compact form for the badge. Shows the two largest units and drops a trailing zero unit:
 * "2d 5h", "2d", "3h 12m", "3h", "45m".
 */
export const formatCompact = (ms: number): string => {
  const { days, hours, minutes } = splitDuration(ms);
  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  return `${minutes}m`;
};

const plural = (count: number, unit: string): string => `${count} ${unit}${count === 1 ? '' : 's'}`;

/** Spoken form for screen readers: "2 days 5 hours", "1 hour 1 minute", "45 minutes". */
export const formatLong = (ms: number): string => {
  const { days, hours, minutes } = splitDuration(ms);
  if (days > 0) {
    return hours > 0 ? `${plural(days, 'day')} ${plural(hours, 'hour')}` : plural(days, 'day');
  }
  if (hours > 0) {
    return minutes > 0 ? `${plural(hours, 'hour')} ${plural(minutes, 'minute')}` : plural(hours, 'hour');
  }
  return plural(minutes, 'minute');
};

/**
 * Classifies remaining time. Thresholds are inclusive and are compared on the
 * whole minutes shown on the badge, so the colour always agrees with the number.
 * Critical is checked before warning, so it wins if the two are misconfigured.
 */
export const getSlaState = (remainingMs: number | null, thresholds: SlaThresholds = DEFAULT_THRESHOLDS): SlaState => {
  if (remainingMs === null || !Number.isFinite(remainingMs)) {
    return 'none';
  }
  if (remainingMs < 0) {
    return 'overdue';
  }
  const minutesLeft = toWholeMinutes(remainingMs);
  if (minutesLeft <= thresholds.criticalHours * MINUTES_PER_HOUR) {
    return 'critical';
  }
  if (minutesLeft <= thresholds.warningHours * MINUTES_PER_HOUR) {
    return 'warning';
  }
  return 'onTrack';
};

const isValidDate = (value: Date | null | undefined): value is Date =>
  value instanceof Date && !Number.isNaN(value.getTime());

/** Builds everything the badge needs to render for one moment in time. */
export const computeSla = (
  dueDate: Date | null | undefined,
  now: Date | number,
  thresholds: SlaThresholds = DEFAULT_THRESHOLDS,
): SlaResult => {
  if (!isValidDate(dueDate)) {
    return { state: 'none', text: 'No due date', ariaLabel: 'No due date', remainingMs: null };
  }

  const nowMs = typeof now === 'number' ? now : now.getTime();
  const remainingMs = dueDate.getTime() - nowMs;
  const state = getSlaState(remainingMs, thresholds);
  const wholeMinutes = toWholeMinutes(remainingMs);

  if (state === 'overdue') {
    if (wholeMinutes === 0) {
      return { state, text: 'Overdue', ariaLabel: 'Overdue by less than a minute', remainingMs };
    }
    return {
      state,
      text: `Overdue by ${formatCompact(remainingMs)}`,
      ariaLabel: `Overdue by ${formatLong(remainingMs)}`,
      remainingMs,
    };
  }

  if (wholeMinutes === 0) {
    return { state, text: 'Due now', ariaLabel: `Due now, ${STATE_LABELS[state]}`, remainingMs };
  }

  return {
    state,
    text: `${formatCompact(remainingMs)} left`,
    ariaLabel: `Due in ${formatLong(remainingMs)}, ${STATE_LABELS[state]}`,
    remainingMs,
  };
};
