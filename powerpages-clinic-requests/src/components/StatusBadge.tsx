import type { ReactElement } from 'react';
import type { RequestStatus } from '../domain/types';

const ICONS: Record<RequestStatus | 'Unknown', ReactElement> = {
  New: <circle cx="8" cy="8" r="4" />,
  Confirmed: <path d="M3.5 8.5l3 3 6-7" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
  Declined: <path d="M4.5 4.5l7 7m0-7l-7 7" fill="none" strokeWidth="2" strokeLinecap="round" />,
  Unknown: <path d="M8 4v5m0 3v.5" fill="none" strokeWidth="2" strokeLinecap="round" />,
};

/** Status pill. The text label always carries the meaning, colour is only a helper. */
export const StatusBadge = ({ status, label }: { status: RequestStatus | 'Unknown'; label: string }): ReactElement => (
  <span className={`badge badge--${status.toLowerCase()}`}>
    <svg className="badge__icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false" fill="currentColor" stroke="currentColor">
      {ICONS[status]}
    </svg>
    {label}
  </span>
);
