#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
RUNTIME_DIR="$ROOT_DIR/.timelock-v"
LOG_DIR="$ROOT_DIR/logs"
RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)"
LOG_FILE="$LOG_DIR/start-docker-$RUN_ID.md"
mkdir -p "$RUNTIME_DIR" "$LOG_DIR"
{
  echo "# TimeLock-v - arranque Docker"
  echo
  echo "- **ID:** \`$RUN_ID\`"
  echo "- **Inicio UTC:** $(date -u --iso-8601=seconds)"
  echo "- **Directorio:** \`$ROOT_DIR\`"
  echo "- **Modo:** Docker Compose (aplicación + PostgreSQL)"
  echo
  echo "## Registro"
} > "$LOG_FILE"
log() { echo "- **$(date -u --iso-8601=seconds):** $*" >> "$LOG_FILE"; }
status() {
  if [[ -t 1 && -w /dev/tty ]]; then
    printf '%s\n' "$*" > /dev/tty
  else
    printf '%s\n' "$*"
  fi
  log "$*"
}
exec >> "$LOG_FILE" 2>&1
status "TimeLock-v: preparando el entorno Docker..."
log "Script iniciado."
log "Archivos/recursos posibles: .timelock-v/, imagen local, contenedores timelock-app/timelock-postgres y volumen timelock_postgres."

fail() {
  status "Error: $*"
  echo "Error: $*" >&2
  exit 1
}

port_available() {
  local port="$1"
  if command -v ss >/dev/null 2>&1; then
    ! ss -H -ltn "( sport = :$port )" 2>/dev/null | grep -q .
  else
    ! timeout 1 bash -c ":</dev/tcp/127.0.0.1/$port" >/dev/null 2>&1
  fi
}

next_free_port() {
  local port="$1"
  while ! port_available "$port"; do port=$((port + 1)); done
  printf '%s' "$port"
}

command -v docker >/dev/null 2>&1 || fail "Docker es necesario para este arranque."
docker info >/dev/null 2>&1 || fail "Docker está instalado pero no está ejecutándose."
status "✓ Docker disponible."

APP_PORT="$(next_free_port "${APP_PORT:-3000}")"
POSTGRES_PORT="$(next_free_port "${POSTGRES_PORT:-5432}")"
export APP_PORT POSTGRES_PORT
printf '%s\n' "$APP_PORT" > "$RUNTIME_DIR/app.port"
printf '%s\n' "$POSTGRES_PORT" > "$RUNTIME_DIR/postgres.port"
touch "$RUNTIME_DIR/docker.started"
log "PUERTO RESERVADO: aplicación en localhost:$APP_PORT."
log "PUERTO RESERVADO: PostgreSQL en localhost:$POSTGRES_PORT."
log "CREADO/ACTUALIZADO: .timelock-v/app.port, .timelock-v/postgres.port y .timelock-v/docker.started."
status "✓ Puertos seleccionados: aplicación $APP_PORT, PostgreSQL $POSTGRES_PORT."

log "EJECUTANDO: docker compose up --build."
log "RECURSOS ESPERADOS: contenedores timelock-app y timelock-postgres, volumen timelock_postgres e imagen local de la aplicación."
status "Construyendo e iniciando contenedores..."
docker compose up --build
