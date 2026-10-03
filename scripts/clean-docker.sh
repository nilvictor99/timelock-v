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

# Reescribe solo el host:puerto de la línea DATABASE_URL de .env, preservando
# credenciales, base de datos, opciones y el resto del archivo.
restore_default_database_url() { # vuelve DATABASE_URL a localhost:5432 (flujo local no Docker)
  [[ -f "$ROOT_DIR/.env" ]] || return 0
  local line key value dburl tmp
  tmp="$(mktemp)"
  while IFS= read -r line || [[ -n "$line" ]]; do
    key="${line%%=*}"
    if [[ "$key" == "DATABASE_URL" ]]; then
      value="${line#*=}"
      value="${value#\"}"; value="${value%\"}"
      dburl="$(printf '%s' "$value" | sed -E 's#@([^:@/]+):[0-9]+/#@localhost:5432/#')"
      if [[ -n "$dburl" && "$dburl" != "$value" ]]; then
        printf 'DATABASE_URL="%s"\n' "$dburl" >> "$tmp"
        continue
      fi
    fi
    printf '%s\n' "$line" >> "$tmp"
  done < "$ROOT_DIR/.env"
  mv "$tmp" "$ROOT_DIR/.env"
  log "RESTAURADO: DATABASE_URL de .env vuelve a localhost:5432 (flujo local)."
}

command -v docker >/dev/null 2>&1 || { log "[ ] Docker disponible"; echo "Error: Docker no está instalado." >&2; exit 1; }
docker info >/dev/null 2>&1 || { log "[ ] Docker ejecutándose"; echo "Error: Docker no está ejecutándose." >&2; exit 1; }

confirm_deletion="no"
if [[ "${1:-}" == "--yes" || "${CLEAN_DOCKER_YES:-0}" == "1" ]]; then
  confirm_deletion="forced"
  echo "Modo no interactivo: se eliminarán contenedores, volumen de base de datos e imagen local de TimeLock-v."
else
  echo "⚠️  Esta limpieza eliminará de forma permanente:"
  echo "   - Contenedores timelock-app, timelock-postgres y timelock-pgadmin"
  echo "   - Volumen timelock_postgres (TODOS los datos de la base de datos)"
  echo "   - Imagen local de la aplicación"
  if [[ -r /dev/tty ]]; then
    printf '¿Continuar? (s/n): ' > /dev/tty
    IFS= read -r reply < /dev/tty || reply="n"
  elif [[ -t 0 ]]; then
    printf '¿Continuar? (s/n): '
    IFS= read -r reply || reply="n"
  else
    echo "No hay terminal interactiva: cancelado (usa --yes para forzar)." >&2
    exit 1
  fi
  if [[ ! "$reply" =~ ^[[:space:]]*([YySs]|si|SI|Si|sí|SÍ|yes|YES|Yes)([[:space:]]|$) ]]; then
    echo "Cancelado; no se eliminó nada." >&2
    exit 0
  fi
  confirm_deletion="confirmed"
fi
log "Limpieza Docker iniciada (modo: $confirm_deletion). Solo se tocará el proyecto Compose de TimeLock-v."

log "EJECUTANDO: docker compose down --volumes --remove-orphans."
if ! docker compose down --volumes --remove-orphans; then
  log "[ ] docker compose down - pendiente (sigue el checklist para ver qué quedó)"
fi

log "EJECUTANDO: docker rmi timelock-v-app (imagen local de la aplicación)."
docker rmi timelock-v-app >/dev/null 2>&1 || true

check_absent "Contenedor timelock-app eliminado" docker ps -a --format '{{.Names}}' --filter name=^timelock-app$
check_absent "Contenedor timelock-postgres eliminado" docker ps -a --format '{{.Names}}' --filter name=^timelock-postgres$
check_absent "Contenedor timelock-pgadmin eliminado" docker ps -a --format '{{.Names}}' --filter name=^timelock-pgadmin$
check_absent "Volumen timelock_postgres eliminado" docker volume inspect timelock_postgres
check_absent "Imagen local de la aplicación eliminada" docker image inspect timelock-v-app

rm -rf "$ROOT_DIR/.timelock-v"
check_absent "Metadatos .timelock-v eliminados" test -e "$ROOT_DIR/.timelock-v"

restore_default_database_url

log "[x] Registro de limpieza guardado en $LOG_FILE"
echo "✓ Limpieza Docker completada. No se detuvieron contenedores ajenos a TimeLock-v."
