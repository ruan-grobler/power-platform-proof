import { describe, expect, it } from 'vitest';
import {
  computeSla,
  DAY_MS,
  DEFAULT_THRESHOLDS,
  formatCompact,
  formatLong,
  getSlaState,
  HOUR_MS,
  MINUTE_MS,
  normaliseThresholds,
  splitDuration,
} from '../src/sla';

const NOW = new Date('2026-03-02T09:00:00.000Z');
const at = (offsetMs: number): Date => new Date(NOW.getTime() + offsetMs);

describe('splitDuration', () => {
  it('splits into days, hours and minutes', () => {
    expect(splitDuration(2 * DAY_MS + 5 * HOUR_MS + 7 * MINUTE_MS)).toEqual({ days: 2, hours: 5, minutes: 7 });
  });

  it('rounds down partial minutes so time left is never overstated', () => {
    expect(splitDuration(59_999)).toEqual({ days: 0, hours: 0, minutes: 0 });
    expect(splitDuration(MINUTE_MS + 59_999)).toEqual({ days: 0, hours: 0, minutes: 1 });
  });

  it('uses the magnitude of negative durations', () => {
    expect(splitDuration(-(DAY_MS + 2 * HOUR_MS))).toEqual({ days: 1, hours: 2, minutes: 0 });
  });
});

describe('formatCompact', () => {
  it.each([
    [2 * DAY_MS + 5 * HOUR_MS, '2d 5h'],
    [2 * DAY_MS + 5 * HOUR_MS + 59 * MINUTE_MS, '2d 5h'],
    [2 * DAY_MS, '2d'],
    [2 * DAY_MS + 30 * MINUTE_MS, '2d'],
    [3 * HOUR_MS + 12 * MINUTE_MS, '3h 12m'],
    [3 * HOUR_MS, '3h'],
    [45 * MINUTE_MS, '45m'],
    [MINUTE_MS, '1m'],
    [0, '0m'],
  ])('formats %d ms as "%s"', (ms, expected) => {
    expect(formatCompact(ms)).toBe(expected);
  });
});

describe('formatLong', () => {
  it.each([
    [2 * DAY_MS + 5 * HOUR_MS, '2 days 5 hours'],
    [DAY_MS + HOUR_MS, '1 day 1 hour'],
    [DAY_MS, '1 day'],
    [HOUR_MS + MINUTE_MS, '1 hour 1 minute'],
    [3 * HOUR_MS + 12 * MINUTE_MS, '3 hours 12 minutes'],
    [2 * HOUR_MS, '2 hours'],
    [MINUTE_MS, '1 minute'],
    [45 * MINUTE_MS, '45 minutes'],
  ])('formats %d ms as "%s"', (ms, expected) => {
    expect(formatLong(ms)).toBe(expected);
  });
});

describe('normaliseThresholds', () => {
  it('keeps valid values', () => {
    expect(normaliseThresholds(48, 8)).toEqual({ warningHours: 48, criticalHours: 8 });
  });

  it('falls back to the defaults for null, undefined and NaN', () => {
    expect(normaliseThresholds(null, undefined)).toEqual(DEFAULT_THRESHOLDS);
    expect(normaliseThresholds(Number.NaN, Number.POSITIVE_INFINITY)).toEqual(DEFAULT_THRESHOLDS);
  });

  it('clamps negative values to zero', () => {
    expect(normaliseThresholds(-5, -1)).toEqual({ warningHours: 0, criticalHours: 0 });
  });

  it('allows zero, which switches that band off', () => {
    expect(normaliseThresholds(0, 0)).toEqual({ warningHours: 0, criticalHours: 0 });
  });
});

describe('getSlaState with default thresholds (warning 24h, critical 4h)', () => {
  it('returns none for null and non-finite input', () => {
    expect(getSlaState(null)).toBe('none');
    expect(getSlaState(Number.NaN)).toBe('none');
  });

  it('is on track above the warning threshold', () => {
    expect(getSlaState(24 * HOUR_MS + MINUTE_MS)).toBe('onTrack');
    expect(getSlaState(10 * DAY_MS)).toBe('onTrack');
  });

  it('is warning at exactly the warning threshold (inclusive)', () => {
    expect(getSlaState(24 * HOUR_MS)).toBe('warning');
  });

  it('is warning just above the critical threshold', () => {
    expect(getSlaState(4 * HOUR_MS + MINUTE_MS)).toBe('warning');
  });

  it('is critical at exactly the critical threshold (inclusive)', () => {
    expect(getSlaState(4 * HOUR_MS)).toBe('critical');
  });

  it('compares on whole minutes, so 4h 0m 30s still reads as critical "4h left"', () => {
    expect(getSlaState(4 * HOUR_MS + 30_000)).toBe('critical');
    expect(getSlaState(24 * HOUR_MS + 59_999)).toBe('warning');
  });

  it('is critical at exactly the due time', () => {
    expect(getSlaState(0)).toBe('critical');
  });

  it('is overdue one millisecond after the due time', () => {
    expect(getSlaState(-1)).toBe('overdue');
  });
});

describe('getSlaState with custom thresholds', () => {
  it('honours custom bands', () => {
    const thresholds = { warningHours: 72, criticalHours: 12 };
    expect(getSlaState(72 * HOUR_MS, thresholds)).toBe('warning');
    expect(getSlaState(72 * HOUR_MS + MINUTE_MS, thresholds)).toBe('onTrack');
    expect(getSlaState(12 * HOUR_MS, thresholds)).toBe('critical');
  });

  it('lets critical win when it is configured larger than warning', () => {
    const thresholds = { warningHours: 2, criticalHours: 6 };
    expect(getSlaState(HOUR_MS, thresholds)).toBe('critical');
    expect(getSlaState(5 * HOUR_MS, thresholds)).toBe('critical');
    expect(getSlaState(7 * HOUR_MS, thresholds)).toBe('onTrack');
  });

  it('with both thresholds at zero, only the due minute itself is critical', () => {
    const thresholds = { warningHours: 0, criticalHours: 0 };
    expect(getSlaState(30_000, thresholds)).toBe('critical');
    expect(getSlaState(MINUTE_MS, thresholds)).toBe('onTrack');
  });

  it('accepts fractional hours', () => {
    const thresholds = { warningHours: 1, criticalHours: 0.5 };
    expect(getSlaState(30 * MINUTE_MS, thresholds)).toBe('critical');
    expect(getSlaState(31 * MINUTE_MS, thresholds)).toBe('warning');
  });
});

describe('computeSla', () => {
  it('shows a neutral badge when there is no due date', () => {
    for (const value of [null, undefined, new Date(Number.NaN)]) {
      expect(computeSla(value, NOW)).toEqual({
        state: 'none',
        text: 'No due date',
        ariaLabel: 'No due date',
        remainingMs: null,
      });
    }
  });

  it('formats an on-track item', () => {
    expect(computeSla(at(5 * DAY_MS + 3 * HOUR_MS), NOW)).toMatchObject({
      state: 'onTrack',
      text: '5d 3h left',
      ariaLabel: 'Due in 5 days 3 hours, on track',
    });
  });

  it('formats a warning item', () => {
    expect(computeSla(at(20 * HOUR_MS + 5 * MINUTE_MS), NOW)).toMatchObject({
      state: 'warning',
      text: '20h 5m left',
      ariaLabel: 'Due in 20 hours 5 minutes, warning',
    });
  });

  it('formats a critical item', () => {
    expect(computeSla(at(3 * HOUR_MS + 12 * MINUTE_MS), NOW)).toMatchObject({
      state: 'critical',
      text: '3h 12m left',
      ariaLabel: 'Due in 3 hours 12 minutes, critical',
    });
  });

  it('matches the documented warning example', () => {
    const thresholds = { warningHours: 72, criticalHours: 4 };
    expect(computeSla(at(2 * DAY_MS + 5 * HOUR_MS), NOW, thresholds)).toMatchObject({
      state: 'warning',
      text: '2d 5h left',
      ariaLabel: 'Due in 2 days 5 hours, warning',
    });
  });

  it('says "Due now" inside the final minute, including exactly on time', () => {
    expect(computeSla(at(0), NOW)).toMatchObject({ state: 'critical', text: 'Due now', ariaLabel: 'Due now, critical' });
    expect(computeSla(at(59_999), NOW)).toMatchObject({ state: 'critical', text: 'Due now' });
  });

  it('switches to "1m left" at exactly one minute', () => {
    expect(computeSla(at(MINUTE_MS), NOW)).toMatchObject({ text: '1m left', ariaLabel: 'Due in 1 minute, critical' });
  });

  it('marks the first minute after the deadline as overdue without a zero duration', () => {
    expect(computeSla(at(-1), NOW)).toMatchObject({
      state: 'overdue',
      text: 'Overdue',
      ariaLabel: 'Overdue by less than a minute',
    });
  });

  it('formats an overdue item', () => {
    expect(computeSla(at(-(DAY_MS + 2 * HOUR_MS + 10 * MINUTE_MS)), NOW)).toMatchObject({
      state: 'overdue',
      text: 'Overdue by 1d 2h',
      ariaLabel: 'Overdue by 1 day 2 hours',
    });
    expect(computeSla(at(-5 * MINUTE_MS), NOW)).toMatchObject({ text: 'Overdue by 5m', ariaLabel: 'Overdue by 5 minutes' });
  });

  it('accepts a numeric timestamp for now', () => {
    expect(computeSla(at(HOUR_MS), NOW.getTime()).text).toBe('1h left');
  });

  it('reports remaining milliseconds, negative when overdue', () => {
    expect(computeSla(at(HOUR_MS), NOW).remainingMs).toBe(HOUR_MS);
    expect(computeSla(at(-HOUR_MS), NOW).remainingMs).toBe(-HOUR_MS);
  });
});
