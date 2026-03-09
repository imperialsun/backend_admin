#!/bin/sh
set -eu

BACKEND_URL="${BACKEND_BASE_URL:-http://localhost:8080/api/v1}"
ESCAPED_BACKEND_URL=$(printf '%s' "$BACKEND_URL" | sed 's/\\/\\\\/g; s/"/\\"/g')

cat > /usr/share/nginx/html/runtime-config.js <<EOF
window.__APP_RUNTIME_CONFIG__ = {
  backendBaseUrl: "$ESCAPED_BACKEND_URL",
}
EOF

exec "$@"
