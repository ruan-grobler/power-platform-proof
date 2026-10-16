// Sign-in, sign-out and user details on a real Power Pages site.
//
// Power Pages adds window["Microsoft"].Dynamic365.Portal to the page. When a
// user is signed in, Portal.User holds their contact details. Sign-in posts a
// form to /Account/Login/ExternalLogin with the CSRF token and the identity
// provider, as shown in the Microsoft Learn SPA sample.

import type { AuthApi } from '../api/types';
import type { PowerPagesClient } from '../api/powerPagesClient';
import type { PortalUser } from '../domain/types';

const LOGIN_PATH = '/Account/Login/ExternalLogin';
const LOGOFF_PATH = '/Account/Login/LogOff';

export const readPortalUser = (portal: PowerPagesPortal | undefined): PortalUser | null => {
  const user = portal?.User;
  const userName = user?.userName ?? '';
  const contactId = user?.contactId ?? '';
  // The Learn sample treats an empty userName as "signed out". We also need a
  // contact id, because requests are linked to the contact.
  if (!user || userName === '' || contactId === '') {
    return null;
  }
  return {
    contactId,
    userName,
    firstName: user.firstName ?? '',
    lastName: user.lastName ?? '',
    email: user.email ?? '',
  };
};

/**
 * The provider value posted to ExternalLogin. Defaults to the site's
 * Microsoft Entra ID provider. Set VITE_LOGIN_PROVIDER at build time to use a
 * different provider, for example an Entra External ID authority.
 */
export const resolveLoginProvider = (portal: PowerPagesPortal | undefined, override: string | undefined): string => {
  if (override && override.trim() !== '') {
    return override.trim();
  }
  const tenant = portal?.tenant ?? '';
  return `https://login.windows.net/${tenant}/`;
};

const submitHiddenForm = (action: string, fields: Record<string, string>): void => {
  const form = document.createElement('form');
  form.method = 'post';
  form.action = action;
  form.hidden = true;
  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
};

export const createPowerPagesAuth = (client: PowerPagesClient, win: Window = window): AuthApi => ({
  getUser: (): PortalUser | null => readPortalUser(win.Microsoft?.Dynamic365?.Portal),
  signIn: async (returnPath: string): Promise<PortalUser | null> => {
    const token = await client.getToken();
    submitHiddenForm(`${LOGIN_PATH}?returnUrl=${encodeURIComponent(returnPath)}`, {
      __RequestVerificationToken: token,
      provider: resolveLoginProvider(win.Microsoft?.Dynamic365?.Portal, import.meta.env.VITE_LOGIN_PROVIDER),
      returnUrl: returnPath,
    });
    return null;
  },
  signOut: async (): Promise<void> => {
    win.location.assign(`${LOGOFF_PATH}?returnUrl=${encodeURIComponent('/')}`);
  },
});
