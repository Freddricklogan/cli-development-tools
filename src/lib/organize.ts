/** File organiser: a pure planner that decides where each file goes and which files are duplicates,
 * and an executor that applies the plan. Nothing moves unless the caller asks. */

import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

export const CATEGORIES: Record<string, readonly string[]> = {
  Images: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.heic', '.bmp', '.tiff'],
  Documents: ['.pdf', '.doc', '.docx', '.txt', '.md', '.rtf', '.odt', '.pages'],
  Spreadsheets: ['.xls', '.xlsx', '.csv', '.numbers', '.ods'],
  Presentations: ['.ppt', '.pptx', '.key', '.odp'],
  Audio: ['.mp3', '.wav', '.flac', '.m4a', '.aac', '.ogg'],
  Video: ['.mp4', '.mov', '.avi', '.mkv', '.webm'],
  Archives: ['.zip', '.tar', '.gz', '.tgz', '.rar', '.7z', '.dmg'],
  Code: ['.js', '.ts', '.py', '.rb', '.go', '.rs', '.java', '.c', '.cpp', '.h', '.sh', '.json', '.yml', '.yaml', '.toml', '.html', '.css']
};

export function categoryFor(file: string): string {
  const ext = path.extname(file).toLowerCase();
  for (const [cat, exts] of Object.entries(CATEGORIES)) if (exts.includes(ext)) return cat;
  return 'Other';
}

export interface FileEntry {
  name: string;
  size: number;
  hash?: string;
}

export interface Move {
  from: string;
  to: string;
  category: string;
}

export interface Plan {
  moves: Move[];
  duplicates: { keep: string; remove: string[] }[];
  skipped: string[];
}

/** Plans moves for files directly inside `root` (subdirectories are left alone) and groups duplicates by hash. */
export function plan(root: string, entries: readonly FileEntry[], opts: { dedupe: boolean }): Plan {
  const moves: Move[] = [];
  const skipped: string[] = [];
  const byHash = new Map<string, string[]>();
  for (const e of entries) {
    if (e.name.startsWith('.')) {
      skipped.push(e.name);
      continue;
    }
    const category = categoryFor(e.name);
    if (opts.dedupe && e.hash) {
      const list = byHash.get(e.hash) ?? [];
      list.push(e.name);
      byHash.set(e.hash, list);
      if (list.length > 1) continue; // later copies are removed, not moved
    }
    moves.push({ from: path.join(root, e.name), to: path.join(root, category, e.name), category });
  }
  const duplicates = [...byHash.values()].filter((names) => names.length > 1).map((names) => ({ keep: names[0] ?? '', remove: names.slice(1) }));
  return { moves, duplicates, skipped };
}

export async function scan(root: string, hash: boolean): Promise<FileEntry[]> {
  const out: FileEntry[] = [];
  for (const name of (await fs.readdir(root)).sort()) {
    const st = await fs.stat(path.join(root, name));
    if (!st.isFile()) continue;
    const entry: FileEntry = { name, size: st.size };
    if (hash) entry.hash = createHash('sha256').update(await fs.readFile(path.join(root, name))).digest('hex');
    out.push(entry);
  }
  return out;
}

/** Applies a plan: creates category folders, moves files (never overwriting), removes duplicate copies. */
export async function apply(root: string, p: Plan): Promise<{ moved: number; removed: number; collisions: string[] }> {
  let moved = 0;
  let removed = 0;
  const collisions: string[] = [];
  for (const m of p.moves) {
    await fs.mkdir(path.dirname(m.to), { recursive: true });
    try {
      await fs.access(m.to);
      collisions.push(m.from);
      continue;
    } catch {
      // target does not exist: safe to move
    }
    await fs.rename(m.from, m.to);
    moved += 1;
  }
  for (const d of p.duplicates) {
    for (const name of d.remove) {
      await fs.unlink(path.join(root, name));
      removed += 1;
    }
  }
  return { moved, removed, collisions };
}
