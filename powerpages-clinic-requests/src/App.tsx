import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { createBackend } from './api/backend';
import { toFriendlyMessage } from './api/powerPagesClient';
import type { Backend } from './api/types';
import { DemoBanner, SiteFooter, SiteHeader } from './components/SiteChrome';
import type { PortalUser } from './domain/types';
import { MyRequestsPage } from './pages/MyRequestsPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { RequestPage } from './pages/RequestPage';
import { ROUTES, usePath } from './router';

const TITLES: Record<string, string> = {
  [ROUTES.request]: 'Request an appointment',
  [ROUTES.myRequests]: 'My requests',
};

export const App = ({ backend: providedBackend }: { backend?: Backend }): ReactElement => {
  const backend = useMemo(() => providedBackend ?? createBackend(), [providedBackend]);
  const path = usePath();
  const [user, setUser] = useState<PortalUser | null>(() => backend.auth.getUser());
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const firstRender = useRef(true);

  // On each route change: set the tab title and move focus to the new page
  // heading so screen reader users hear that the page changed.
  useEffect(() => {
    document.title = `${TITLES[path] ?? 'Page not found'} | Contoso Clinic`;
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    window.scrollTo({ top: 0 });
    document.getElementById('page-title')?.focus();
  }, [path]);

  const signIn = async (): Promise<void> => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      const signedIn = await backend.auth.signIn(path);
      if (signedIn) {
        setUser(signedIn);
      }
    } catch (error) {
      console.error('Sign-in failed', error);
      setAuthError(toFriendlyMessage(error));
    } finally {
      setAuthBusy(false);
    }
  };

  const signOut = async (): Promise<void> => {
    setAuthBusy(true);
    try {
      await backend.auth.signOut();
      setUser(null);
    } finally {
      setAuthBusy(false);
    }
  };

  const page = ((): ReactElement => {
    switch (path) {
      case ROUTES.request:
        return <RequestPage user={user} requests={backend.requests} />;
      case ROUTES.myRequests:
        return (
          <MyRequestsPage user={user} requests={backend.requests} authBusy={authBusy} onSignIn={(): void => void signIn()} />
        );
      default:
        return <NotFoundPage />;
    }
  })();

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <DemoBanner mode={backend.mode} />
      <SiteHeader
        path={path}
        user={user}
        authBusy={authBusy}
        onSignIn={(): void => void signIn()}
        onSignOut={(): void => void signOut()}
      />
      {authError ? (
        <div className="container">
          <div className="notice notice--error" role="alert">
            <strong>Sign-in did not start.</strong> {authError}
          </div>
        </div>
      ) : null}
      <main id="main" className="main" tabIndex={-1}>
        {page}
      </main>
      <SiteFooter mode={backend.mode} />
    </>
  );
};
