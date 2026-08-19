## What this changes

<!-- One or two sentences. Link the issue it closes, if there is one: Closes #123 -->

## Why

<!-- The problem behind the change. Skip if it is obvious from the description above. -->

## How to verify

<!-- The steps a reviewer follows to see it work. For worker changes, say which video or
     channel you tested against — the pipeline behaves differently per video type. -->

## Checklist

- [ ] `pnpm clean` passes (lint + `tsc --noEmit` + format). Run it before pushing; the
      pre-commit hook runs the same checks and the pre-push hook builds on `main`.
- [ ] `CHANGELOG.md` updated — one line under today's `## YYYY-MM-DD` heading, prefixed
      `FIX:`, `FEATURE:`, `REFACTOR:` or `CHORE:`. This is a hard rule in this repo
      (see `.claude/rules/changelog.md`), not a nicety.
- [ ] No secrets, tokens, keys, `.env` files or real user data in the diff.
- [ ] Tests updated or added where it made sense — `pnpm test:ci` for the web app,
      `cd worker && python -m pytest tests/ -q` when Python changed.
- [ ] Existing conventions followed: `type` over `interface`, no enums, no `any`,
      `??` over `||`, Server Components by default. See `CLAUDE.md` and `.claude/rules/`.
- [ ] Database changes ship with a migration in `migrations/`, and the PR says
      whether it is backwards compatible with the currently deployed code.

## Notes for the reviewer

<!-- Anything you are unsure about, trade-offs you made, or follow-up work you left out. -->
