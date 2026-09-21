import { describe, expect, it } from 'vitest';
import { buildSpec, evaluate, jsonPath, parseAssertion, parseHeaders, run, type FetchLike } from '../src/lib/http.ts';

const fakeFetch = (status: number, body: string, headers: Record<string, string> = {}): FetchLike => () =>
  Promise.resolve({
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: { forEach: (cb) => Object.entries(headers).forEach(([k, v]) => cb(v, k)) },
    text: () => Promise.resolve(body)
  });

describe('parsing', () => {
  it('parses headers and rejects malformed ones', () => {
    expect(parseHeaders(['Accept: application/json', 'X-A:1'])).toEqual({ Accept: 'application/json', 'X-A': '1' });
    expect(() => parseHeaders(['nocolon'])).toThrow(/Name: value/);
    expect(() => parseHeaders([': v'])).toThrow(/Name: value/);
  });
  it('parses every assertion form and rejects unknown ones', () => {
    expect(parseAssertion('status=201')).toEqual({ kind: 'status', expected: '201' });
    expect(parseAssertion('header:Content-Type=json')).toEqual({ kind: 'header', key: 'content-type', expected: 'json' });
    expect(parseAssertion('json:data.id=7')).toEqual({ kind: 'json', key: 'data.id', expected: '7' });
    expect(parseAssertion('body~=hello')).toEqual({ kind: 'body-includes', expected: 'hello' });
    expect(parseAssertion('time<500')).toEqual({ kind: 'time', expected: '500' });
    expect(() => parseAssertion('status>200')).toThrow(/unrecognised/);
  });
  it('builds a spec with validation and JSON detection', () => {
    const s = buildSpec('https://example.org/a?b=1', { method: 'post', body: '{"x":1}' });
    expect(s.method).toBe('POST');
    expect(s.headers['Content-Type']).toBe('application/json');
    expect(buildSpec('https://example.org', { body: 'plain' }).headers['Content-Type']).toBe('text/plain');
    expect(buildSpec('https://example.org', { body: '{}', header: ['content-type: x/y'] }).headers['content-type']).toBe('x/y');
    expect(() => buildSpec('not a url', {})).toThrow(/invalid URL/);
    expect(() => buildSpec('ftp://x', {})).toThrow(/unsupported protocol/);
    expect(() => buildSpec('https://x', { method: 'BREW' })).toThrow(/unsupported method/);
    expect(() => buildSpec('https://x', { timeout: 0 })).toThrow(/timeout/);
  });
  it('reads dotted JSON paths', () => {
    expect(jsonPath({ a: { b: [10, { c: 'z' }] } }, 'a.b.1.c')).toBe('z');
    expect(jsonPath({ a: 1 }, 'a.b')).toBeUndefined();
    expect(jsonPath(null, 'a')).toBeUndefined();
  });
});

describe('run', () => {
  it('times the request, lowercases headers, parses JSON and evaluates assertions', async () => {
    let t = 0;
    const now = (): number => (t += 12.5);
    const spec = buildSpec('https://example.org/items', {});
    const out = await run(spec, [parseAssertion('status=200'), parseAssertion('header:Content-Type=json'), parseAssertion('json:items.0.id=1'), parseAssertion('body~=items'), parseAssertion('time<100')], fakeFetch(200, '{"items":[{"id":1}]}', { 'Content-Type': 'application/json' }), now);
    expect(out.ok).toBe(true);
    expect(out.ms).toBe(12.5);
    expect(out.headers['content-type']).toBe('application/json');
    expect(out.checks.every((c) => c.passed)).toBe(true);
    const bad = await run(spec, [parseAssertion('status=200'), parseAssertion('json:missing=1'), parseAssertion('time<1')], fakeFetch(500, 'oops'), now);
    expect(bad.ok).toBe(false);
    expect(bad.json).toBeNull();
    expect(bad.checks.map((c) => c.actual)).toEqual(['500', '(missing)', '13 ms']);
  });
  it('evaluates each assertion kind', () => {
    const partial = { status: 200, statusText: 'OK', ms: 5, headers: { a: 'B' }, body: 'hello', json: { k: [1, 2] } };
    expect(evaluate({ kind: 'header', key: 'a', expected: 'b' }, partial).passed).toBe(true);
    expect(evaluate({ kind: 'json', key: 'k', expected: '[1,2]' }, partial).passed).toBe(true);
    expect(evaluate({ kind: 'body-includes', expected: 'bye' }, partial)).toEqual({ passed: false, actual: '5 chars' });
  });
  it('passes the body and aborts on timeout', async () => {
    let seen: string | undefined;
    const f: FetchLike = (_u, init) => {
      seen = init.body;
      return Promise.resolve({ status: 200, statusText: 'OK', headers: { forEach: () => undefined }, text: () => Promise.resolve('') });
    };
    await run(buildSpec('https://x.org', { method: 'PUT', body: 'payload' }), [], f);
    expect(seen).toBe('payload');
    const slow: FetchLike = (_u, init) => new Promise((_res, rej) => init.signal.addEventListener('abort', () => rej(new Error('aborted'))));
    await expect(run(buildSpec('https://x.org', { timeout: 5 }), [], slow)).rejects.toThrow(/aborted/);
  });
});
