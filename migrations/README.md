# Database migrations

## Setting up a new instance

Run **one file**:

```
migrations/00000000_initial_schema.sql
```

Paste it into the Supabase SQL Editor, or apply it from a terminal:

```bash
psql "$SUPABASE_DB_URL" -f migrations/00000000_initial_schema.sql
```

That's it. It creates 33 tables, 46 row-level security policies, 103 indexes,
14 functions, 8 triggers, 1 view, the `audio` storage bucket, and the
`on_auth_user_created` trigger that gives every new sign-up a profile row.

## Do not run the other files

Every other `.sql` file in this directory is the historical migration log of the
hosted instance, kept for provenance. They are already folded into
`00000000_initial_schema.sql`, which is a snapshot of the live schema.

Running them on a fresh database will fail on columns that already exist.

## Requirements

The schema depends on the Supabase-managed `auth` and `storage` schemas, and on
the `anon`, `authenticated`, and `service_role` roles. It is not portable to a
bare PostgreSQL server without them.

Row-level security is enabled on all 33 tables. **Leave it on.** The web app
queries the database with the anon key on behalf of the signed-in user, and RLS
is the only thing that keeps one user's summaries away from another's.

## Adding a migration

Name it `YYYYMMDD_short_description.sql` and append it to this directory. When
enough of them pile up, regenerate the snapshot from a live database:

```bash
pg_dump "$SUPABASE_DB_URL" \
  --schema-only --schema=public \
  --no-owner --no-privileges --no-comments
```

Then re-add by hand the two things `--schema=public` cannot see: the
`on_auth_user_created` trigger on `auth.users`, and the `audio` storage bucket
with its policies. Both are at the bottom of the snapshot file, under
"Objects outside the `public` schema".
