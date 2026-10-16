import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { toFriendlyMessage } from '../api/powerPagesClient';
import type { RequestsApi } from '../api/types';
import { StatusBadge } from '../components/StatusBadge';
import { formatIsoDate, formatTimestamp } from '../domain/dates';
import { STATUS_DESCRIPTIONS, timeWindowLabel } from '../domain/options';
import type { AppointmentRequest, PortalUser } from '../domain/types';
import { Link, ROUTES } from '../router';

interface MyRequestsPageProps {
  user: PortalUser | null;
  requests: RequestsApi;
  authBusy: boolean;
  onSignIn: () => void;
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; items: AppointmentRequest[] };

const RequestCard = ({ item }: { item: AppointmentRequest }): ReactElement => (
  <li className="request-card">
    <div className="request-card__head">
      <div>
        <h3 className="request-card__title">{formatIsoDate(item.preferredDate)}</h3>
        <p className="request-card__time">{timeWindowLabel(item.timeWindow)}</p>
      </div>
      <StatusBadge status={item.status} label={item.statusLabel} />
    </div>
    <p className="request-card__status-text">{STATUS_DESCRIPTIONS[item.status]}</p>
    <p className="request-card__reason">{item.reason}</p>
    <dl className="request-card__meta">
      <div>
        <dt>Reference</dt>
        <dd className="reference">{item.reference}</dd>
      </div>
      <div>
        <dt>Sent</dt>
        <dd>{formatTimestamp(item.createdOn)}</dd>
      </div>
    </dl>
  </li>
);

export const MyRequestsPage = ({ user, requests, authBusy, onSignIn }: MyRequestsPageProps): ReactElement => {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });

  const load = useCallback(async (signedInUser: PortalUser): Promise<void> => {
    setState({ kind: 'loading' });
    try {
      const items = await requests.listMyRequests(signedInUser);
      setState({ kind: 'ready', items });
    } catch (error) {
      console.error('Loading requests failed', error);
      setState({ kind: 'error', message: toFriendlyMessage(error) });
    }
  }, [requests]);

  useEffect(() => {
    if (user) {
      void load(user);
    }
  }, [user, load]);

  return (
    <div className="container page">
      <div className="page__head">
        <h1 id="page-title" className="page__title" tabIndex={-1}>
          My requests
        </h1>
        {user ? (
          <Link className="button button--secondary" to={ROUTES.request}>
            New request
          </Link>
        ) : null}
      </div>

      {!user ? (
        <section className="card signin-card" aria-labelledby="signin-title">
          <h2 id="signin-title">Sign in to see your requests</h2>
          <p>
            Signed-in patients can see every request they have sent and whether it is new, confirmed or declined.
          </p>
          <p className="muted">
            Requests sent without signing in are still received by the clinic, but cannot be shown here.
          </p>
          <div className="actions">
            <button type="button" className="button button--primary" onClick={onSignIn} disabled={authBusy}>
              {authBusy ? 'Signing in' : 'Sign in'}
            </button>
          </div>
        </section>
      ) : null}

      {user && state.kind === 'loading' ? (
        <div className="card loading" role="status" aria-live="polite">
          <span className="spinner spinner--dark" aria-hidden="true" />
          Loading your requests
        </div>
      ) : null}

      {user && state.kind === 'error' ? (
        <div className="notice notice--error" role="alert">
          <p>
            <strong>We could not load your requests.</strong> {state.message}
          </p>
          <button type="button" className="button button--secondary" onClick={(): void => void load(user)}>
            Try again
          </button>
        </div>
      ) : null}

      {user && state.kind === 'ready' && state.items.length === 0 ? (
        <section className="card empty" aria-labelledby="empty-title">
          <h2 id="empty-title">No requests yet</h2>
          <p>When you send a request while signed in, it appears here with its status.</p>
          <Link className="button button--primary" to={ROUTES.request}>
            Request an appointment
          </Link>
        </section>
      ) : null}

      {user && state.kind === 'ready' && state.items.length > 0 ? (
        <>
          <p className="page__lead" role="status">
            You have {state.items.length} {state.items.length === 1 ? 'request' : 'requests'}. Newest first.
          </p>
          <ul className="request-list">
            {state.items.map((item) => (
              <RequestCard key={item.id} item={item} />
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
};
