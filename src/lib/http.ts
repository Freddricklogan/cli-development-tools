/** HTTP request testing: build a request from CLI options, run it with fetch, time it, and evaluate
 * assertions. The runner takes a fetch function so tests inject one. */

export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
export const METHODS: readonly Method[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

export interface RequestSpec {
  url: string;
  method: Method;
  headers: Record<string, string>;
  body?: string;
  timeoutMs: number;
}

export interface Assertion {
  kind: 'status' | 'header' | 'json' | 'body-includes' | 'time';
  key?: string; // header name or JSON path (dot-separated)
  expected: string;
}

export interface Outcome {
  ok: boolean;
  status: number;
  statusText: string;
  ms: number;
  headers: Record<string, string>;
  body: string;
  json: unknown;
  checks: { assertion: Assertion; passed: boolean; actual: string }[];
}

/** Parses "Name: value" header strings; rejects malformed ones. */
export function parseHeaders(items: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const item of items) {
    const i = item.indexOf(':');
    if (i <= 0) throw new Error(`header must be "Name: value", got "${item}"`);
    const name = item.slice(0, i).trim();
    const value = item.slice(i + 1).trim();
    if (!name) throw new Error(`header must be "Name: value", got "${item}"`);
    out[name] = value;
  }
  return out;
}

/** Parses "status=200", "header:content-type=application/json", "json:data.id=7", "body~=hello", "time<500". */
export function parseAssertion(text: string): Assertion {
  let m = /^status=(\d{3})$/.exec(text);
  if (m) return { kind: 'status', expected: m[1] ?? '' };
  m = /^header:([^=]+)=(.*)$/.exec(text);
  if (m) return { kind: 'header', key: (m[1] ?? '').toLowerCase(), expected: m[2] ?? '' };
  m = /^json:([^=]+)=(.*)$/.exec(text);
  if (m) return { kind: 'json', key: m[1] ?? '', expected: m[2] ?? '' };
  m = /^body~=(.+)$/.exec(text);
  if (m) return { kind: 'body-includes', expected: m[1] ?? '' };
  m = /^time<(\d+)$/.exec(text);
  if (m) return { kind: 'time', expected: m[1] ?? '' };
  throw new Error(`unrecognised assertion "${text}"`);
}

export function buildSpec(url: string, opts: { method?: string; header?: string[]; body?: string; timeout?: number }): RequestSpec {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`invalid URL "${url}"`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error(`unsupported protocol ${parsed.protocol}`);
  const method = (opts.method ?? 'GET').toUpperCase();
  if (!METHODS.includes(method as Method)) throw new Error(`unsupported method ${method}`);
  const headers = parseHeaders(opts.header ?? []);
  const timeoutMs = opts.timeout ?? 10000;
  if (!(timeoutMs > 0)) throw new Error('timeout must be positive');
  const spec: RequestSpec = { url: parsed.toString(), method: method as Method, headers, timeoutMs };
  if (opts.body !== undefined) {
    spec.body = opts.body;
    if (!Object.keys(headers).some((h) => h.toLowerCase() === 'content-type')) {
      try {
        JSON.parse(opts.body);
        spec.headers['Content-Type'] = 'application/json';
      } catch {
        spec.headers['Content-Type'] = 'text/plain';
      }
    }
  }
  return spec;
}

/** Reads a dotted path from parsed JSON; arrays by index. */
export function jsonPath(value: unknown, path: string): unknown {
  let cur: unknown = value;
  for (const part of path.split('.').filter(Boolean)) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

export function evaluate(assertion: Assertion, outcome: Omit<Outcome, 'checks' | 'ok'>): { passed: boolean; actual: string } {
  switch (assertion.kind) {
    case 'status':
      return { passed: String(outcome.status) === assertion.expected, actual: String(outcome.status) };
    case 'header': {
      const actual = outcome.headers[assertion.key ?? ''] ?? '';
      return { passed: actual.toLowerCase().includes(assertion.expected.toLowerCase()), actual };
    }
    case 'json': {
      const v = jsonPath(outcome.json, assertion.key ?? '');
      const actual = v === undefined ? '(missing)' : typeof v === 'string' ? v : JSON.stringify(v);
      return { passed: actual === assertion.expected, actual };
    }
    case 'body-includes':
      return { passed: outcome.body.includes(assertion.expected), actual: `${outcome.body.length} chars` };
    case 'time':
      return { passed: outcome.ms < Number(assertion.expected), actual: `${outcome.ms.toFixed(0)} ms` };
  }
}

export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body?: string; signal: AbortSignal }) => Promise<{ status: number; statusText: string; headers: { forEach(cb: (v: string, k: string) => void): void }; text(): Promise<string> }>;

export async function run(spec: RequestSpec, assertions: readonly Assertion[], fetchFn: FetchLike, now: () => number = () => performance.now()): Promise<Outcome> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), spec.timeoutMs);
  const t0 = now();
  try {
    const init: Parameters<FetchLike>[1] = { method: spec.method, headers: spec.headers, signal: controller.signal };
    if (spec.body !== undefined) init.body = spec.body;
    const res = await fetchFn(spec.url, init);
    const body = await res.text();
    const ms = now() - t0;
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => {
      headers[k.toLowerCase()] = v;
    });
    let json: unknown = null;
    try {
      json = JSON.parse(body);
    } catch {
      json = null;
    }
    const partial = { status: res.status, statusText: res.statusText, ms, headers, body, json };
    const checks = assertions.map((a) => ({ assertion: a, ...evaluate(a, partial) }));
    return { ...partial, checks, ok: checks.every((c) => c.passed) };
  } finally {
    clearTimeout(timer);
  }
}
