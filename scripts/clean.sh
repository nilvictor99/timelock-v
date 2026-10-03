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
log "RESTRICCIÓN: clean.sh no detiene ni elimina PostgreSQL del sistema ni recursos Docker."

# 1) Detener el proceso local registrado (solo si sigue vivo y es node/next).
if [[ -f "$RUNTIME_DIR/app.pid" ]]; then
  pid="$(cat "$RUNTIME_DIR/app.pid")"
  if [[ "$pid" =~ ^[0-9]+$ ]] && kill -0 "$pid" 2>/dev/null; then
    if grep -qa "node" "/proc/$pid/comm" 2>/dev/null || grep -qa "next" "/proc/$pid/comm" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      log "DETENIDO: proceso local de TimeLock-v PID $pid."
      status "✓ Servidor local detenido."
    else
      log "[i] PID $pid registrado pero no parece un proceso node/next; no se detuvo."
    fi
  fi
fi

# 2) Verificar que los puertos registrados quedan libres.
if [[ -f "$RUNTIME_DIR/app.port" ]]; then
  app_port="$(cat "$RUNTIME_DIR/app.port")"
  if [[ "$app_port" =~ ^[0-9]+$ ]]; then
    if ! (command -v ss >/dev/null 2>&1 && ss -H -ltn "( sport = :$app_port )" 2>/dev/null | grep -q .); then
      check "Puerto de aplicación $app_port liberado" test true
    else
      log "[ ] Puerto de aplicación $app_port aún ocupado"
    fi
  fi
fi

# 3) Eliminar artefactos de build, cachés y metadatos.
rm -rf .next node_modules "$RUNTIME_DIR"
rm -f package-lock.json
rm -f tsconfig.tsbuildinfo next-env.d.ts.bak
check "Eliminado .next/" test ! -e .next
check "Eliminado node_modules/" test ! -e node_modules
check "Eliminado package-lock.json" test ! -e package-lock.json
check "Eliminado .timelock-v/ y sus puertos/PIDs registrados" test ! -e "$RUNTIME_DIR"

# 4) .env: conservar configuración personalizada; borrar solo si es idéntica a la plantilla.
if [[ -f .env ]]; then
  if [[ -f .env.example ]] && cmp -s .env .env.example; then
    rm -f .env
    check "Eliminado .env generado automáticamente" test ! -e .env
  else
    log "[i] .env conservado porque contiene configuración personalizada (claves de IA, puertos, etc.)."
  fi
fi

if [[ -f "$LOG_FILE" ]]; then
  log "[x] Registro de limpieza guardado en $LOG_FILE"
fi
status "✓ Archivos temporales eliminados."
status "✓ Limpieza completada. PostgreSQL y Docker no fueron modificados."
log "Limpieza local completada. No se detuvieron procesos ajenos a TimeLock-v."
