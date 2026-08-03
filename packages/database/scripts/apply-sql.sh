#!/usr/bin/env bash
# Applies packages/database/sql/*.sql (RLS policies, auth trigger) in
# filename order via `prisma db execute`, which reads DATABASE_URL from the
# same schema.prisma datasource everything else uses. Must run AFTER
# `prisma migrate deploy` — see the note in infra/docker/docker-compose.yml
# for why these can't be Postgres docker-entrypoint-initdb.d scripts.
set -euo pipefail
cd "$(dirname "$0")/.."

for f in sql/*.sql; do
  echo "→ Applying $f"
  pnpm exec prisma db execute --file "$f" --schema prisma/schema.prisma
done

echo "✓ All RLS/SQL migrations applied."
