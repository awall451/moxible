#!/usr/bin/env bash
# Copy mounted ~/.ssh (uid from host, ro) into a writable, root-owned ~/.ssh
# so ssh + ansible accept it. Strict perms required by openssh.
set -euo pipefail

SRC=/mnt/ssh-ro
DST=/root/.ssh

if [ -d "$SRC" ]; then
  mkdir -p "$DST"
  cp -rT "$SRC" "$DST"
  chown -R root:root "$DST"
  chmod 700 "$DST"
  find "$DST" -type f -exec chmod 600 {} \;
  # public keys + known_hosts can stay 644
  find "$DST" -type f \( -name '*.pub' -o -name 'known_hosts' -o -name 'config' \) \
    -exec chmod 600 {} \;
fi

# touch known_hosts so ssh's StrictHostKeyChecking=accept-new can write to it
[ -f "$DST/known_hosts" ] || { touch "$DST/known_hosts"; chmod 600 "$DST/known_hosts"; }

exec "$@"
