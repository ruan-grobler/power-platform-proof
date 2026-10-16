// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IInputs } from '../SlaCountdown/generated/ManifestTypes';
import { SlaCountdown } from '../SlaCountdown/index';
import { HOUR_MS, MINUTE_MS } from '../src/sla';

interface FakeInputs {
  dueDate?: Date | null;
  warningHours?: number | null;
  criticalHours?: number | null;
  label?: string | null;
  isVisible?: boolean;
  isControlDisabled?: boolean;
}

const NOW = new Date('2026-03-02T09:00:00.000Z');
const at = (offsetMs: number): Date => new Date(NOW.getTime() + offsetMs);

/** Just enough of the PCF context for this control: mode flags and the four manifest properties. */
const makeContext = (inputs: FakeInputs = {}): ComponentFramework.Context<IInputs> =>
  ({
    mode: {
      isVisible: inputs.isVisible ?? true,
      isControlDisabled: inputs.isControlDisabled ?? false,
    },
    parameters: {
      dueDate: { raw: inputs.dueDate ?? null },
      warningHours: { raw: inputs.warningHours ?? null },
      criticalHours: { raw: inputs.criticalHours ?? null },
      label: { raw: inputs.label ?? null },
    },
  }) as unknown as ComponentFramework.Context<IInputs>;

describe('SlaCountdown control', () => {
  let container: HTMLDivElement;
  let control: SlaCountdown;

  const mount = (inputs: FakeInputs = {}): void => {
    const context = makeContext(inputs);
    control.init(context, () => undefined, {}, container);
    control.updateView(context);
  };

  const badge = (): HTMLElement => container.querySelector<HTMLElement>('.rg-sla') as HTMLElement;
  const visibleText = (): string => badge().querySelector('.rg-sla__text')?.textContent ?? '';
  const announcement = (): string => badge().querySelector('.rg-sla__sr-only')?.textContent ?? '';

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    container = document.createElement('div');
    document.body.appendChild(container);
    control = new SlaCountdown();
  });

  afterEach(() => {
    control.destroy();
    container.remove();
    vi.useRealTimers();
  });

  it('renders an accessible status badge', () => {
    mount({ dueDate: at(3 * HOUR_MS + 12 * MINUTE_MS) });

    expect(badge().getAttribute('role')).toBe('status');
    expect(badge().getAttribute('aria-live')).toBe('polite');
    expect(badge().getAttribute('aria-label')).toBe('Due in 3 hours 12 minutes, critical');
    expect(badge().classList.contains('rg-sla--critical')).toBe(true);
    expect(visibleText()).toBe('3h 12m left');
    expect(badge().querySelector('svg')).not.toBeNull();
  });

  it('shows a neutral badge when the column is empty', () => {
    mount({ dueDate: null });

    expect(visibleText()).toBe('No due date');
    expect(badge().getAttribute('aria-label')).toBe('No due date');
    expect(badge().classList.contains('rg-sla--none')).toBe(true);
  });

  it('prefixes the optional label visually and in the spoken sentence', () => {
    mount({ dueDate: at(30 * HOUR_MS), label: '  Approval SLA ' });

    const label = badge().querySelector<HTMLElement>('.rg-sla__label');
    expect(label?.hidden).toBe(false);
    expect(label?.textContent).toBe('Approval SLA');
    expect(badge().getAttribute('aria-label')).toBe('Approval SLA: Due in 1 day 6 hours, on track');
  });

  it('uses the configured thresholds', () => {
    mount({ dueDate: at(30 * HOUR_MS), warningHours: 48, criticalHours: 8 });

    expect(badge().classList.contains('rg-sla--warning')).toBe(true);
  });

  it('keeps exactly one interval, however often the framework calls updateView', () => {
    mount({ dueDate: at(HOUR_MS * 10) });
    control.updateView(makeContext({ dueDate: at(HOUR_MS * 9) }));
    control.updateView(makeContext({ dueDate: at(HOUR_MS * 8) }));

    expect(vi.getTimerCount()).toBe(1);
  });

  it('re-renders every 60 seconds and announces only the state change', () => {
    mount({ dueDate: at(4 * HOUR_MS + 2 * MINUTE_MS) });
    expect(visibleText()).toBe('4h 2m left');
    expect(announcement()).toBe('');

    vi.advanceTimersByTime(MINUTE_MS);
    expect(visibleText()).toBe('4h 1m left');
    expect(badge().classList.contains('rg-sla--warning')).toBe(true);
    expect(announcement()).toBe('');

    vi.advanceTimersByTime(MINUTE_MS);
    expect(visibleText()).toBe('4h left');
    expect(badge().classList.contains('rg-sla--critical')).toBe(true);
    expect(announcement()).toBe('Due in 4 hours, critical');

    vi.advanceTimersByTime(MINUTE_MS);
    expect(visibleText()).toBe('3h 59m left');
    expect(announcement()).toBe('');
    expect(badge().getAttribute('aria-label')).toBe('Due in 3 hours 59 minutes, critical');
  });

  it('flips to overdue on the tick after the deadline passes', () => {
    mount({ dueDate: at(30_000) });
    expect(visibleText()).toBe('Due now');

    vi.advanceTimersByTime(MINUTE_MS);
    expect(visibleText()).toBe('Overdue');
    expect(badge().classList.contains('rg-sla--overdue')).toBe(true);
    expect(announcement()).toBe('Overdue by less than a minute');
  });

  it('hides itself when the framework marks it not visible', () => {
    mount({ dueDate: at(HOUR_MS), isVisible: false });
    expect(badge().hidden).toBe(true);

    control.updateView(makeContext({ dueDate: at(HOUR_MS), isVisible: true }));
    expect(badge().hidden).toBe(false);
    expect(announcement()).toBe('');
  });

  it('marks the disabled state without dropping the SLA colours', () => {
    mount({ dueDate: at(HOUR_MS), isControlDisabled: true });

    expect(badge().classList.contains('rg-sla--disabled')).toBe(true);
    expect(badge().classList.contains('rg-sla--critical')).toBe(true);
  });

  it('clears the interval and removes the badge in destroy()', () => {
    mount({ dueDate: at(HOUR_MS) });
    expect(vi.getTimerCount()).toBe(1);

    control.destroy();

    expect(vi.getTimerCount()).toBe(0);
    expect(container.querySelector('.rg-sla')).toBeNull();
  });
});
