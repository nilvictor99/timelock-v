#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
RUNTIME_DIR="$ROOT_DIR/.timelock-v"
LOG_DIR="$ROOT_DIR/logs"
RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)"
LOG_FILE="$LOG_DIR/start-local-$RUN_ID.md"
mkdir -p "$RUNTIME_DIR" "$LOG_DIR"
# shellcheck source=lib/common.sh
source "$ROOT_DIR/scripts/lib/common.sh"

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
  if ( exec 3<> /dev/tty ) 2>/dev/null; then
    printf '%s\n' "$*" > /dev/tty 2>/dev/null || printf '%s\n' "$*"
  else
    printf '%s\n' "$*"
  fi
  log "$*"
}

status "TimeLock-v: preparando el entorno local..."

fail() {
  log "ERROR: $*"
  log "El arranque terminó sin completar todos los pasos. Revísalo antes de ejecutar clean."
  status "Error: $*"
  status "Revisa el registro completo en: $LOG_FILE"
  exit 1
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
      status "Modo seleccionado: desarrollo."
      ;;
  esac
}

port_available() { tl_port_available "$1"; }
next_free_port() { tl_next_free_port "$1"; }
tcp_available() { tl_tcp_available "$1" "$2"; }

# Diagnóstico sin privilegios: ¿el puerto de la BD lo sirve el contenedor timelock-postgres?
docker_postgres_port() { # imprime el puerto host publicado por el contenedor ("" si no está)
  command -v docker >/dev/null 2>&1 || return 0
  docker ps --format '{{.Names}}' 2>/dev/null | grep -qx 'timelock-postgres' || return 0
  docker port timelock-postgres 5432/tcp 2>/dev/null | head -n1 | sed -E 's/^.*:([0-9]+)\s*$/\1/'
}

system_postgres_on_port() { # $1=puerto; 0 si un cluster PostgreSQL del sistema usa ese puerto
  command -v pg_lsclusters >/dev/null 2>&1 || return 1
  pg_lsclusters 2>/dev/null | awk -v p="$1" '$3 == p { exit 0 } END { exit 1 }'
}

check_database_credentials() {
  local result docker_pg system_pg
  docker_pg="$(docker_postgres_port)"
  system_pg="no"
  if system_postgres_on_port "$db_port"; then system_pg="yes"; fi
  if result="$(npm run db:check 2>&1)"; then
    log "REUTILIZADO: las credenciales de PostgreSQL fueron verificadas."
    if [[ -n "$docker_pg" && "$docker_pg" == "$db_port" ]]; then
      log "BD ÚNICA: la base de datos de localhost:$db_port la sirve el contenedor timelock-postgres (Docker)."
      status "✓ Usando el único PostgreSQL: contenedor timelock-postgres (localhost:$db_port)."
    else
      status "✓ PostgreSQL disponible en $db_host:$db_port."
    fi
    return 0
  fi
  log "ERROR: la verificación de credenciales de PostgreSQL falló."
  log "$result"
  if [[ "$result" == *"P1000"* ]]; then
    if [[ "$system_pg" == "yes" && -n "$docker_pg" && "$docker_pg" == "$db_port" ]]; then
      fail "PostgreSQL responde en $db_host:$db_port, pero hay un CONFLICTO de puertos: el cluster local del sistema y el contenedor timelock-postgres (Docker) compiten por $db_port y gana el local. Deja un solo PostgreSQL: sudo systemctl stop postgresql && sudo systemctl disable postgresql."
    elif [[ -n "$docker_pg" && "$docker_pg" == "$db_port" ]]; then
      fail "El PostgreSQL de Docker responde en $db_host:$db_port pero rechaza las credenciales. El volumen timelock_postgres puede tener credenciales antiguas; recrea la BD con ./scripts/clean-docker.sh."
    elif [[ -n "$docker_pg" ]]; then
      fail "El contenedor timelock-postgres publica en localhost:$docker_pg, pero DATABASE_URL usa $db_host:$db_port. Ejecuta ./scripts/start-docker.sh (modo dev) para sincronizar .env."
    else
      fail "PostgreSQL responde en $db_host:$db_port, pero rechaza las credenciales de DATABASE_URL. Crea o corrige el usuario timelock en ese PostgreSQL (por ejemplo: sudo -u postgres psql -c \"ALTER USER timelock WITH PASSWORD 'timelock';\") y vuelve a ejecutar ./scripts/start.sh."
    fi
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

# 1) Node.js y npm con versión mínima (Next.js 14 requiere Node >= 18).
tl_node_check_or_fail status fail

select_run_mode "$@"

# 2) .env: creación y carga SEGURA (sin `source`, nunca ejecuta su contenido).
#    Importante: se llama sin $(...) para que los export persistan en este shell.
env_rc=0
tl_load_env .env .env.example || env_rc=$?
if (( env_rc != 0 )); then
  fail "No se pudo preparar/cargar .env (código $env_rc). Líneas válidas: comentarios, vacías y VARIABLE=valor. Revisa el archivo y el registro en $LOG_FILE."
fi
case "$TL_ENV_OUTCOME" in
  created) log "CREADO: .env desde .env.example."; status "✓ Configuración local preparada." ;;
  *)       status "✓ Configuración local encontrada." ;;
esac

# 3) Puertos: app + PostgreSQL detectados desde DATABASE_URL.
APP_PORT="$(next_free_port "${APP_PORT:-3000}")" || fail "No hay puertos libres a partir de ${APP_PORT:-3000}."
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
log "Base de datos objetivo: $db_host:$db_port (según DATABASE_URL/DB_HOST/DB_PORT)."

# 4) Modo limpio: guardas de producción + confirmación explícita.
if [[ "$RUN_MODE" == "clean" ]]; then
  case "$db_host" in
    localhost|127.0.0.1|::1) ;;
    *) fail "El desarrollo limpio solo puede resetear una base de datos local (host detectado: $db_host)." ;;
  esac
  tl_clean_reset_guard status fail tl_confirm \
    "Esta opción eliminará todos los datos de la base de datos local y la caché local." \
    "No la uses en producción. Se regenerará la base de datos con migraciones (db:refresh) y luego el seed."
  rm -rf .next node_modules/.cache
  log "ELIMINADO: .next y node_modules/.cache por confirmación explícita."
  status "✓ Cachés locales eliminadas."
  CLEAN_RESET_CONFIRMED=1
else
  CLEAN_RESET_CONFIRMED=0
fi

# 5) PostgreSQL: verificar, iniciar servicio del sistema si hace falta y esperar.
if ! tcp_available "$db_host" "$db_port"; then
  try_start_system_postgres && tcp_available "$db_host" "$db_port" || true
fi
if ! tcp_available "$db_host" "$db_port"; then
  status "PostgreSQL no responde aún en $db_host:$db_port; esperando..."
  if ! tl_wait_tcp "$db_host" "$db_port" 15 2; then
    fail "No hay PostgreSQL respondiendo en $db_host:$db_port. Opciones: (1) usar Docker como único PostgreSQL ejecutando ./scripts/start-docker.sh (modo dev); la aplicación sigue corriendo aquí en el host. (2) instalar/activar un PostgreSQL local: sudo systemctl enable --now postgresql."
  fi
else
  log "REUTILIZADO: PostgreSQL existente en $db_host:$db_port."
fi
status "✓ PostgreSQL disponible en $db_host:$db_port."

# 6) Dependencias.
if [[ ! -d node_modules ]]; then
  log "CREADO: node_modules/ mediante npm install."
  status "Instalando dependencias... (puede tardar)"
  npm install --no-audit --no-fund || fail "npm install falló. Revisa el registro en $LOG_FILE."
else
  log "REUTILIZADO: node_modules/ existente."
  status "✓ Dependencias ya instaladas."
fi

# 7) Base de datos: credenciales, esquema y seed.
status "Verificando credenciales de PostgreSQL..."
check_database_credentials

log "EJECUTANDO: npm run db:migrate."
status "Aplicando migraciones de base de datos..."
if [[ "$CLEAN_RESET_CONFIRMED" == "1" ]]; then
  npm run db:refresh || fail "npm run db:refresh falló."
else
  npm run db:migrate || fail "npm run db:migrate falló."
fi

log "EJECUTANDO: npm run db:seed."
status "Cargando datos iniciales..."
npm run db:seed || fail "El seed falló."

# 8) Aviso de configuración de IA (no bloquea).
tl_check_ai_config log status

# 9) Arranque de la aplicación.
echo "$$" > "$RUNTIME_DIR/app.pid"
log "CREADO: .timelock-v/app.pid con PID $$. Para limpiar use: ./scripts/clean.sh."
if [[ "$RUN_MODE" == "production" ]]; then
  log "EJECUTANDO: npm run build."
  status "Construyendo producción... (puede tardar)"
  npm run build || fail "npm run build falló. Revisa el registro en $LOG_FILE."
  # En modo standalone, Next.js no copia .next/static ni public/ al servidor:
  # sin este paso la app arranca pero carga la página sin CSS/JS (error típico de arranque).
  if [[ ! -d .next/standalone/public ]] && [[ -d public ]]; then
    cp -r public .next/standalone/public || fail "No se pudo copiar public/ al servidor standalone."
    log "COPIADO: public/ a .next/standalone/public (necesario en modo standalone)."
  fi
  if [[ -d .next/static ]] && [[ ! -d .next/standalone/.next/static ]]; then
    cp -r .next/static .next/standalone/.next/static || fail "No se pudo copiar .next/static al servidor standalone."
    log "COPIADO: .next/static a .next/standalone/.next/static (necesario en modo standalone)."
  fi
  log "EJECUTANDO: node .next/standalone/server.js."
  status "✓ Build completado. Iniciando servidor de producción..."
  status "✓ Aplicación disponible en http://localhost:$APP_PORT"
  export PORT="$APP_PORT"
  exec node .next/standalone/server.js
else
  log "EJECUTANDO: npm run dev (vía next dev)."
  status "✓ Preparación completada. Iniciando desarrollo..."
  status "✓ Aplicación disponible en http://localhost:$APP_PORT"
  exec npx next dev -p "$APP_PORT"
fi
