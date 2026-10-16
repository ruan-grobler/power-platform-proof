import { describe, expect, it } from 'vitest';
import { createFakePowerPages } from '../test/fakePowerPages';
import {
  PowerPagesApiError,
  createPowerPagesClient,
  parseRequestVerificationToken,
  readEntityId,
  toFriendlyMessage,
} from './powerPagesClient';

describe('parseRequestVerificationToken', () => {
  it('reads the token from the hidden input', () => {
    expect(parseRequestVerificationToken('<input name="__RequestVerificationToken" type="hidden" value="abc123" />')).toBe(
      'abc123',
    );
  });

  it('does not depend on attribute order or quote style', () => {
    expect(parseRequestVerificationToken("<input type='hidden' value='x-Y_z' name='__RequestVerificationToken'>")).toBe('x-Y_z');
  });

  it('returns null when there is no token', () => {
    expect(parseRequestVerificationToken('<html><body>Sign in</body></html>')).toBeNull();
  });
});

describe('readEntityId', () => {
  const id = '6f1c2d3e-4a5b-4c6d-8e7f-901a2b3c4d5e';

  it('prefers the entityid header', () => {
    expect(readEntityId(new Headers({ entityid: id }))).toBe(id);
  });

  it('falls back to OData-EntityId', () => {
    expect(readEntityId(new Headers({ 'OData-EntityId': `https://site/_api/cr_appointmentrequests(${id})` }))).toBe(id);
  });

  it('returns null when neither header is present', () => {
    expect(readEntityId(new Headers())).toBeNull();
  });
});

describe('createPowerPagesClient', () => {
  it('fetches the token once and sends it with the documented headers', async () => {
    const fake = createFakePowerPages({ tokens: ['first-token'] });
    const client = createPowerPagesClient({ fetchFn: fake.fetch });

    const result = await client.post('/_api/cr_appointmentrequests', { cr_name: 'Test' });
    await client.get('/_api/cr_appointmentrequests?$select=cr_name');

    expect(fake.tokenRequests()).toBe(1);
    expect(result.entityId).toMatch(/^[0-9a-f-]{36}$/);

    const post = fake.calls.find((call) => call.method === 'POST');
    expect(post?.headers.get('__RequestVerificationToken')).toBe('first-token');
    expect(post?.headers.get('Accept')).toBe('application/json');
    expect(post?.headers.get('Content-Type')).toBe('application/json');
    expect(post?.headers.get('OData-MaxVersion')).toBe('4.0');
    expect(post?.headers.get('OData-Version')).toBe('4.0');
    expect(post?.headers.get('Authorization')).toBeNull();
    expect(post?.body).toEqual({ cr_name: 'Test' });

    const get = fake.calls.find((call) => call.method === 'GET' && call.url.startsWith('/_api/'));
    expect(get?.headers.get('Prefer')).toContain('OData.Community.Display.V1.FormattedValue');
    expect(get?.headers.get('Content-Type')).toBeNull();
  });

  it('refreshes an expired token once and retries the call', async () => {
    let accepted = 'stale-token';
    const fake = createFakePowerPages({ tokens: ['stale-token', 'fresh-token'], acceptToken: () => accepted });
    const client = createPowerPagesClient({ fetchFn: fake.fetch });
    await client.getToken();

    accepted = 'fresh-token';
    const result = await client.post('/_api/cr_appointmentrequests', { cr_name: 'Retry' });

    expect(result.entityId).not.toBeNull();
    expect(fake.tokenRequests()).toBe(2);
    const posts = fake.calls.filter((call) => call.method === 'POST');
    expect(posts.map((call) => call.headers.get('__RequestVerificationToken'))).toEqual(['stale-token', 'fresh-token']);
  });

  it('turns Web API errors into PowerPagesApiError with the hex code', async () => {
    const fake = createFakePowerPages({
      failNext: { status: 403, code: '90040103', message: "You don't have permission to create cr_appointmentrequest entity." },
    });
    const client = createPowerPagesClient({ fetchFn: fake.fetch });

    const error = await client.post('/_api/cr_appointmentrequests', {}).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(PowerPagesApiError);
    expect(error).toMatchObject({ status: 403, code: '90040103' });
    expect(toFriendlyMessage(error)).toMatch(/not fully set up/);
  });

  it('does not retry a permission error', async () => {
    const fake = createFakePowerPages({ failNext: { status: 403, code: '90040106', message: 'Append To missing.' } });
    const client = createPowerPagesClient({ fetchFn: fake.fetch });

    await expect(client.post('/_api/cr_appointmentrequests', {})).rejects.toBeInstanceOf(PowerPagesApiError);
    expect(fake.calls.filter((call) => call.method === 'POST')).toHaveLength(1);
  });

  it('fails clearly when the token endpoint is unavailable, then tries again next time', async () => {
    let up = false;
    const fake = createFakePowerPages();
    const flakyFetch: typeof fetch = async (input, init) =>
      !up && input === '/_layout/tokenhtml' ? new Response('Service unavailable', { status: 503 }) : fake.fetch(input, init);
    const client = createPowerPagesClient({ fetchFn: flakyFetch });

    await expect(client.getToken()).rejects.toMatchObject({ name: 'PowerPagesApiError', status: 503 });
    up = true;
    await expect(client.getToken()).resolves.toBe('token-1');
  });
});

describe('toFriendlyMessage', () => {
  it('covers sessions, outages and network failures without technical detail', () => {
    expect(toFriendlyMessage(new PowerPagesApiError('Missing token', 401))).toMatch(/session has expired/);
    expect(toFriendlyMessage(new PowerPagesApiError('Busy', 503))).toMatch(/busy/);
    expect(toFriendlyMessage(new TypeError('Failed to fetch'))).toMatch(/internet connection/);
  });
});
