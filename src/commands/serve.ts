import { promises as fs } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import type { Command } from 'commander';
import { listingHtml, mimeFor, resolveRequest } from '../lib/serve.ts';

export function createServer(root: string, opts: { spa: boolean; listings: boolean; cors: boolean }): http.Server {
  return http.createServer((req, res) => {
    void (async () => {
      const urlPath = req.url ?? '/';
      const r = await resolveRequest(root, urlPath, opts.spa, opts.listings);
      const headers: Record<string, string> = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
      if (opts.cors) headers['Access-Control-Allow-Origin'] = '*';
      if (r.kind === 'missing') {
        res.writeHead(404, { ...headers, 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not found');
      } else if (r.kind === 'listing') {
        res.writeHead(200, { ...headers, 'Content-Type': 'text/html; charset=utf-8' });
        res.end(listingHtml(urlPath.split('?')[0] ?? '/', r.entries ?? []));
      } else {
        const file = r.file ?? '';
        const data = await fs.readFile(file);
        res.writeHead(200, { ...headers, 'Content-Type': mimeFor(file), 'Content-Length': String(data.length) });
        res.end(req.method === 'HEAD' ? undefined : data);
      }
      console.log(`${new Date().toISOString()} ${req.method ?? ''} ${urlPath} → ${res.statusCode}`);
    })().catch((err: unknown) => {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Server error');
      console.error(err);
    });
  });
}

export function registerServe(program: Command): void {
  program
    .command('serve')
    .description('Serve a directory over HTTP with SPA fallback and directory listings')
    .argument('[dir]', 'directory to serve', '.')
    .option('-p, --port <port>', 'port', (v) => Number(v), 3000)
    .option('--host <host>', 'bind address', '127.0.0.1')
    .option('--spa', 'serve index.html for unknown paths', false)
    .option('--no-listings', 'disable directory listings')
    .option('--cors', 'add Access-Control-Allow-Origin: *', false)
    .action(async (dir: string, opts: { port: number; host: string; spa: boolean; listings: boolean; cors: boolean }) => {
      const root = path.resolve(dir);
      await fs.access(root);
      const server = createServer(root, opts);
      server.listen(opts.port, opts.host, () => console.log(`serving ${root} at http://${opts.host}:${opts.port}/ (spa=${String(opts.spa)}, listings=${String(opts.listings)})`));
    });
}
