#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

RUNTIME_DIR="$ROOT_DIR/.timelock-v"
LOG_DIR="$ROOT_DIR/logs"
RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)"
LOG_FILE="$LOG_DIR/clean-local-$RUN_ID.md"
mkdir -p "$LOG_DIR"
{
  echo "# TimeLock-v - limpieza local"
  echo
  echo "- **ID:** \`$RUN_ID\`"
  echo "- **Inicio UTC:** $(date -u --iso-8601=seconds)"
  echo
  echo "## Checklist de limpieza"
} > "$LOG_FILE"
exec >> "$LOG_FILE" 2>&1
log() { echo "- **$(date -u --iso-8601=seconds):** $*"; }
status() {
  if [[ -w /dev/tty ]]; then
    printf '%s\n' "$*" > /dev/tty
  else
    printf '%s\n' "$*"
  fi
}
check() {
  local label="$1"
  shift
  if "$@" >/dev/null 2>&1; then log "[x] $label"; else log "[ ] $label - pendiente o no encontrado"; fi
}
status "TimeLock-v: limpiando archivos locales..."
log "Limpieza local iniciada. Este registro se conserva como comprobante."

port_available() {
  local port="$1"
  if command -v ss >/dev/null 2>&1; then
    ! ss -H -ltn "( sport = :$port )" 2>/dev/null | grep -q .
  else
    ! timeout 1 bash -c ":</dev/tcp/127.0.0.1/$port" >/dev/null 2>&1
  fi
}

log "RESTRICCIÓN: clean.sh no detiene ni elimina PostgreSQL del sistema ni recursos Docker."

if [[ -f "$RUNTIME_DIR/app.pid" ]]; then
  pid="$(cat "$RUNTIME_DIR/app.pid")"
  if [[ "$pid" =~ ^[0-9]+$ ]] && kill -0 "$pid" 2>/dev/null; then
    kill "$pid" 2>/dev/null || true
    log "DETENIDO: proceso local de TimeLock-v PID $pid."
    status "✓ Servidor local detenido."
  fi
fi

if [[ -f "$RUNTIME_DIR/app.port" ]]; then
  app_port="$(cat "$RUNTIME_DIR/app.port")"
  if [[ "$app_port" =~ ^[0-9]+$ ]]; then
    check "Puerto de aplicación $app_port liberado" port_available "$app_port"
  fi
fi

rm -rf .next node_modules "$RUNTIME_DIR"
rm -f package-lock.json
check "Eliminado .next/" test ! -e .next
check "Eliminado node_modules/" test ! -e node_modules
check "Eliminado package-lock.json" test ! -e package-lock.json
check "Eliminado .timelock-v/ y sus puertos/PIDs registrados" test ! -e "$RUNTIME_DIR"

if [[ -f .env && -f .env.example ]] && cmp -s .env .env.example; then
  rm -f .env
  check "Eliminado .env generado automáticamente" test ! -e .env
else
  log "[i] .env conservado porque contiene configuración personalizada."
fi

if [[ -f "$LOG_FILE" ]]; then
  log "[x] Registro de limpieza guardado en $LOG_FILE"
fi
status "✓ Archivos temporales eliminados."
status "✓ Limpieza completada. PostgreSQL y Docker no fueron modificados."
log "Limpieza local completada. No se detuvieron procesos ajenos a TimeLock-v."
