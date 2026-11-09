import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from '../api.js';

const SID = '20152691234567890';

function fakeResponse(status, body) {
  return { status, ok: status >= 200 && status < 300, json: async () => body };
}

afterEach(() => vi.unstubAllGlobals());

describe('api client', () => {
  it('sends the X-Student-Id header and calls the right URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue(fakeResponse(200, []));
    vi.stubGlobal('fetch', fetchMock);

    await api.myHolds(SID);

    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('http://localhost:8080/me/holds');
    expect(opts.method).toBe('GET');
    expect(opts.headers['X-Student-Id']).toBe(SID);
  });

  it('sends a JSON body when creating a class', async () => {
    const fetchMock = vi.fn().mockResolvedValue(fakeResponse(201, { id: 'c_1' }));
    vi.stubGlobal('fetch', fetchMock);

    await api.createClass('Class 6 - Morning Shift', 120);

    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('http://localhost:8080/classes');
    expect(opts.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(opts.body)).toEqual({ name: 'Class 6 - Morning Shift', totalSeats: 120 });
  });

  it('turns "no seats" (409) into a readable Bangla message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse(409, { error: 'No seats are available in this class.' })));
    await expect(api.apply('c_1', SID)).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining('seat খালি নেই'),
    });
  });

  it('shows a friendly message when the server cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const err = await api.listClasses().catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(0);
    expect(err.message).toContain('যোগাযোগ করা যাচ্ছে না');
  });

  it('hides raw 500 errors behind a readable message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse(500, { error: 'boom stack trace' })));
    const err = await api.listClasses().catch((e) => e);
    expect(err.message).toContain('সার্ভারে');
    expect(err.message).not.toContain('boom');
  });

  it('returns null for 204 (cancel)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse(204, null)));
    await expect(api.cancel('h_1', SID)).resolves.toBeNull();
  });
});
