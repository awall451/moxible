#!/usr/bin/env bash
# Provision /data on container start. The wizard (Phase 2+) writes config
# and keys here; the bind mount in docker-compose.yml persists them across
# container restarts.
#
# We never copy the host's ~/.ssh into the container — the wizard generates
# an ed25519 key in /data/keys/ on first run and that key is what reaches PVE.
set -euo pipefail

DATA_DIR="${DATA_DIR:-/data}"
KEYS_DIR="${KEYS_DIR:-$DATA_DIR/keys}"
ARTIFACTS_DIR="${ARTIFACTS_DIR:-$DATA_DIR/runs}"

mkdir -p "$KEYS_DIR" "$ARTIFACTS_DIR"
chmod 700 "$KEYS_DIR"

# Strict perms on any keys the wizard has already written.
find "$KEYS_DIR" -maxdepth 1 -type f ! -name '*.pub' -exec chmod 600 {} + 2>/dev/null || true
find "$KEYS_DIR" -maxdepth 1 -type f -name '*.pub' -exec chmod 644 {} + 2>/dev/null || true

# known_hosts so ssh's StrictHostKeyChecking=accept-new can write to it.
KNOWN_HOSTS="$KEYS_DIR/known_hosts"
[ -f "$KNOWN_HOSTS" ] || { touch "$KNOWN_HOSTS"; chmod 600 "$KNOWN_HOSTS"; }

exec "$@"
