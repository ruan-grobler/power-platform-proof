import { IInputs, IOutputs } from './generated/ManifestTypes';
import { computeSla, normaliseThresholds, SlaResult, SlaState } from '../src/sla';

/** How often the countdown refreshes. The badge shows whole minutes, so once a minute is enough. */
const TICK_MS = 60_000;

const SVG_NS = 'http://www.w3.org/2000/svg';

const STATE_CLASS: Readonly<Record<SlaState, string>> = {
  onTrack: 'rg-sla--on-track',
  warning: 'rg-sla--warning',
  critical: 'rg-sla--critical',
  overdue: 'rg-sla--overdue',
  none: 'rg-sla--none',
};

const CLOCK_RING = 'M8 1.75a6.25 6.25 0 1 0 0 12.5a6.25 6.25 0 1 0 0-12.5Z';

/**
 * One icon shape per state, so the state never relies on colour alone.
 * Paths are drawn with stroke="currentColor", so each icon inherits the badge's checked text colour.
 */
const STATE_ICON: Readonly<Record<SlaState, readonly string[]>> = {
  onTrack: ['M3.25 8.5 6.5 11.75 12.75 4.75'],
  warning: ['M8 1.75 14.75 13.75H1.25Z', 'M8 6v3.25', 'M8 11.5h.01'],
  critical: [CLOCK_RING, 'M8 4.75v3.75', 'M8 11.25h.01'],
  overdue: [CLOCK_RING, 'M8 4.5V8l2.5 1.75'],
  none: ['M4 8h8'],
};

export class SlaCountdown implements ComponentFramework.StandardControl<IInputs, IOutputs> {
  private context: ComponentFramework.Context<IInputs>;
  private badge: HTMLDivElement;
  private iconHost: HTMLSpanElement;
  private labelEl: HTMLSpanElement;
  private textEl: HTMLSpanElement;
  private announcer: HTMLSpanElement;
  private timerId: number | undefined;
  private renderedState: SlaState | undefined;

  /**
   * Empty constructor.
   */
  constructor() {
    // Empty
  }

  /**
   * Builds the badge once and starts the single refresh interval.
   * @param context The property bag, with the values configured by the maker.
   * @param notifyOutputChanged Not used. The control only reads the bound column, it never writes it.
   * @param state Not used.
   * @param container The empty div the framework gives a standard control.
   */
  public init(
    context: ComponentFramework.Context<IInputs>,
    notifyOutputChanged: () => void,
    state: ComponentFramework.Dictionary,
    container: HTMLDivElement,
  ): void {
    this.context = context;

    this.badge = document.createElement('div');
    this.badge.className = 'rg-sla';
    this.badge.setAttribute('role', 'status');
    this.badge.setAttribute('aria-live', 'polite');
    this.badge.setAttribute('aria-atomic', 'true');

    // The visible parts are hidden from assistive technology. The accessible name (aria-label)
    // always carries the current full sentence, and the announcer below only speaks on a state change,
    // so a screen reader is not interrupted every minute by the countdown ticking.
    this.iconHost = this.createPart('rg-sla__icon');
    this.labelEl = this.createPart('rg-sla__label');
    this.textEl = this.createPart('rg-sla__text');

    this.announcer = document.createElement('span');
    this.announcer.className = 'rg-sla__sr-only';

    this.badge.append(this.iconHost, this.labelEl, this.textEl, this.announcer);
    container.appendChild(this.badge);

    this.timerId = window.setInterval(() => this.onTick(), TICK_MS);
  }

  /**
   * Called when any value in the property bag changes: the bound date, the thresholds, the label,
   * visibility or the disabled state.
   * @param context The latest property bag.
   */
  public updateView(context: ComponentFramework.Context<IInputs>): void {
    this.context = context;
    this.render();
  }

  /**
   * The control is display only, so it never reports a changed value back to the form.
   */
  public getOutputs(): IOutputs {
    return {};
  }

  /**
   * Stops the refresh interval and removes the badge.
   */
  public destroy(): void {
    if (this.timerId !== undefined) {
      window.clearInterval(this.timerId);
      this.timerId = undefined;
    }
    this.badge?.remove();
  }

  private onTick(): void {
    // A state-change announcement lives until the next tick, then is cleared,
    // so someone browsing later hears the current aria-label rather than an old message.
    this.setText(this.announcer, '');
    this.render();
  }

  /** Renders the badge for the current moment. */
  private render(): void {
    const { mode, parameters } = this.context;

    this.badge.hidden = !mode.isVisible;
    if (!mode.isVisible) {
      // Forget the last state so showing the badge again does not announce a stale change.
      this.renderedState = undefined;
      return;
    }

    const thresholds = normaliseThresholds(parameters.warningHours?.raw, parameters.criticalHours?.raw);
    const result = computeSla(parameters.dueDate?.raw, Date.now(), thresholds);
    const label = parameters.label?.raw?.trim() ?? '';
    const sentence = label ? `${label}: ${result.ariaLabel}` : result.ariaLabel;

    const className = `rg-sla ${STATE_CLASS[result.state]}${mode.isControlDisabled ? ' rg-sla--disabled' : ''}`;
    if (this.badge.className !== className) {
      this.badge.className = className;
    }
    if (this.badge.getAttribute('aria-label') !== sentence) {
      this.badge.setAttribute('aria-label', sentence);
    }

    this.labelEl.hidden = label === '';
    this.setText(this.labelEl, label);
    this.setText(this.textEl, result.text);

    if (this.renderedState !== result.state) {
      // Announce transitions such as warning to critical, but not the first paint of the form.
      if (this.renderedState !== undefined) {
        this.announcer.textContent = sentence;
      }
      this.renderIcon(result);
      this.renderedState = result.state;
    }
  }

  private renderIcon(result: SlaResult): void {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.75');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('focusable', 'false');

    for (const d of STATE_ICON[result.state]) {
      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', d);
      svg.appendChild(path);
    }
    this.iconHost.replaceChildren(svg);
  }

  private createPart(className: string): HTMLSpanElement {
    const el = document.createElement('span');
    el.className = className;
    el.setAttribute('aria-hidden', 'true');
    return el;
  }

  /** Only touches the DOM when the value really changed, to keep minute ticks cheap. */
  private setText(el: HTMLElement, value: string): void {
    if (el.textContent !== value) {
      el.textContent = value;
    }
  }
}
