/** Static file server core: path resolution that cannot escape the root, MIME types, SPA fallback
 * and directory listings — the parts worth testing without opening a socket. */

import { promises as fs } from 'node:fs';
import path from 'node:path';

export const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.map': 'application/json; charset=utf-8'
};

export function mimeFor(file: string): string {
  return MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
}

/** Resolves a URL path inside `root`; returns null for traversal attempts or encoded NULs. */
export function resolveSafe(root: string, urlPath: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(urlPath.split('?')[0] ?? '');
  } catch {
    return null;
  }
  if (decoded.includes('\0')) return null;
  const abs = path.resolve(root, '.' + path.posix.normalize('/' + decoded));
  const rootAbs = path.resolve(root);
  if (abs !== rootAbs && !abs.startsWith(rootAbs + path.sep)) return null;
  return abs;
}

export interface Resolved {
  kind: 'file' | 'listing' | 'spa' | 'missing';
  file?: string;
  entries?: string[];
}

/** Decides what to serve for a path: a file, index.html in a directory, a listing, the SPA fallback, or 404. */
export async function resolveRequest(root: string, urlPath: string, spa: boolean, listings: boolean): Promise<Resolved> {
  const abs = resolveSafe(root, urlPath);
  if (abs === null) return { kind: 'missing' };
  try {
    const st = await fs.stat(abs);
    if (st.isDirectory()) {
      const index = path.join(abs, 'index.html');
      try {
        await fs.access(index);
        return { kind: 'file', file: index };
      } catch {
        if (listings) {
          const entries = (await fs.readdir(abs)).sort();
          return { kind: 'listing', entries };
        }
      }
    } else if (st.isFile()) {
      return { kind: 'file', file: abs };
    }
  } catch {
    // fall through
  }
  if (spa) {
    const index = path.join(path.resolve(root), 'index.html');
    try {
      await fs.access(index);
      return { kind: 'spa', file: index };
    } catch {
      return { kind: 'missing' };
    }
  }
  return { kind: 'missing' };
}

export function listingHtml(urlPath: string, entries: readonly string[]): string {
  const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
  const base = urlPath.endsWith('/') ? urlPath : urlPath + '/';
  const items = entries.map((e) => `<li><a href="${esc(base + encodeURIComponent(e))}">${esc(e)}</a></li>`).join('');
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Index of ${esc(urlPath)}</title></head><body><h1>Index of ${esc(urlPath)}</h1><ul>${items}</ul></body></html>`;
}
