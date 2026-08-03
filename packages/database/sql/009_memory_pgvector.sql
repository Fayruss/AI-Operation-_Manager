-- AI Operations Manager — pgvector support for the Memory Module (Phase 7).
-- SAD §2.6/§3.2: "pgvector co-located with operational data."
--
-- `create extension` is also declared in schema.prisma's `extensions =
-- [vector]` (postgresqlExtensions preview feature), so `prisma migrate
-- deploy` should have already created it as part of the migration that
-- introduced `memory_entries.embedding vector(1536)`. This statement is
-- `if not exists` and re-run here anyway for defense-in-depth: schema-only
-- extension declarations occasionally lag a manually-applied migration in
-- an existing database, and this script (unlike prisma migrate) is safe to
-- re-run idempotently on every deploy per apply-sql.sh's own contract.
create extension if not exists vector;

-- Prisma cannot express an index's operator class (`vector_cosine_ops`),
-- so the ivfflat index itself — matching SAD §4's literal
-- `idx_memory_embedding USING ivfflat (embedding vector_cosine_ops)` — is
-- created here rather than via `@@index` in schema.prisma. `lists = 100` is
-- the standard starting point for ivfflat (roughly sqrt(N) tuned upward as
-- the table grows past low hundreds-of-thousands of rows; revisit once
-- there's production row-count data, per pgvector's own tuning guidance).
-- Cosine distance (`<=>`) matches MemoryEntryRepository's similarity
-- queries and the Chat Workspace/RAG retrieval pattern SAD §13.1 assumes.
create index if not exists idx_memory_embedding
  on memory_entries
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);
