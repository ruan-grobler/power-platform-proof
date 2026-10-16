import type { ReactElement } from 'react';
import { Link, ROUTES } from '../router';

export const NotFoundPage = (): ReactElement => (
  <div className="container page">
    <h1 id="page-title" className="page__title" tabIndex={-1}>
      Page not found
    </h1>
    <p>The page you were looking for does not exist.</p>
    <Link className="button button--primary" to={ROUTES.request}>
      Request an appointment
    </Link>
  </div>
);
