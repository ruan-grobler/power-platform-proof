import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactElement } from 'react';
import { toFriendlyMessage } from '../api/powerPagesClient';
import type { RequestsApi } from '../api/types';
import { CONSENT_TEXT, PRIVACY_POINTS } from '../domain/consent';
import { formatIsoDate } from '../domain/dates';
import { TIME_WINDOWS, timeWindowLabel } from '../domain/options';
import type { AppointmentRequestInput, NormalisedAppointmentRequest, PortalUser } from '../domain/types';
import {
  FIELD_ORDER,
  LIMITS,
  formatPhoneForDisplay,
  getDateBounds,
  validateAppointmentRequest,
  validateField,
  type FieldName,
  type ValidationErrors,
} from '../domain/validation';
import { Link, ROUTES } from '../router';
import { ErrorSummary } from './ErrorSummary';
import { FieldError, TextAreaField, TextField, describedBy } from './FormFields';

interface AppointmentFormProps {
  user: PortalUser | null;
  requests: RequestsApi;
}

interface Receipt {
  reference: string;
  request: NormalisedAppointmentRequest;
}

const initialValues = (user: PortalUser | null): AppointmentRequestInput => ({
  fullName: user ? `${user.firstName} ${user.lastName}`.trim() : '',
  phone: '',
  email: user?.email ?? '',
  preferredDate: '',
  timeWindow: '',
  reason: '',
  popiaConsent: false,
});

/** Where focus goes for each field when its error summary link is used. */
const targetId = (field: FieldName): string => (field === 'timeWindow' ? `timeWindow-${TIME_WINDOWS[0]?.value ?? 'morning'}` : field);

export const AppointmentForm = ({ user, requests }: AppointmentFormProps): ReactElement => {
  const today = useMemo(() => new Date(), []);
  const bounds = useMemo(() => getDateBounds(today), [today]);
  const [values, setValues] = useState<AppointmentRequestInput>(() => initialValues(user));
  const [errors, setErrors] = useState<ValidationErrors>({});
  // The summary shows the problems found at the last submit. Inline errors update as you type.
  const [summaryErrors, setSummaryErrors] = useState<ValidationErrors>({});
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({});
  const [submitAttempts, setSubmitAttempts] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const successRef = useRef<HTMLHeadingElement>(null);
  const submitErrorRef = useRef<HTMLDivElement>(null);

  // Prefill name and email once the user signs in, without overwriting typing.
  useEffect(() => {
    if (!user) {
      return;
    }
    setValues((current) => ({
      ...current,
      fullName: current.fullName || `${user.firstName} ${user.lastName}`.trim(),
      email: current.email || user.email,
    }));
  }, [user]);

  useEffect(() => {
    if (submitAttempts > 0) {
      summaryRef.current?.focus();
    }
  }, [submitAttempts]);

  useEffect(() => {
    if (receipt) {
      successRef.current?.focus();
    }
  }, [receipt]);

  useEffect(() => {
    if (submitError) {
      submitErrorRef.current?.focus();
    }
  }, [submitError]);

  const revalidate = (name: FieldName, next: AppointmentRequestInput): void => {
    setErrors((current) => ({ ...current, [name]: validateField(name, next, today) }));
  };

  const setField = <K extends FieldName>(name: K, value: AppointmentRequestInput[K]): void => {
    const next = { ...values, [name]: value };
    setValues(next);
    // Only re-check while typing once the person has left the field or tried to submit.
    if (touched[name] || submitAttempts > 0) {
      revalidate(name, next);
    }
  };

  const blurField = (name: FieldName): void => {
    setTouched((current) => ({ ...current, [name]: true }));
    revalidate(name, values);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (submitting) {
      return;
    }
    setSubmitError(null);
    const result = validateAppointmentRequest(values, today);
    if (!result.ok) {
      setErrors(result.errors);
      setSummaryErrors(result.errors);
      setSubmitAttempts((count) => count + 1);
      return;
    }
    setErrors({});
    setSummaryErrors({});
    setSubmitting(true);
    try {
      const saved = await requests.submitRequest(result.value, user);
      setReceipt({ reference: saved.reference, request: result.value });
    } catch (error) {
      console.error('Appointment request failed', error);
      setSubmitError(toFriendlyMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const startAgain = (): void => {
    setValues(initialValues(user));
    setErrors({});
    setSummaryErrors({});
    setTouched({});
    setSubmitAttempts(0);
    setSubmitError(null);
    setReceipt(null);
  };

  if (receipt) {
    const { request, reference } = receipt;
    return (
      <section className="card success" aria-labelledby="success-title">
        <div className="success__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </div>
        <h2 id="success-title" className="success__title" ref={successRef} tabIndex={-1}>
          Request received
        </h2>
        <p className="success__lead">
          Thank you, {request.fullName.split(' ')[0]}. Your reference is <strong className="reference">{reference}</strong>.
        </p>
        <p>
          We will call you on <strong>{formatPhoneForDisplay(request.phone)}</strong> within one working day to confirm a time.
          This is a request, not a booking, until we confirm it.
        </p>
        <dl className="summary-list">
          <div>
            <dt>Preferred date</dt>
            <dd>{formatIsoDate(request.preferredDate)}</dd>
          </div>
          <div>
            <dt>Preferred time</dt>
            <dd>{timeWindowLabel(request.timeWindow)}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{request.email}</dd>
          </div>
        </dl>
        <div className="actions">
          {user ? (
            <Link className="button button--primary" to={ROUTES.myRequests}>
              View my requests
            </Link>
          ) : (
            <p className="muted">Sign in next time to track your requests online.</p>
          )}
          <button type="button" className="button button--secondary" onClick={startAgain}>
            Make another request
          </button>
        </div>
      </section>
    );
  }

  const timeWindowHasError = Boolean(errors.timeWindow);
  const consentHasError = Boolean(errors.popiaConsent);

  return (
    <form className="card form" noValidate onSubmit={handleSubmit} aria-labelledby="form-title" aria-busy={submitting}>
      <h2 id="form-title" className="form__title">
        Request an appointment
      </h2>
      <p className="form__intro">All fields are required. It takes about two minutes.</p>

      {submitAttempts > 0 ? <ErrorSummary ref={summaryRef} errors={summaryErrors} order={FIELD_ORDER} targetId={targetId} /> : null}

      {submitError ? (
        <div className="notice notice--error" role="alert" tabIndex={-1} ref={submitErrorRef}>
          <strong>Your request was not sent.</strong> {submitError}
        </div>
      ) : null}

      <TextField
        id="fullName"
        label="Full name"
        autoComplete="name"
        value={values.fullName}
        error={errors.fullName}
        maxLength={LIMITS.nameMax}
        onChange={(value): void => setField('fullName', value)}
        onBlur={(): void => blurField('fullName')}
      />

      <div className="form__row">
        <TextField
          id="phone"
          label="Phone number"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          hint="For example 082 555 0134"
          value={values.phone}
          error={errors.phone}
          maxLength={20}
          onChange={(value): void => setField('phone', value)}
          onBlur={(): void => blurField('phone')}
        />
        <TextField
          id="email"
          label="Email address"
          type="email"
          inputMode="email"
          autoComplete="email"
          hint="We send your confirmation here"
          value={values.email}
          error={errors.email}
          maxLength={LIMITS.emailMax}
          onChange={(value): void => setField('email', value)}
          onBlur={(): void => blurField('email')}
        />
      </div>

      <TextField
        id="preferredDate"
        label="Preferred date"
        type="date"
        hint={`Monday to Saturday, from tomorrow up to ${LIMITS.maxDaysAhead} days ahead`}
        min={bounds.min}
        max={bounds.max}
        width="medium"
        value={values.preferredDate}
        error={errors.preferredDate}
        onChange={(value): void => setField('preferredDate', value)}
        onBlur={(): void => blurField('preferredDate')}
      />

      <fieldset
        className={`field fieldset${timeWindowHasError ? ' field--error' : ''}`}
        aria-describedby={describedBy('timeWindow', true, timeWindowHasError)}
      >
        <legend className="field__label">Preferred time of day</legend>
        <p id="timeWindow-hint" className="field__hint">
          We will do our best to match it.
        </p>
        <FieldError id="timeWindow" message={errors.timeWindow} />
        <div className="choices">
          {TIME_WINDOWS.map((option) => (
            <label key={option.value} className="choice" htmlFor={`timeWindow-${option.value}`}>
              <input
                id={`timeWindow-${option.value}`}
                type="radio"
                name="timeWindow"
                value={option.value}
                checked={values.timeWindow === option.value}
                aria-invalid={timeWindowHasError ? true : undefined}
                onChange={(): void => setField('timeWindow', option.value)}
                onBlur={(): void => {
                  setTouched((current) => ({ ...current, timeWindow: true }));
                }}
              />
              <span className="choice__text">
                <span className="choice__label">{option.label}</span>
                <span className="visually-hidden">, </span>
                <span className="choice__hours">{option.hours}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <TextAreaField
        id="reason"
        label="Reason for your visit"
        hint="A sentence or two is enough. You do not need to share your full medical history."
        value={values.reason}
        error={errors.reason}
        maxLength={LIMITS.reasonMax}
        onChange={(value): void => setField('reason', value)}
        onBlur={(): void => blurField('reason')}
      />

      <div className={`field consent${consentHasError ? ' field--error' : ''}`}>
        <FieldError id="popiaConsent" message={errors.popiaConsent} />
        <div className="consent__row">
          <input
            id="popiaConsent"
            name="popiaConsent"
            type="checkbox"
            className="checkbox"
            required
            checked={values.popiaConsent}
            aria-invalid={consentHasError ? true : undefined}
            aria-describedby={describedBy('popiaConsent', false, consentHasError)}
            onChange={(event): void => setField('popiaConsent', event.target.checked)}
          />
          <label htmlFor="popiaConsent" className="consent__label">
            {CONSENT_TEXT}
          </label>
        </div>
        <details className="privacy">
          <summary>How we look after your information (POPIA)</summary>
          <ul>
            {PRIVACY_POINTS.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </details>
      </div>

      <div className="actions">
        <button type="submit" className="button button--primary button--large" disabled={submitting}>
          {submitting ? (
            <>
              <span className="spinner" aria-hidden="true" />
              Sending your request
            </>
          ) : (
            'Send request'
          )}
        </button>
        <p className="muted small" aria-live="polite">
          {submitting ? 'Sending your request, please wait.' : ''}
        </p>
      </div>
    </form>
  );
};
