#!/usr/bin/env bash
# Build the Letta server image from a local clone of https://github.com/daib/letta (or letta-ai/letta).
# The upstream Dockerfile lives at the repo root: https://github.com/letta-ai/letta/blob/main/Dockerfile
#
# Usage:
#   npm run letta:docker:build
#   LETTA_SRC=~/src/letta bash scripts/letta-docker-build.sh
#   bash scripts/letta-docker-build.sh --clone
#   bash scripts/letta-docker-build.sh -- --build-arg LETTA_ENVIRONMENT=PROD
#
# Env:
#   LETTA_SRC        — path to Letta git checkout (default: <repo>/../letta)
#   LETTA_CLONE_URL  — git URL when using --clone (default: https://github.com/daib/letta.git)
#   LETTA_IMAGE_TAG  — docker image tag (default: letta:local)
#
# After a successful build, point Compose at the image:
#   LETTA_DOCKER_IMAGE=letta:local docker-compose up -d letta_db letta

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

LETTA_SRC="${LETTA_SRC:-"$ROOT/../letta"}"
LETTA_CLONE_URL="${LETTA_CLONE_URL:-https://github.com/daib/letta.git}"
LETTA_IMAGE_TAG="${LETTA_IMAGE_TAG:-letta:local}"

usage() {
  sed -n '1,20p' "$0" | tail -n +2
}

clone=0
docker_build_extra=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --clone)
      clone=1
      shift
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    --)
      shift
      docker_build_extra+=("$@")
      break
      ;;
    *)
      docker_build_extra+=("$1")
      shift
      ;;
  esac
done

if ! command -v docker >/dev/null 2>&1; then
  echo "letta-docker-build: docker not on PATH." >&2
  exit 1
fi

if [[ ! -f "$LETTA_SRC/Dockerfile" ]]; then
  if [[ "$clone" -eq 1 ]]; then
    parent="$(dirname "$LETTA_SRC")"
    base="$(basename "$LETTA_SRC")"
    mkdir -p "$parent"
    if [[ -e "$LETTA_SRC" ]]; then
      echo "letta-docker-build: LETTA_SRC exists but has no Dockerfile: $LETTA_SRC" >&2
      exit 1
    fi
    echo "letta-docker-build: cloning $LETTA_CLONE_URL → $LETTA_SRC"
    git clone --depth 1 "$LETTA_CLONE_URL" "$parent/$base"
  else
    echo "letta-docker-build: no Dockerfile at LETTA_SRC=$LETTA_SRC" >&2
    echo "letta-docker-build: clone the repo (e.g. git clone $LETTA_CLONE_URL \"$LETTA_SRC\") or run with --clone." >&2
    exit 1
  fi
fi

if [[ ! -f "$LETTA_SRC/Dockerfile" ]]; then
  echo "letta-docker-build: still no Dockerfile at $LETTA_SRC" >&2
  exit 1
fi

echo "letta-docker-build: building $LETTA_IMAGE_TAG from $LETTA_SRC"
docker build -t "$LETTA_IMAGE_TAG" "${docker_build_extra[@]}" "$LETTA_SRC"

echo "letta-docker-build: done."
echo "letta-docker-build: run Letta stack with this image:"
echo "  LETTA_DOCKER_IMAGE=$LETTA_IMAGE_TAG docker-compose up -d letta_db letta"
