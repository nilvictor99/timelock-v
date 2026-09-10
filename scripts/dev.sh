#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Se creó .env desde .env.example."
fi

set -a
source .env
set +a

db_host="localhost"
db_port="5432"
if [[ "${DATABASE_URL:-}" =~ @([^:/]+):([0-9]+)/ ]]; then
  db_host="${BASH_REMATCH[1]}"
  db_port="${BASH_REMATCH[2]}"
fi

if ! timeout 1 bash -c ":</dev/tcp/$db_host/$db_port" >/dev/null 2>&1; then
  echo "Error: PostgreSQL no está disponible en $db_host:$db_port." >&2
  echo "Ejecuta ./scripts/start.sh o inicia PostgreSQL/Docker antes de usar npm run dev." >&2
  exit 1
fi

if ! db_check="$(printf 'SELECT 1;' | npx prisma db execute --stdin 2>&1)"; then
  if [[ "$db_check" == *"P1000"* ]]; then
    echo "Error: PostgreSQL responde en $db_host:$db_port, pero rechaza las credenciales de DATABASE_URL." >&2
    echo "Corrige el usuario/contraseña de .env o ejecuta: sudo -u postgres psql -c \"ALTER USER timelock WITH PASSWORD 'timelock';\"" >&2
  else
    echo "$db_check" >&2
  fi
  exit 1
fi

exec npx next dev "$@"
