// A very small client-side router. Power Pages code sites always serve the
// root page on a hard refresh and let the client router draw the sub-route,
// so plain history.pushState routing is all this app needs.

import { useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent, type ReactElement } from 'react';

export const ROUTES = {
  request: '/',
  myRequests: '/my-requests',
} as const;

const listeners = new Set<() => void>();

const notify = (): void => {
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  window.addEventListener('popstate', listener);
  return (): void => {
    listeners.delete(listener);
    window.removeEventListener('popstate', listener);
  };
};

export const normalisePath = (path: string): string => {
  const clean = path.split(/[?#]/)[0] ?? '/';
  const trimmed = clean.length > 1 ? clean.replace(/\/+$/, '') : clean;
  return trimmed.toLowerCase() || '/';
};

const getPath = (): string => normalisePath(window.location.pathname);

export const navigate = (to: string): void => {
  if (normalisePath(to) !== getPath()) {
    window.history.pushState({}, '', to);
    notify();
  }
};

export const usePath = (): string => useSyncExternalStore(subscribe, getPath, () => '/');

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { to: string };

export const Link = ({ to, onClick, children, ...rest }: LinkProps): ReactElement => {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>): void => {
    onClick?.(event);
    const modified = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
    if (event.defaultPrevented || event.button !== 0 || modified) {
      return;
    }
    event.preventDefault();
    navigate(to);
  };
  return (
    <a href={to} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
};
