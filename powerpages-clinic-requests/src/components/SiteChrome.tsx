import type { ReactElement } from 'react';
import type { BackendMode } from '../api/types';
import type { PortalUser } from '../domain/types';
import { Link, ROUTES } from '../router';

interface SiteHeaderProps {
  path: string;
  user: PortalUser | null;
  authBusy: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
}

const NAV_ITEMS = [
  { to: ROUTES.request, label: 'Request an appointment' },
  { to: ROUTES.myRequests, label: 'My requests' },
] as const;

export const Logo = (): ReactElement => (
  <svg className="brand__mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
    <rect width="32" height="32" rx="8" fill="currentColor" />
    <path d="M13 7h6v6h6v6h-6v6h-6v-6H7v-6h6z" fill="#ffffff" />
  </svg>
);

export const SiteHeader = ({ path, user, authBusy, onSignIn, onSignOut }: SiteHeaderProps): ReactElement => (
  <header className="site-header">
    <div className="container site-header__inner">
      <Link to={ROUTES.request} className="brand" aria-label="Contoso Clinic home">
        <Logo />
        <span className="brand__text">
          <span className="brand__name">Contoso Clinic</span>
          <span className="brand__tag">Family practice</span>
        </span>
      </Link>
      <nav className="site-nav" aria-label="Main">
        <ul>
          {NAV_ITEMS.map((item) => (
            <li key={item.to}>
              <Link to={item.to} className="site-nav__link" aria-current={path === item.to ? 'page' : undefined}>
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="account">
        {user ? (
          <>
            <span className="account__name">
              <span className="visually-hidden">Signed in as </span>
              {user.firstName || user.userName}
            </span>
            <button type="button" className="button button--ghost" onClick={onSignOut} disabled={authBusy}>
              Sign out
            </button>
          </>
        ) : (
          <button type="button" className="button button--ghost" onClick={onSignIn} disabled={authBusy}>
            {authBusy ? 'Signing in' : 'Sign in'}
          </button>
        )}
      </div>
    </div>
  </header>
);

export const DemoBanner = ({ mode }: { mode: BackendMode }): ReactElement | null =>
  mode === 'mock' ? (
    <div className="demo-banner" role="note">
      <div className="container">
        <strong>Demo mode.</strong> Sample data stays in this browser. On a Power Pages site the same screens use the
        Dataverse Web API.
      </div>
    </div>
  ) : null;

export const SiteFooter = ({ mode }: { mode: BackendMode }): ReactElement => (
  <footer className="site-footer">
    <div className="container site-footer__inner">
      <div>
        <p className="site-footer__name">Contoso Clinic</p>
        <p>12 Example Road, Cape Town. Phone 021 555 0100.</p>
        <p>Monday to Saturday, 08:00 to 18:00. Closed on Sundays and public holidays.</p>
      </div>
      <div className="site-footer__meta">
        <p>Contoso Clinic is a fictional clinic used for demonstration.</p>
        <p>
          Built as a Power Pages code site with React, Vite and TypeScript. Data:{' '}
          {mode === 'mock' ? 'offline demo adapter' : 'Power Pages Web API (Dataverse)'}.
        </p>
      </div>
    </div>
  </footer>
);
