# AUDIT — cli-development-tools (pre-refactor)

Audit of the previous build: four CommonJS scripts (`api_tester.js`,
`dev_server.js`, `git_helper.js`, `project_generator.js`; 2,668 lines)
and a Python `file_organizer.py` (469 lines), ten runtime
dependencies, a `package.json` with `"author": "Developer"`, no tests,
no CI, no lockfile, and a README describing tools that could not be
installed as one.

---

## A. Structure

### A1 — Five tools, two languages, ten dependencies, no lockfile
`chalk`, `inquirer`, `ora`, `figlet`, `axios`, `express`, `cors`,
`chokidar`, `fs-extra`, `commander` — for tasks Node 22 handles with
`fetch`, `node:http`, `node:fs` and `node:child_process`. Versions were
unpinned. **Fix:** one TypeScript package, one runtime dependency
(`commander`), a committed lockfile, a CycloneDX SBOM generated in CI,
and `npm audit` on the production tree (0 findings).

### A2 — Nothing could be tested
Logic and terminal I/O lived in the same functions with spinners and
prompts in between. **Fix:** `src/lib/` holds pure modules (HTTP spec
and assertions, path resolution, git parsers, organiser planner,
template renderer) at 100 % statement coverage; `src/commands/` binds
them to commander; an end-to-end test runs the built binary.

## B. Correctness and safety

### B1 — Dev server: Express, chokidar and a live-reload injector, untested
`dev_server.js` relied on `express.static` (which is traversal-safe)
plus 350 lines of its own directory listing, HTML injection for live
reload and file watching, none of it tested. **Fix:** `node:http` with
a small, tested resolver — `resolveSafe` decodes, normalises, rejects
NUL and undecodable input and refuses any path outside the root — and
explicit tests for `..`, `%2e%2e`, `%00` and `%zz`. Live reload was
dropped; it is not what a dev server is trusted for.

### B2 — Git helper ran shell strings
`git_helper.js:32` executed commands through `execSync(command)` with
the command assembled as a template string, including user-supplied
branch names. **Fix:** `execFile('git', [...args])` with an argument
array — no shell — and parsers that are pure functions tested on
captured output.

### B3 — File organiser: MD5 duplicates, rename-on-collision, plan tied to execution
`file_organizer.py` hashed with MD5, resolved name collisions by
appending a counter, and computed its plan inside the same loop that
moved files, so a dry run and a real run could differ. **Fix:** a pure
planner (`plan`) that returns moves and SHA-256 duplicate groups;
`apply` executes exactly that plan, never overwrites, and reports
collisions instead of inventing names; dry run is the default.

### B4 — API tester had no assertions
It printed responses. **Fix:** `status=`, `header:`, `json:`, `body~=`
and `time<` assertions with a non-zero exit when any fails, and `--json`
output for scripts.

### B5 — Commit-message helper accepted anything
**Fix:** `check-commit` validates the Conventional Commits header
(type, scope, breaking marker, subject rules, length, blank second
line) and works as a `commit-msg` hook.

## C. Honesty

### C1 — `"author": "Developer"`, no licence file, no publishable name
**Fix:** scoped package name, author, MIT licence, `files` whitelist,
`bin` entry; `npm publish --dry-run` runs on every CI build (actual
publication needs an npm account and is listed as a manual step).
