#!/bin/bash
# Deploy pipeline runs this on Nginx1 and Nginx2 (via SSM) after a new
# container passes its health check on the app VM. Flips which port is
# primary vs backup in the given vhost's upstream block.
#
# Usage: sudo nginx-switch.sh <new-port> <vhost-conf-filename> [expected-version]
#   new-port            3001 or 3002 — the port that should become primary
#   vhost-conf-filename e.g. whispey.stg.pypeai.com.conf (stage) or
#                        whispey.pypeai.com.conf (prod) — same 2 nginx VMs
#                        serve both, this picks which file to touch
#   expected-version    optional — APP_VERSION the /api/health response
#                        must report after switching, to prove we're
#                        actually routing to the new deploy, not just
#                        that "a" backend answered
set -euo pipefail

NEW_PORT="${1:?usage: nginx-switch.sh <port> <vhost-file> [expected-version]}"
VHOST_FILE="${2:?usage: nginx-switch.sh <port> <vhost-file> [expected-version]}"
EXPECTED_VERSION="${3:-}"

CONF="/etc/nginx/conf.d/${VHOST_FILE}"
[ -f "$CONF" ] || { echo "ERROR: $CONF not found"; exit 1; }

if [ "$NEW_PORT" = "3001" ]; then OLD_PORT="3002"
elif [ "$NEW_PORT" = "3002" ]; then OLD_PORT="3001"
else echo "ERROR: port must be 3001 or 3002, got: $NEW_PORT"; exit 1
fi

# Per-vhost lock — stage and prod switches on the same box must not block
# each other, but two switches of the SAME vhost must never race.
LOCK_FILE="/var/lock/nginx-switch-${VHOST_FILE}.lock"
exec 200>"$LOCK_FILE"
flock -n 200 || { echo "ERROR: another switch for $VHOST_FILE is already running"; exit 1; }

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

# Baseline check BEFORE editing anything — if the config is already broken
# for an unrelated reason (another vhost), don't blame this deploy for it.
log "Baseline nginx -t"
nginx -t || { echo "ERROR: nginx config already invalid before this change — not touching anything"; exit 1; }

APP_IP="$(grep -oP 'server \K[0-9.]+(?=:'"$OLD_PORT"')' "$CONF" | head -1)"
[ -n "$APP_IP" ] || APP_IP="$(grep -oP 'server \K[0-9.]+(?=:'"$NEW_PORT"')' "$CONF" | head -1)"
[ -n "$APP_IP" ] || { echo "ERROR: could not find app VM IP in $CONF"; exit 1; }

log "Switching $VHOST_FILE: primary -> ${APP_IP}:${NEW_PORT}, backup -> ${APP_IP}:${OLD_PORT}"

TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

awk -v ip="$APP_IP" -v newp="$NEW_PORT" -v oldp="$OLD_PORT" '
  /server [0-9.]+:(3001|3002)/ && !done1 {
    print "    server " ip ":" newp " max_fails=2 fail_timeout=5s;"
    done1=1
    next
  }
  /server [0-9.]+:(3001|3002)/ && done1 && !done2 {
    print "    server " ip ":" oldp " backup;"
    done2=1
    next
  }
  { print }
' "$CONF" > "$TMP"

# nginx -t always validates the live /etc/nginx tree, not an arbitrary file —
# and writing the file doesn't affect running workers until reload. So it's
# safe to move the new file into place, test it in situ, and restore the
# backup if invalid, all before anything is actually reloaded.
cp "$CONF" "${CONF}.pre-switch"   # last-known-good, for manual recovery
mv "$TMP" "$CONF"
trap - EXIT

log "Validating new config"
if ! nginx -t; then
  echo "ERROR: new config failed nginx -t — restoring previous config, nothing reloaded"
  mv "${CONF}.pre-switch" "$CONF"
  exit 1
fi

log "Reloading nginx (graceful)"
systemctl reload nginx

sleep 1

log "Verifying"
RESPONSE="$(curl -sf -H "Host: ${VHOST_FILE%.conf}" "http://127.0.0.1/api/health" || true)"
if [ -z "$RESPONSE" ]; then
  echo "ERROR: no response from nginx after reload"
  exit 1
fi
echo "$RESPONSE"

if [ -n "$EXPECTED_VERSION" ]; then
  if ! echo "$RESPONSE" | grep -q "\"version\":\"${EXPECTED_VERSION}\""; then
    echo "ERROR: response version does not match expected ${EXPECTED_VERSION}"
    exit 1
  fi
  log "Version confirmed: ${EXPECTED_VERSION}"
fi

log "OK: ${VHOST_FILE} now routing to port ${NEW_PORT}"
