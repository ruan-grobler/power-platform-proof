// Globals that Power Pages adds to every page it serves.
// Documented in "Create and deploy a single-page application in Power Pages"
// (window["Microsoft"].Dynamic365.Portal.User and .tenant).

interface PowerPagesPortalUser {
  userName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  contactId?: string;
  userRoles?: string[];
}

interface PowerPagesPortal {
  User?: PowerPagesPortalUser;
  tenant?: string;
  version?: string;
  id?: string;
}

interface Window {
  Microsoft?: {
    Dynamic365?: {
      Portal?: PowerPagesPortal;
    };
  };
}

interface ImportMetaEnv {
  /** "auto" (default), "mock" or "powerpages". */
  readonly VITE_DATA_ADAPTER?: string;
  /** Overrides the sign-in provider sent to /Account/Login/ExternalLogin. */
  readonly VITE_LOGIN_PROVIDER?: string;
}
