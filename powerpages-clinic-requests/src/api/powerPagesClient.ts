// Minimal client for the Power Pages Web API (/_api/...).
//
// Rules this follows, from Microsoft Learn (Power Pages Web API docs):
// - Every Web API call carries the CSRF token in a __RequestVerificationToken header.
//   SPA (code) sites get the token from /_layout/tokenhtml.
// - Send Accept: application/json, plus Content-Type: application/json when there is a body,
//   and pin OData-MaxVersion / OData-Version to 4.0.
// - The session cookie handles authentication, so there is no Authorization header.
// - Errors come back as { error: { code, message } } where code is a hex value such as 90040103.

export const TOKEN_PATH = '/_layout/tokenhtml';
export const TOKEN_HEADER = '__RequestVerificationToken';

export const WEB_API_ERROR_CODES = {
  attributeNotEnabled: '90040101',
  writePermissionMissing: '90040102',
  createPermissionMissing: '90040103',
  deletePermissionMissing: '90040104',
  appendPermissionMissing: '90040105',
  appendToPermissionMissing: '90040106',
  antiForgeryTokenInvalid: '90040107',
  sessionCookieMissing: '90040109',
  resourceNotFound: '9004010C',
  cdsError: '9004010D',
} as const;

export class PowerPagesApiError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(message: string, status: number, code: string | null = null) {
    super(message);
    this.name = 'PowerPagesApiError';
    this.status = status;
    this.code = code;
  }
}

export interface PostResult {
  entityId: string | null;
}

export interface PowerPagesClient {
  /** Returns the cached CSRF token, fetching it on first use or when forced. */
  getToken: (forceRefresh?: boolean) => Promise<string>;
  get: <T>(path: string, options?: { formattedValues?: boolean }) => Promise<T>;
  post: (path: string, body: unknown) => Promise<PostResult>;
}

export interface PowerPagesClientOptions {
  fetchFn?: typeof fetch;
}

const GUID_IN_TEXT = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;
const HEX_ERROR_CODE = /\b(9004[0-9a-f]{4})\b/i;

/**
 * Pulls the token out of the HTML that /_layout/tokenhtml returns, which is a
 * hidden input like <input name="__RequestVerificationToken" type="hidden" value="..." />.
 * Attribute order does not matter.
 */
export const parseRequestVerificationToken = (html: string): string | null => {
  const inputTag = /<input\b[^>]*\bname=["']__RequestVerificationToken["'][^>]*>/i.exec(html);
  const source = inputTag ? inputTag[0] : html;
  const value = /\bvalue=["']([^"']+)["']/i.exec(source);
  return value && value[1] ? value[1] : null;
};

/** Reads the new record id from the headers of a successful POST. */
export const readEntityId = (headers: Headers): string | null => {
  const direct = headers.get('entityid');
  if (direct && GUID_IN_TEXT.test(direct)) {
    return GUID_IN_TEXT.exec(direct)?.[1] ?? null;
  }
  const location = headers.get('OData-EntityId') ?? headers.get('Location');
  return location ? GUID_IN_TEXT.exec(location)?.[1] ?? null : null;
};

const readErrorBody = async (response: Response): Promise<{ code: string | null; message: string }> => {
  const fallback = `Request failed with status ${response.status}.`;
  try {
    const text = await response.text();
    if (!text) {
      return { code: null, message: fallback };
    }
    const payload = JSON.parse(text) as { error?: { code?: string; message?: string } };
    const message = payload.error?.message || fallback;
    const rawCode = payload.error?.code || HEX_ERROR_CODE.exec(message)?.[1] || null;
    return { code: rawCode ? rawCode.toUpperCase() : null, message };
  } catch {
    return { code: null, message: fallback };
  }
};

const toApiError = async (response: Response): Promise<PowerPagesApiError> => {
  const { code, message } = await readErrorBody(response);
  return new PowerPagesApiError(message, response.status, code);
};

const isTokenRejection = async (response: Response): Promise<boolean> => {
  if (response.status === 401) {
    return true;
  }
  if (response.status !== 403) {
    return false;
  }
  const { code } = await readErrorBody(response.clone());
  return code === WEB_API_ERROR_CODES.antiForgeryTokenInvalid;
};

export const createPowerPagesClient = (options: PowerPagesClientOptions = {}): PowerPagesClient => {
  const fetchFn = options.fetchFn ?? ((input: RequestInfo | URL, init?: RequestInit): Promise<Response> => fetch(input, init));
  let tokenPromise: Promise<string> | null = null;

  const fetchToken = async (): Promise<string> => {
    const response = await fetchFn(TOKEN_PATH, { method: 'GET', credentials: 'same-origin' });
    if (!response.ok) {
      throw new PowerPagesApiError(`Could not get a request verification token (status ${response.status}).`, response.status);
    }
    const token = parseRequestVerificationToken(await response.text());
    if (!token) {
      throw new PowerPagesApiError('The request verification token was missing from the response.', response.status);
    }
    return token;
  };

  const getToken = async (forceRefresh = false): Promise<string> => {
    if (forceRefresh || tokenPromise === null) {
      const pending = fetchToken();
      tokenPromise = pending;
      // Do not cache a failure: the next call should try again.
      pending.catch(() => {
        if (tokenPromise === pending) {
          tokenPromise = null;
        }
      });
    }
    return tokenPromise;
  };

  const buildHeaders = (token: string, hasBody: boolean, formattedValues: boolean): Headers => {
    const headers = new Headers({
      Accept: 'application/json',
      'OData-MaxVersion': '4.0',
      'OData-Version': '4.0',
      [TOKEN_HEADER]: token,
    });
    if (hasBody) {
      headers.set('Content-Type', 'application/json');
    }
    if (formattedValues) {
      headers.set('Prefer', 'odata.include-annotations="OData.Community.Display.V1.FormattedValue"');
    }
    return headers;
  };

  const send = async (
    method: 'GET' | 'POST',
    path: string,
    body: unknown,
    formattedValues: boolean,
  ): Promise<Response> => {
    const attempt = async (token: string): Promise<Response> =>
      fetchFn(path, {
        method,
        credentials: 'same-origin',
        headers: buildHeaders(token, body !== undefined, formattedValues),
        body: body === undefined ? undefined : JSON.stringify(body),
      });

    let response = await attempt(await getToken());
    if (await isTokenRejection(response)) {
      // The token can expire with the session. Fetch a fresh one and try once more.
      response = await attempt(await getToken(true));
    }
    if (!response.ok) {
      throw await toApiError(response);
    }
    return response;
  };

  return {
    getToken,
    get: async <T>(path: string, getOptions: { formattedValues?: boolean } = {}): Promise<T> => {
      const response = await send('GET', path, undefined, getOptions.formattedValues ?? true);
      return (await response.json()) as T;
    },
    post: async (path: string, body: unknown): Promise<PostResult> => {
      const response = await send('POST', path, body, false);
      return { entityId: readEntityId(response.headers) };
    },
  };
};

/** Turns any error from the data layer into a sentence that is safe to show to a patient. */
export const toFriendlyMessage = (error: unknown): string => {
  if (error instanceof PowerPagesApiError) {
    switch (error.code) {
      case WEB_API_ERROR_CODES.createPermissionMissing:
      case WEB_API_ERROR_CODES.appendPermissionMissing:
      case WEB_API_ERROR_CODES.appendToPermissionMissing:
      case WEB_API_ERROR_CODES.attributeNotEnabled:
        return 'We could not save your request because online booking is not fully set up yet. Please call us on 021 555 0100.';
      case WEB_API_ERROR_CODES.antiForgeryTokenInvalid:
      case WEB_API_ERROR_CODES.sessionCookieMissing:
        return 'Your session has expired. Refresh the page and try again.';
      default:
        break;
    }
    if (error.status === 401) {
      return 'Your session has expired. Refresh the page and try again.';
    }
    if (error.status === 403) {
      return 'You do not have access to this information. Try signing out and in again.';
    }
    if (error.status === 404) {
      return 'The appointment service is not available right now. Please call us on 021 555 0100.';
    }
    if (error.status === 429 || error.status >= 500) {
      return 'The service is busy. Wait a minute and try again.';
    }
    return 'Something went wrong. Please try again, or call us on 021 555 0100.';
  }
  if (error instanceof TypeError) {
    return 'We could not reach the clinic. Check your internet connection and try again.';
  }
  return 'Something went wrong. Please try again, or call us on 021 555 0100.';
};
