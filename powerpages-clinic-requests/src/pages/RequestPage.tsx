import type { ReactElement } from 'react';
import type { RequestsApi } from '../api/types';
import { AppointmentForm } from '../components/AppointmentForm';
import type { PortalUser } from '../domain/types';

interface RequestPageProps {
  user: PortalUser | null;
  requests: RequestsApi;
}

const STEPS: readonly { title: string; text: string }[] = [
  { title: 'Send your request', text: 'Tell us when suits you and why you would like to come in.' },
  { title: 'We call you back', text: 'A receptionist calls within one working day to agree a time.' },
  { title: 'Track it online', text: 'Signed-in patients see every request and its status under My requests.' },
];

export const RequestPage = ({ user, requests }: RequestPageProps): ReactElement => (
  <>
    <section className="hero" aria-labelledby="page-title">
      <div className="container hero__inner">
        <p className="hero__eyebrow">Contoso Clinic, Cape Town</p>
        <h1 id="page-title" className="hero__title" tabIndex={-1}>
          See a doctor without waiting on hold
        </h1>
        <p className="hero__lead">
          Request an appointment online in about two minutes. We confirm every request by phone within one working day.
        </p>
        <ul className="hero__facts">
          <li>No account needed</li>
          <li>Open Monday to Saturday</li>
          <li>Your details are protected under POPIA</li>
        </ul>
      </div>
    </section>

    <div className="container layout">
      <AppointmentForm user={user} requests={requests} />
      <aside className="aside" aria-labelledby="next-title">
        <h2 id="next-title" className="aside__title">
          What happens next
        </h2>
        <ol className="steps">
          {STEPS.map((step) => (
            <li key={step.title} className="steps__item">
              <span className="steps__title">{step.title}</span>
              <span className="steps__text">{step.text}</span>
            </li>
          ))}
        </ol>
        <div className="notice notice--warning">
          <strong>Emergency?</strong> Do not use this form. Call 10177 or 112 from a mobile.
        </div>
      </aside>
    </div>
  </>
);
