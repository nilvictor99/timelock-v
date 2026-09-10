#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

LOG_DIR="$ROOT_DIR/logs"
RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)"
LOG_FILE="$LOG_DIR/clean-docker-$RUN_ID.md"
mkdir -p "$LOG_DIR"
{
  echo "# TimeLock-v - limpieza Docker"
  echo
  echo "- **ID:** \`$RUN_ID\`"
  echo "- **Inicio UTC:** $(date -u --iso-8601=seconds)"
  echo
  echo "## Checklist de limpieza"
} > "$LOG_FILE"
exec > >(tee -a "$LOG_FILE") 2>&1
log() { echo "- **$(date -u --iso-8601=seconds):** $*"; }
check_absent() {
  local label="$1"
  shift
  if ! "$@" >/dev/null 2>&1; then log "[x] $label"; else log "[ ] $label - pendiente"; fi
}

command -v docker >/dev/null 2>&1 || { log "[ ] Docker disponible"; exit 1; }
docker info >/dev/null 2>&1 || { log "[ ] Docker ejecutándose"; exit 1; }

log "Limpieza Docker iniciada. Solo se tocará el proyecto Compose de TimeLock-v."
docker compose down --volumes --remove-orphans --rmi local
check_absent "Contenedor timelock-app eliminado" docker ps -a --format '{{.Names}}' --filter name=^timelock-app$
check_absent "Contenedor timelock-postgres eliminado" docker ps -a --format '{{.Names}}' --filter name=^timelock-postgres$
check_absent "Volumen timelock_postgres eliminado" docker volume inspect timelock_postgres
rm -rf "$ROOT_DIR/.timelock-v"
check_absent "Metadatos .timelock-v eliminados" test -e "$ROOT_DIR/.timelock-v"
log "[x] Registro de limpieza guardado en $LOG_FILE"
log "Limpieza Docker completada. No se detuvieron contenedores ajenos a TimeLock-v."
