-- Letta Postgres bootstrap for docker-compose `letta_db`.
-- Plain SQL only: psql \set + backticks from upstream init.sql often fail under the
-- official entrypoint (subshell env / quoting), which exits the container with code 1.
-- Compose sets POSTGRES_USER / POSTGRES_DB to `letta`; this file runs as that user on that DB.

CREATE SCHEMA IF NOT EXISTS letta AUTHORIZATION letta;

ALTER DATABASE letta SET search_path TO letta;

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA letta;

DROP SCHEMA IF EXISTS public CASCADE;
