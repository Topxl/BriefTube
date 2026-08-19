# Contributing to BriefTube

Thanks for your interest in BriefTube. Bug reports, documentation fixes and pull requests
are all welcome.

## Before you start: how this project is maintained

BriefTube is open source, but it is **not actively developed**. The hosted service at
<https://www.brief-tube.com> stays online and the codebase stays functional, yet the
maintainer works on it occasionally rather than continuously.

What that means in practice:

- Issues and pull requests may sit for weeks before anyone looks at them. That is not
  rudeness, it is the actual pace of the project.
- There is no roadmap and no commitment to build anything you request.
- Security reports are the exception and get priority — see [SECURITY.md](SECURITY.md).
- Forks are welcome and expected. The licence is AGPL-3.0; if you want to move faster
  than this repository does, fork it.

Read the "What gets merged" section below before investing time in a large change. A
short issue describing your plan first will save you from writing something that will not
be merged.

## Development setup

### Prerequisites

- Node.js 22+ (`.nvmrc` pins v24.8.0) and **pnpm** — the repo pins `pnpm@10.14.0` through
  `packageManager`; npm and yarn are not supported
- Python 3.11+ for the worker — CI and the Modal image build on 3.12, the Docker image on 3.11
- A Supabase project (the free tier is enough)

### Web app (Next.js)

```bash
# Fork, then clone your fork
git clone https://github.com/<your-username>/BriefTube.git
cd BriefTube

pnpm install

# Copy the environment template and fill in your own credentials
cp .env.example .env.local

pnpm dev
```

The app runs on <http://localhost:3000>.

### Worker (Python)

The worker handles RSS scanning, transcript extraction, summarization, text-to-speech and
delivery. It is a separate process and does not need the web app to be running.

```bash
cd worker

python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env              # fill in Supabase and Telegram credentials

python main.py
```

Docker is also supported. From the repository root, `docker compose up -d` brings up the
web app and the worker together; from `worker/`, it brings up the worker alone.

### Database

Schema lives in `migrations/`; see `migrations/README.md` for how to set up a fresh
instance. New schema changes go in that directory as a new timestamped file — never as an
edit to a migration that has already been applied somewhere.

## Code conventions

These are enforced by review, and several of them by ESLint. See `CLAUDE.md` and
`.claude/rules/` for the full set.

### TypeScript

- `type` over `interface`
- No `enum` — use a plain object map with `as const`
- No `any` — narrow the type or use `unknown`
- `??` over `||` for defaults, so `0` and `""` survive
- Server Components by default; add `"use client"` only when the component actually needs
  browser APIs, state or effects
- Path aliases: `@/*` maps to `src/*`, `@app/*` maps to `app/*`
- Forms use TanStack Form with Zod — see `.claude/rules/tanstack-form.md`
- API routes use `authRoute` from `@/lib/zod-route` and **always** filter queries by
  `ctx.user.id` — see `.claude/rules/api-routes.md`

### UI

- No emojis in the interface — use Lucide icons
- No gradients unless the design explicitly calls for one
- Headings and paragraphs go through `@/components/nowts/typography.tsx`
- Spacing with `flex flex-col gap-4`, not `space-y-4`

### Python (worker)

- Modern type hints: `str | None`, `list[str]` — not `Optional[str]` or `List[str]`
- Module-level `logger = logging.getLogger(__name__)`
- Blocking I/O inside the async loops goes through `await asyncio.to_thread(...)`
- Prefix every video-related log line with `[{video_id}]`
- Full conventions, including how to add a transcript source or a delivery channel, are in
  `.claude/rules/worker-python.md`

## Changelog — required

**Every code change updates `CHANGELOG.md`.** This is a hard rule in this repository, not
a formality, and a pull request without a changelog entry will be sent back.

Add one line at the top of today's date section, creating the section if it does not exist:

```markdown
## 2026-08-19

FIX: Voice delivery audio in the delivery's language, not the profile language
```

Prefixes: `FIX:`, `FEATURE:`, `REFACTOR:`, `CHORE:`. Present tense ("Add", "Fix"), one
line per change. An optional scope is fine: `FIX(worker): ...`. Full rule in
`.claude/rules/changelog.md`.

## Tests and checks

```bash
# Web app
pnpm ts            # TypeScript, no emit
pnpm lint          # ESLint with auto-fix
pnpm clean         # lint + typecheck + prettier — run this before pushing
pnpm test:ci       # Vitest unit tests
pnpm test:e2e      # Playwright, interactive UI
pnpm test:e2e:ci   # Playwright, headless

# Worker
cd worker && python -m pytest tests/ -q
```

Git hooks run automatically and should not be bypassed:

- **pre-commit** — `pnpm ts`, `pnpm lint`, plus a Python syntax check and the worker test
  suite when staged files touch `worker/`
- **pre-push** — a full `pnpm build` when pushing to `main`

Never use `--no-verify`. If a hook fails, fix the cause.

The GitHub Actions workflows for lint, typecheck and Playwright are `workflow_dispatch`
only — the hooks above are what actually gates code, so run them locally.

## Submitting a pull request

1. Fork the repository and branch from `main`: `git checkout -b fix/telegram-retry`
2. Make the change, keeping it focused — one concern per pull request
3. Update `CHANGELOG.md`
4. Run `pnpm clean` (and the worker tests if you touched Python)
5. Push and open a pull request; fill in the template
6. Expect a slow review, and a possible "no" — see below

Commit messages follow the existing history: a conventional-commit style subject with an
optional scope, such as `fix(worker): fail loudly when the Infisical login hangs`.

## What gets merged

Being honest about this up front saves everyone time.

**Likely merged:**

- Bug fixes with a clear description of the bug and how the fix addresses it
- Security fixes
- Documentation corrections, especially where the docs contradict the code
- Dependency bumps that fix a vulnerability or a build break
- Small, self-contained improvements to an existing feature that do not add configuration
- New transcript sources or delivery channels that follow the existing patterns in
  `.claude/rules/worker-python.md` and degrade gracefully when unconfigured

**Likely not merged:**

- Large refactors, rewrites, or migrations to a different framework, ORM or styling
  approach — the maintenance cost lands on someone who is not developing this project
- New third-party services or paid dependencies added to the default path
- Features that only make sense for the hosted service, or only for one self-hoster's setup
- Changes that remove the changelog rule, the git hooks, or the existing conventions
- Formatting-only pull requests across many files, which make history harder to read
- AI-generated pull requests submitted without the author having run or understood the code

**Uncertain — open an issue first:** anything touching the database schema, billing, the
authentication flow, or the worker's retry and failure semantics. Those areas run against
live user data on the hosted service and a subtle regression is expensive.

If a pull request is declined, it is a decision about maintenance capacity, not about the
quality of your work. The AGPL-3.0 licence means you can always carry the change in a fork.

## Reporting bugs and requesting features

Use the [issue templates](https://github.com/Topxl/BriefTube/issues/new/choose). Blank
issues are disabled, because the templates ask for the details that make an issue
actionable — deployment mode, affected component, commit, logs.

- **Bug report** — something does not work as it should
- **Feature request** — an idea or improvement, with a question about whether you would
  implement it yourself
- **[Discussions](https://github.com/Topxl/BriefTube/discussions)** — questions, setup
  help, and ideas that are not yet a concrete request
- **Support for the hosted service** — through the in-app chat at
  <https://www.brief-tube.com>, not through GitHub. Never post account details or payment
  information in a public issue.
- **Security** — privately, through
  [GitHub Security Advisories](https://github.com/Topxl/BriefTube/security/advisories/new).
  See [SECURITY.md](SECURITY.md).

## Code of conduct

Participation in this project is covered by the
[Contributor Covenant](CODE_OF_CONDUCT.md).

## Licence

BriefTube is licensed under AGPL-3.0. By contributing, you agree that your contributions
are licensed under the same terms.
