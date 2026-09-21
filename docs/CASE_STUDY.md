# Case Study — cli-development-tools

**Repository:** [cli-development-tools](https://github.com/Freddricklogan/cli-development-tools) · **Package:** `@freddricklogan/devkit` (publish dry-run in CI; install from the repository) · **Author:** Freddrick Logan

---

## 1. Who has this problem

Developers and small teams who accumulate helper scripts — a request tester here, a static server there, a script that tidies a downloads folder — and end up maintaining five half-tools in two languages that nobody can install together. Reviewers of a tooling portfolio ask the same questions they ask of any software: is it tested, is it safe, and what does it depend on.

## 2. The problem, as a scenario

A colleague wants the API tester. She clones the repository and finds four Node scripts and a Python one, ten unpinned dependencies, no lockfile, and `"author": "Developer"`. The dev server is 390 lines of Express, file watching and HTML injection with no test. The git helper builds shell commands from user input. The file organiser computes its plan in the same loop that moves files, so a dry run can differ from the real run. Nothing has a test. She writes her own script instead. That was the earlier version of this repository.

## 3. What it costs to leave it alone

Untested tooling is tooling nobody trusts, so it is not used, so it rots. An untested dev server matters the first time someone serves a folder on a shared network. A shell-string git helper is a command-injection bug waiting for a branch name with a semicolon. Ten dependencies are ten supply-chain entries for tasks the runtime does natively. And a package with no name and no licence cannot be shared even when it works.

## 4. The approach, and the alternative I rejected

I rejected polishing the five scripts in place. The structural problem was that every decision lived next to a spinner or a prompt, so nothing could be tested without a terminal. The rewrite is one TypeScript package with a library layer and a binding layer. `src/lib/http.ts` builds a request spec, parses five kinds of assertion and runs a request against an injected `fetch`. `src/lib/serve.ts` resolves URL paths so they cannot leave the root and decides between a file, an index, a listing, an SPA fallback and a 404. `src/lib/git.ts` parses `for-each-ref` and `status --porcelain` output and validates Conventional Commits headers. `src/lib/generate.ts` renders template directories and refuses to overwrite. `src/lib/organize.ts` plans category moves and duplicate groups by hash, then applies the plan without overwriting. The commands read options, call the library and print. One runtime dependency remains.

## 5. What the code does today

`devkit api <url>` sends a request with method, headers and body, prints status, timing and the parsed body, evaluates `status=`, `header:`, `json:`, `body~=` and `time<` assertions, and exits non-zero when any fails. `devkit serve [dir]` serves files with correct MIME types, directory listings, optional SPA fallback and CORS, on a bound address of your choosing. `devkit git branches`, `stale`, `status` and `check-commit` give a branch table with ahead/behind counts, branches idle for N days, status counts, and a Conventional Commits validator that reads a message file so it works as a `commit-msg` hook. `devkit gen <template> <name>` scaffolds a Node library, a Python package or a static site from templates with placeholders in file contents and paths. `devkit organize [dir]` prints a plan of moves and duplicates and applies it only with `--apply`. Every command has `--json` where output is data.

## 6. Evidence

Twenty-six Vitest tests: twenty-two unit tests over the library — header and assertion parsing with rejections, spec building with JSON detection and protocol, method and timeout validation, dotted JSON paths, a run with a fake fetch checking timing, header lower-casing and every assertion kind, body passing and abort on timeout, MIME defaults, path confinement against `..`, encoded dots, NUL and undecodable input, file, index, listing, SPA and missing resolution, listing escaping, branch and status parsing, stale detection, commit-message rules, categorisation, planning with hidden files and duplicates, scan with hashes and apply without overwriting, template rendering across all three templates and the overwrite refusal — and four end-to-end tests that build the binary and run help, generation, a dry-run plan, commit-message exit codes and a live server with SPA fallback. Statement coverage of the library is 100 %. `npm publish --dry-run` produces a 22.4 kB tarball of 50 files; the CycloneDX 1.6 SBOM lists one production component; `npm audit --omit=dev` reports zero vulnerabilities. A live run of `devkit api` against the GitHub API returned 200 in 513 ms with all four assertions passing. `AUDIT.md` records eight findings.

## 7. What it would take to run this in production

Publish to the npm registry under the scoped name — the dry run already passes — with provenance attestation from CI; add a changelog and semantic-version tagging; and, if teams adopt the commit hook, ship a one-line installer for it. The `serve` command is a development server and should stay one: no TLS, no auth, bind to localhost by default, which it does.

## 8. Limits and next steps

Not yet on the registry, because that needs an account action rather than code. The `api` command has no request collections or environments. Templates are three and opinionated. Next, in order: registry publication with provenance, saved request collections for `api`, and a `--watch` reload for `serve`.

## 9. Who should look at this

**Hiring manager:** evidence that I build developer tooling to the same standard as product code — tested, safe by default, minimal dependencies, publishable.
**Consulting client:** a pattern for consolidating a team's helper scripts into one maintained, auditable tool.
**Engineer:** read `src/lib/serve.ts` with `tests/serve.test.ts` for the path confinement, and `src/lib/http.ts` for the assertion design.
