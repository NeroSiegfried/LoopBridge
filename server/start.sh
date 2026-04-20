#!/bin/sh
# start.sh — restore DB from S3 (if Litestream is configured), then
# launch Litestream as a sidecar that replays every write to S3 while
# the Node process runs.
#
# If LITESTREAM_S3_PATH is not set the script just starts the app
# directly, so non-Litestream deployments work unchanged.

set -e

if [ -z "$LITESTREAM_S3_PATH" ]; then
  echo "[start] Litestream not configured — starting app directly"
  exec node /app/server/index.js
fi

echo "[start] Litestream enabled — replica: $LITESTREAM_S3_PATH"

# Ensure the DB directory exists
mkdir -p "$(dirname "$DB_PATH")"

# Restore latest snapshot from S3 (no-op if the replica is empty on first run)
if litestream restore -if-replica-exists -config /app/server/litestream.yml "$DB_PATH"; then
  echo "[start] Database restored from S3"
else
  echo "[start] No snapshot found — starting fresh"
fi

# Run Litestream as the parent process; it will exec the app as a child.
# When the app exits, Litestream flushes and exits too.
exec litestream replicate \
  -config /app/server/litestream.yml \
  -exec "node /app/server/index.js"
