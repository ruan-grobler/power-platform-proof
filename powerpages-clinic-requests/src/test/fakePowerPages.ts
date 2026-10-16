// A tiny in-memory fake of the Power Pages endpoints this app calls, so the
// real API client can be tested end to end without a network or a tenant.
//
// It implements:
//   GET  /_layout/tokenhtml           returns the hidden token input
//   POST /_api/cr_appointmentrequests creates a row, 204 + entityid header
//   GET  /_api/cr_appointmentrequests lists rows for the contact in $filter
// and enforces the token header like the real Web API does.

export interface RecordedCall {
  method: string;
  url: string;
  headers: Headers;
  body: unknown;
}

export interface FakePowerPagesOptions {
  /** Tokens handed out in order. The last one repeats. */
  tokens?: string[];
  /** Respond to the next N Web API calls with this error. */
  failNext?: { status: number; code: string; message: string; times?: number };
  /** Token that the fake currently accepts. Defaults to the latest token issued. */
  acceptToken?: () => string | null;
}

export interface FakePowerPages {
  fetch: typeof fetch;
  calls: RecordedCall[];
  rows: Record<string, unknown>[];
  tokenRequests: () => number;
  setFailNext: (failure: FakePowerPagesOptions['failNext']) => void;
}

const json = (status: number, body: unknown, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

export const createFakePowerPages = (options: FakePowerPagesOptions = {}): FakePowerPages => {
  const tokens = options.tokens ?? ['token-1'];
  const calls: RecordedCall[] = [];
  const rows: Record<string, unknown>[] = [];
  let issued = 0;
  let latestToken: string | null = null;
  let failNext = options.failNext ? { times: 1, ...options.failNext } : null;
  let idCounter = 0;

  const fakeFetch = async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const method = (init.method ?? 'GET').toUpperCase();
    const headers = new Headers(init.headers);
    const body = typeof init.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined;
    calls.push({ method, url, headers, body });

    if (url === '/_layout/tokenhtml') {
      const token = tokens[Math.min(issued, tokens.length - 1)] ?? 'token';
      issued += 1;
      latestToken = token;
      return new Response(`<input name="__RequestVerificationToken" type="hidden" value="${token}" />`, {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      });
    }

    if (!url.startsWith('/_api/')) {
      return new Response('Not found', { status: 404 });
    }

    const accepted = options.acceptToken ? options.acceptToken() : latestToken;
    if (headers.get('__RequestVerificationToken') !== accepted) {
      return json(403, { error: { code: '90040107', message: 'The anti-forgery cookie token and form field token do not match.' } });
    }

    if (failNext && failNext.times > 0) {
      failNext.times -= 1;
      const failure = failNext;
      if (failNext.times === 0) {
        failNext = null;
      }
      return json(failure.status, { error: { code: failure.code, message: failure.message } });
    }

    const [path, query = ''] = url.split('?');
    if (path !== '/_api/cr_appointmentrequests') {
      return json(404, { error: { code: '9004010C', message: `Resource not found for the segment '${path}'.` } });
    }

    if (method === 'POST') {
      idCounter += 1;
      const id = `00000000-0000-4000-8000-${String(idCounter).padStart(12, '0')}`;
      const record = body as Record<string, unknown>;
      const bind = record['cr_Contact@odata.bind'];
      const contactId = typeof bind === 'string' ? /\(([^)]+)\)/.exec(bind)?.[1] ?? null : null;
      rows.push({
        ...record,
        cr_appointmentrequestid: id,
        _cr_contact_value: contactId,
        cr_status: 100000000,
        'cr_status@OData.Community.Display.V1.FormattedValue': 'New',
        createdon: new Date(Date.UTC(2026, 9, 16, 8, idCounter)).toISOString(),
      });
      return new Response(null, {
        status: 204,
        headers: {
          entityid: id,
          'OData-EntityId': `https://contoso.powerappsportals.com/_api/cr_appointmentrequests(${id})`,
        },
      });
    }

    if (method === 'GET') {
      const filter = decodeURIComponent(/\$filter=([^&]*)/.exec(query)?.[1] ?? '');
      const contactId = /_cr_contact_value eq ([0-9a-f-]+)/i.exec(filter)?.[1] ?? null;
      const value = rows
        .filter((row) => contactId !== null && row._cr_contact_value === contactId)
        .sort((a, b) => String(b.createdon).localeCompare(String(a.createdon)));
      return json(200, { value });
    }

    return json(405, { error: { code: '', message: 'Method not allowed.' } });
  };

  return {
    fetch: fakeFetch as typeof fetch,
    calls,
    rows,
    tokenRequests: (): number => issued,
    setFailNext: (failure): void => {
      failNext = failure ? { times: 1, ...failure } : null;
    },
  };
};
