#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
RUNTIME_DIR="$ROOT_DIR/.timelock-v"
LOG_DIR="$ROOT_DIR/logs"
RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)"
LOG_FILE="$LOG_DIR/start-local-$RUN_ID.md"
mkdir -p "$RUNTIME_DIR" "$LOG_DIR"

{
  echo "# TimeLock-v - arranque local"
  echo
  echo "- **ID:** \`$RUN_ID\`"
  echo "- **Inicio UTC:** $(date -u --iso-8601=seconds)"
  echo "- **Directorio:** \`$ROOT_DIR\`"
  echo "- **Modo:** local, sin Docker"
  echo
  echo "## Registro"
} > "$LOG_FILE"
log() { echo "- **$(date -u --iso-8601=seconds):** $*" >> "$LOG_FILE"; }
status() {
  if [[ -w /dev/tty ]]; then
    printf '%s\n' "$*" > /dev/tty
  else
    printf '%s\n' "$*"
  fi
  log "$*"
}

select_run_mode() {
  local choice
  case "${START_MODE:-${1:-}}" in
    2|build|production|produccion|producción)
      RUN_MODE="production"
      status "Modo seleccionado: producción."
      return
      ;;
    1|dev|development|desarrollo)
      RUN_MODE="dev"
      status "Modo seleccionado: desarrollo."
      return
      ;;
    3|clean|clean-dev|desarrollo-limpio)
      RUN_MODE="clean"
      status "Modo seleccionado: desarrollo limpio."
      return
      ;;
  esac

  if [[ ! -t 0 ]]; then
    RUN_MODE="dev"
    log "MODO AUTOMÁTICO: dev porque no hay terminal interactiva."
    return
  fi

  if [[ -t 0 && -r /dev/tty ]]; then
    printf '\n¿Cómo quieres iniciar TimeLock-v?\n' > /dev/tty
    printf '  1) Desarrollo (npm run dev)\n' > /dev/tty
    printf '  2) Producción (npm run build && npm start)\n' > /dev/tty
    printf '  3) Desarrollo limpio (reset local de caché y base de datos)\n' > /dev/tty
    printf 'Selecciona [1]: ' > /dev/tty
    IFS= read -r choice < /dev/tty || choice="1"
  else
    printf '\n¿Cómo quieres iniciar TimeLock-v?\n'
    printf '  1) Desarrollo (npm run dev)\n'
    printf '  2) Producción (npm run build && npm start)\n'
    printf '  3) Desarrollo limpio (reset local de caché y base de datos)\n'
    printf 'Selecciona [1]: '
    IFS= read -r choice || choice="1"
  fi

  case "${choice:-1}" in
    1|dev|desarrollo)
      RUN_MODE="dev"
      status "Modo seleccionado: desarrollo."
      ;;
    2|build|produccion|producción)
      RUN_MODE="production"
      status "Modo seleccionado: producción."
      ;;
    3|clean|clean-dev|desarrollo-limpio)
      RUN_MODE="clean"
      status "Modo seleccionado: desarrollo limpio."
      ;;
    *)
      RUN_MODE="dev"
      status "Opción no válida; se usará desarrollo."
      ;;
  esac
}
exec >> "$LOG_FILE" 2>&1

status "TimeLock-v: preparando el entorno local..."
fail() {
  log "ERROR: $*"
  log "El arranque terminó sin completar todos los pasos. Revisar este registro antes de ejecutar clean."
  status "Error: $*"
  status "Revisa el registro completo en: $LOG_FILE"
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

tcp_available() {
  local host="$1" port="$2"
  timeout 1 bash -c ":</dev/tcp/$host/$port" >/dev/null 2>&1
}

check_database_credentials() {
  local result
  if result="$(printf 'SELECT 1;' | npx prisma db execute --stdin 2>&1)"; then
    log "REUTILIZADO: las credenciales de PostgreSQL fueron verificadas."
    return 0
  fi

  log "ERROR: la verificación de credenciales de PostgreSQL falló."
  log "$result"
  if [[ "$result" == *"P1000"* ]]; then
    fail "PostgreSQL responde en $db_host:$db_port, pero rechaza las credenciales de DATABASE_URL. Crea o corrige el usuario timelock (por ejemplo: sudo -u postgres psql -c \"ALTER USER timelock WITH PASSWORD 'timelock';\") y vuelve a ejecutar ./scripts/start.sh."
  fi
  fail "No se pudo autenticar contra PostgreSQL en $db_host:$db_port. Revisa DATABASE_URL en .env y el registro completo en $LOG_FILE."
}

try_start_system_postgres() {
  command -v systemctl >/dev/null 2>&1 || return 1
  local service
  service="$(systemctl list-unit-files --type=service --no-legend 'postgresql*.service' 2>/dev/null | awk '$1 ~ /^postgresql/ { print $1; exit }')"
  [[ -n "$service" ]] || return 1
  log "PostgreSQL instalado pero detenido; intentando iniciar $service."
  if systemctl is-active --quiet "$service"; then return 0; fi
  if systemctl start "$service" >/dev/null 2>&1; then
    log "REUTILIZADO: servicio PostgreSQL del sistema iniciado mediante systemctl."
    return 0
  fi
  log "No se pudo iniciar $service automáticamente; puede requerir permisos administrativos."
  return 1
}

log "Script iniciado."
log "Archivos que este arranque puede crear: .env, node_modules/, .next/, package-lock.json y .timelock-v/."
log "RESTRICCIÓN: este script nunca inicia, inspecciona ni elimina Docker."

command -v node >/dev/null 2>&1 || fail "Node.js es necesario para el arranque local."
command -v npm >/dev/null 2>&1 || fail "npm es necesario para el arranque local."
status "✓ Node.js y npm disponibles."
select_run_mode "$@"

if [[ ! -f .env ]]; then
  cp .env.example .env
  log "CREADO: .env desde .env.example."
  status "✓ Configuración local preparada."
else
  status "✓ Configuración local encontrada."
fi

set -a
source .env
set +a

APP_PORT="$(next_free_port "${APP_PORT:-3000}")"
export APP_PORT PORT="$APP_PORT"
echo "$APP_PORT" > "$RUNTIME_DIR/app.port"
log "PUERTO RESERVADO: aplicación Next.js en localhost:$APP_PORT."
status "✓ Puerto de la aplicación seleccionado: $APP_PORT."

db_host="${DB_HOST:-localhost}"
db_port="${DB_PORT:-5432}"
if [[ "${DATABASE_URL:-}" =~ @([^:/]+):([0-9]+)/ ]]; then
  db_host="${BASH_REMATCH[1]}"
  db_port="${BASH_REMATCH[2]}"
fi

if [[ "$RUN_MODE" == "clean" ]]; then
  if [[ "${NODE_ENV:-development}" == "production" || "${VERCEL:-}" == "1" ]]; then
    fail "El desarrollo limpio está bloqueado en producción."
  fi
  case "$db_host" in
    localhost|127.0.0.1|::1) ;;
    *) fail "El desarrollo limpio solo puede resetear una base de datos local (host detectado: $db_host)." ;;
  esac
  status "⚠️ Esta opción eliminará todos los datos de la base de datos local y la caché local."
  status "⚠️ No uses esta opción en producción. Se ejecutará Prisma db push --force-reset y luego el seed."
  clean_confirmation=""
  if [[ -r /dev/tty ]]; then
    printf '¿Continuar? (s/n): ' > /dev/tty
    IFS= read -r clean_confirmation < /dev/tty || clean_confirmation="n"
  elif [[ -t 0 ]]; then
    printf '¿Continuar? (s/n): '
    IFS= read -r clean_confirmation || clean_confirmation="n"
  else
    fail "La opción 3 requiere una confirmación interactiva; no se ejecutó ningún reset."
  fi
  if [[ ! "$clean_confirmation" =~ ^[YySs]$ ]]; then
    status "Desarrollo limpio cancelado; no se modificó la caché ni la base de datos."
    exit 0
  fi
  rm -rf .next node_modules/.cache
  log "ELIMINADO: .next y node_modules/.cache por confirmación explícita."
  status "✓ Cachés locales eliminadas."
  CLEAN_RESET_CONFIRMED=1
else
  CLEAN_RESET_CONFIRMED=0
fi

if ! tcp_available "$db_host" "$db_port"; then
  if try_start_system_postgres && tcp_available "$db_host" "$db_port"; then
    log "PostgreSQL del sistema responde en $db_host:$db_port."
  else
    fail "PostgreSQL local no responde en $db_host:$db_port. Instala PostgreSQL y ejecuta 'sudo systemctl enable --now postgresql'. Para usar Docker, ejecuta ./scripts/start-docker.sh."
  fi
else
  log "REUTILIZADO: PostgreSQL existente en $db_host:$db_port."
  status "✓ PostgreSQL disponible en $db_host:$db_port."
fi

if [[ ! -d node_modules ]]; then
  log "CREADO: node_modules/ mediante npm install."
  status "Instalando dependencias..."
  npm install
else
  log "REUTILIZADO: node_modules/ existente."
  status "✓ Dependencias encontradas."
fi

log "VERIFICANDO: credenciales de PostgreSQL."
status "Verificando credenciales de PostgreSQL..."
check_database_credentials

log "EJECUTANDO: npx prisma generate."
status "Preparando base de datos..."
npx prisma generate
log "EJECUTANDO: npx prisma db push."
status "Aplicando esquema de base de datos..."
if [[ "$CLEAN_RESET_CONFIRMED" == "1" ]]; then
  npx prisma db push --force-reset
else
  npx prisma db push
fi
log "EJECUTANDO: npm run db:seed."
status "Cargando datos iniciales..."
npm run db:seed
echo "$$" > "$RUNTIME_DIR/app.pid"
log "CREADO: .timelock-v/app.pid con PID $$."
log "Para limpiar los recursos registrados use: ./scripts/clean.sh."
if [[ "$RUN_MODE" == "production" ]]; then
  log "EJECUTANDO: npm run build."
  status "Construyendo producción... (puede tardar)"
  npm run build
  log "EJECUTANDO: npm start."
  status "✓ Build completado. Iniciando servidor de producción..."
  status "✓ Aplicación disponible en http://localhost:$APP_PORT"
  export PORT="$APP_PORT"
  exec node .next/standalone/server.js
else
  log "EJECUTANDO: npm run dev."
  status "✓ Preparación completada. Iniciando desarrollo..."
  status "✓ Aplicación disponible en http://localhost:$APP_PORT"
  exec npx next dev -p "$APP_PORT"
fi
