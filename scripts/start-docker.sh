#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
RUNTIME_DIR="$ROOT_DIR/.timelock-v"
LOG_DIR="$ROOT_DIR/logs"
RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)"
LOG_FILE="$LOG_DIR/start-docker-$RUN_ID.md"
mkdir -p "$RUNTIME_DIR" "$LOG_DIR"
# shellcheck source=lib/common.sh
source "$ROOT_DIR/scripts/lib/common.sh"

{
  echo "# TimeLock-v - arranque Docker"
  echo
  echo "- **ID:** \`$RUN_ID\`"
  echo "- **Inicio UTC:** $(date -u --iso-8601=seconds)"
  echo "- **Directorio:** \`$ROOT_DIR\`"
  echo "- **Modo:** Docker Compose (aplicación + PostgreSQL + pgAdmin)"
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

status "TimeLock-v: preparando el entorno Docker..."
log "Script iniciado."
log "Archivos que este arranque puede crear: .env, .timelock-v/ y logs/."
log "RECURSOS ESPERADOS: contenedores timelock-app/timelock-postgres/timelock-pgadmin, volumen timelock_postgres e imagen local de la aplicación."
log "RESTRICCIÓN: este script solo opera sobre el proyecto Compose de TimeLock-v; nunca toca contenedores, volúmenes ni cachés ajenos."

fail() {
  log "ERROR: $*"
  log "El arranque terminó sin completar todos los pasos. Revisar este registro antes de ejecutar clean-docker."
  status "Error: $*"
  status "Revisa el registro completo en: $LOG_FILE"
  exit 1
}

port_available() { tl_port_available "$1"; }
next_free_port() { tl_next_free_port "$1"; }

# Puerto host publicado por un contenedor existente del proyecto ("" si no existe).
# Evita el "drift": re-arrancar no debe desplazar el puerto (5432 -> 5433 -> ...).
existing_host_port() { # $1=contenedor $2=puerto interno
  command -v docker >/dev/null 2>&1 || { printf ''; return 0; }
  if ! docker ps -a --format '{{.Names}}' 2>/dev/null | grep -qx "$1"; then
    printf ''; return 0
  fi
  docker port "$1" "$2/tcp" 2>/dev/null | head -n1 | sed -E 's/^.*:([0-9]+)\s*$/\1/'
}

# Selecciona un puerto: reutiliza el del contenedor existente, sino el próximo libre.
stable_or_free_port() { # $1=contenedor $2=puerto interno $3=puerto base
  local p
  p="$(existing_host_port "$1" "$2")"
  [[ -n "$p" ]] && { printf '%s' "$p"; return 0; }
  next_free_port "${3:-$2}" || return 1
}

wait_for_app() {
  command -v curl >/dev/null 2>&1 || {
    log "curl no disponible; se omite la espera activa de salud."
    return 0
  }
  local attempts=60 i
  for ((i = 1; i <= attempts; i++)); do
    if curl -sf -o /dev/null "http://localhost:$APP_PORT"; then
      return 0
    fi
    sleep 2
  done
  return 1
}

# Espera a que el contenedor alcance el healthcheck "healthy" (el volumen nuevo
# tarda en inicializarse; un TCP abierto no garantiza que Postgres acepte login).
wait_container_healthy() { # $1=contenedor $2=intentos $3=pausa_seg
  local i st
  for ((i = 1; i <= $2; i++)); do
    st="$(docker inspect --format '{{.State.Health.Status}}' "$1" 2>/dev/null || printf '')"
    [[ "$st" == "healthy" ]] && return 0
    sleep "$3"
  done
  return 1
}

# Reescribe solo el host:puerto de la línea DATABASE_URL de .env, preservando
# credenciales, base de datos, opciones y el resto del archivo. Deja el nuevo
# valor en la variable global TL_NEW_DATABASE_URL ("" si no cambió).
rewrite_database_url_port() { # $1 = nuevo host:puerto (p. ej. localhost:5433)
  local line key value dburl tmp
  tmp="$(mktemp)"
  TL_NEW_DATABASE_URL=""
  while IFS= read -r line || [[ -n "$line" ]]; do
    key="${line%%=*}"
    if [[ "$key" == "DATABASE_URL" ]]; then
      value="${line#*=}"
      value="${value#\"}"; value="${value%\"}"
      dburl="$(printf '%s' "$value" | sed -E "s#@([^:@/]+):[0-9]+/#@$1/#")"
      if [[ -n "$dburl" && "$dburl" != "$value" ]]; then
        printf 'DATABASE_URL="%s"\n' "$dburl" >> "$tmp"
        TL_NEW_DATABASE_URL="$dburl"
        continue
      fi
    fi
    printf '%s\n' "$line" >> "$tmp"
  done < "$ROOT_DIR/.env"
  mv "$tmp" "$ROOT_DIR/.env"
}

# Apunta DATABASE_URL de .env al PostgreSQL que corre en Docker (para npm run dev).
# Además refresca la variable exportada en el shell: si no, npm/db (proceso hijo)
# seguiría usando el DATABASE_URL antiguo y daría un falso "no reachable" (P1001).
set_docker_database_url() {
  if [[ -f "$ROOT_DIR/.env" ]]; then
    rewrite_database_url_port "localhost:$POSTGRES_PORT"
    if [[ -n "$TL_NEW_DATABASE_URL" ]]; then
      export DATABASE_URL="$TL_NEW_DATABASE_URL"
      log "ACTUALIZADO: DATABASE_URL de .env apunta al PostgreSQL Docker (localhost:$POSTGRES_PORT)."
    fi
  fi
}

select_run_mode() {
  local choice
  case "${START_MODE:-${1:-}}" in
    1|all|stack|todo|production|produccion|producción)
      RUN_MODE="production"
      status "Modo seleccionado: producción (todo en Docker)."
      return
      ;;
    2|dev|development|desarrollo)
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
    printf '\n¿Cómo quieres iniciar TimeLock-v (Docker)?\n' > /dev/tty
    printf '  1) Todo en Docker: app + PostgreSQL + pgAdmin empaquetados (recomendado).\n' > /dev/tty
    printf '  2) Desarrollo: app en el host con hot-reload; PostgreSQL + pgAdmin en Docker.\n' > /dev/tty
    printf '  3) Desarrollo limpio: reset de contenedores, volumen e imagen Docker.\n' > /dev/tty
    printf 'Selecciona [1]: ' > /dev/tty
    IFS= read -r choice < /dev/tty || choice="1"
  else
    printf '\n¿Cómo quieres iniciar TimeLock-v (Docker)?\n'
    printf '  1) Todo en Docker: app + PostgreSQL + pgAdmin empaquetados (recomendado).\n'
    printf '  2) Desarrollo: app en el host con hot-reload; PostgreSQL + pgAdmin en Docker.\n'
    printf '  3) Desarrollo limpio: reset de contenedores, volumen e imagen Docker.\n'
    printf 'Selecciona [1]: '
    IFS= read -r choice || choice="1"
  fi

  case "${choice:-1}" in
    1|all|stack|todo|production|produccion|producción)
      RUN_MODE="production"
      status "Modo seleccionado: producción (todo en Docker)."
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

# 1) Docker + Compose v2 (el proyecto usa `docker compose`, no `docker-compose`).
command -v docker >/dev/null 2>&1 || fail "Docker es necesario para este arranque."
docker info >/dev/null 2>&1 || fail "Docker está instalado pero no está ejecutándose. Inicia Docker Desktop o el servicio docker y vuelve a intentarlo."
docker compose version >/dev/null 2>&1 || fail "Se necesita Docker Compose v2 (comando 'docker compose'). Instala la versión actual del plugin de Compose."
status "✓ Docker disponible."

select_run_mode "$@"

# 2) .env: creación y carga SEGURA (sin `source`; las variables se exportan
#    y docker-compose.yml las usa para ${APP_PORT} y ${POSTGRES_PORT}).
#    Importante: se llama sin $(...) para que los export persistan en este shell.
env_rc=0
tl_load_env .env .env.example || env_rc=$?
if (( env_rc != 0 )); then
  fail "No se pudo preparar/cargar .env (código $env_rc). Líneas válidas: comentarios, vacías y VARIABLE=valor."
fi
case "$TL_ENV_OUTCOME" in
  created) log "CREADO: .env desde .env.example."; status "✓ Configuración local preparada." ;;
  *)       status "✓ Configuración local encontrada." ;;
esac

# 3) Puertos de app, PostgreSQL y pgAdmin.
#    Anti-drift: si el contenedor del proyecto ya existe, se reutiliza su puerto
#    publicado actual; solo se busca libre si el contenedor no existe. Así un
#    re-arranque no desplaza 5432 -> 5433 -> 5434 y no recrea contenedores.
APP_PORT="$(stable_or_free_port timelock-app 3000 "${APP_PORT:-3000}")" || fail "No hay puertos libres para la app."
POSTGRES_PORT="$(stable_or_free_port timelock-postgres 5432 "${POSTGRES_PORT:-5432}")" || fail "No hay puertos libres para PostgreSQL."
PGADMIN_PORT="$(stable_or_free_port timelock-pgadmin 80 "${PGADMIN_PORT:-5050}")" || fail "No hay puertos libres para pgAdmin."
export APP_PORT POSTGRES_PORT PGADMIN_PORT
printf '%s\n' "$APP_PORT" > "$RUNTIME_DIR/app.port"
printf '%s\n' "$POSTGRES_PORT" > "$RUNTIME_DIR/postgres.port"
printf '%s\n' "$PGADMIN_PORT" > "$RUNTIME_DIR/pgadmin.port"
log "PUERTO RESERVADO: aplicación en localhost:$APP_PORT."
log "PUERTO RESERVADO: PostgreSQL en localhost:$POSTGRES_PORT."
log "PUERTO RESERVADO: pgAdmin en localhost:$PGADMIN_PORT."
status "✓ Puertos seleccionados: aplicación $APP_PORT, PostgreSQL $POSTGRES_PORT, pgAdmin $PGADMIN_PORT."

# 4) Modo limpio: guardas + confirmación, luego reset real de contenedores/volumen/imagen.
if [[ "$RUN_MODE" == "clean" ]]; then
  if [[ "${NODE_ENV:-development}" == "production" || "${VERCEL:-}" == "1" ]]; then
    fail "El desarrollo limpio está bloqueado en producción (NODE_ENV/VERCEL)."
  fi
  status "⚠️ Esta opción eliminará todos los datos de la base de datos Docker (volumen timelock_postgres), los contenedores y la imagen local de la aplicación, y reconstruirá sin caché."
  status "⚠️ No la uses en producción. Se ejecutará docker compose down --volumes, docker rmi timelock-v-app y docker compose build --no-cache."
  confirm_rc=0
  if tl_confirm '¿Continuar? (s/n): '; then
    confirm_rc=0
  else
    confirm_rc=$?
  fi
  case "$confirm_rc" in
    0)
      log "Confirmación aceptada para el reset limpio."
      ;;
    1)
      status "Desarrollo limpio cancelado; no se modificó nada."
      exit 0
      ;;
    *)
      fail "La opción de reset limpio requiere confirmación interactiva; no se ejecutó nada."
      ;;
  esac
  log "EJECUTANDO: docker compose down --volumes --remove-orphans."
  docker compose down --volumes --remove-orphans || fail "docker compose down falló."
  log "EJECUTANDO: docker rmi timelock-v-app (imagen local de la aplicación)."
  docker rmi timelock-v-app >/dev/null 2>&1 || true
  log "ELIMINADO: contenedores timelock-app/timelock-postgres/timelock-pgadmin, volumen timelock_postgres (datos de la base de datos) e imagen local."
  status "✓ Entorno Docker reiniciado (contenedores, volumen e imagen de la aplicación eliminados)."
  log "EJECUTANDO: docker compose build --no-cache."
  status "Reconstruyendo la imagen sin caché... (puede tardar)"
  docker compose build --no-cache || fail "docker compose build --no-cache falló."
  log "ELIMINADO: caché de construcción de la imagen local (build --no-cache)."
  status "✓ Imagen reconstruida sin caché."
fi

# 5) Aviso de configuración de IA (las claves viajan al contenedor vía env_file).
tl_check_ai_config log status

log "Esquema de base de datos: se aplica automáticamente al iniciar el contenedor (npm run db:migrate)."
touch "$RUNTIME_DIR/docker.started"
log "CREADO/ACTUALIZADO: .timelock-v/docker.started."

# 6) Arranque.
if [[ "$RUN_MODE" == "production" ]]; then
  log "EJECUTANDO: docker compose up -d --build."
  status "Construyendo e iniciando contenedores en segundo plano... (puede tardar)"
  if ! docker compose up -d --build; then
    fail "docker compose up falló. Revisa 'docker compose logs' antes de ejecutar clean-docker."
  fi
  status "Esperando a que la aplicación responda..."
  if ! wait_for_app; then
    fail "La aplicación no respondió a tiempo en http://localhost:$APP_PORT. Revisa: docker compose logs app"
  fi
  log "Para limpiar los recursos registrados use: ./scripts/clean-docker.sh."
  status "✓ Build completado. Servidor de producción iniciado en segundo plano."
  status "✓ Aplicación disponible en http://localhost:$APP_PORT"
  status "✓ PostgreSQL en localhost:$POSTGRES_PORT · pgAdmin en http://localhost:$PGADMIN_PORT (admin@admin.com / admin)"
  status "✓ Registros: docker compose logs -f app"
else
  # Modo desarrollo: SOLO las bases de datos en Docker, en segundo plano
  # (docker compose up -d). La app se compila y corre en el host con `npm run dev`
  # usando el DATABASE_URL de .env (ajustado al PostgreSQL Docker).
  log "EJECUTANDO: docker compose up -d postgres pgadmin."
  status "Iniciando PostgreSQL y pgAdmin en segundo plano..."
  docker compose stop app >/dev/null 2>&1 || true
  log "DETENIDO: contenedor timelock-app (libera el puerto $APP_PORT para next dev en el host)."
  docker compose up -d postgres pgadmin || fail "docker compose up (postgres, pgadmin) falló."
  status "Esperando a que PostgreSQL esté sano (healthcheck)..."
  if ! wait_container_healthy timelock-postgres 40 3 && ! tl_wait_tcp 127.0.0.1 "$POSTGRES_PORT" 10 2; then
    fail "PostgreSQL no quedó sano en localhost:$POSTGRES_PORT. Usa ./scripts/clean-docker.sh antes de reintentar."
  fi
  set_docker_database_url
  if ! db_check="$(npm run db:check 2>&1)"; then
    if [[ "$db_check" == *"ETIMEDOUT"* || "$db_check" == *"connect"* ]]; then
      fail "No se alcanza el PostgreSQL en localhost:$POSTGRES_PORT. Verifica el healthcheck: docker ps. Si sigue tras esperar, usa ./scripts/clean-docker.sh y reintenta."
    else
      fail "Fallo inesperado al comprobar el PostgreSQL Docker en localhost:$POSTGRES_PORT: $(printf '%s' "$db_check" | grep -m1 -i error || true)"
    fi
  fi
  log "BD ÚNICA: PostgreSQL de Docker en localhost:$POSTGRES_PORT (usuario timelock)."
  status "✓ Credenciales verificadas en el PostgreSQL de Docker (localhost:$POSTGRES_PORT)."
  status "✓ PostgreSQL en localhost:$POSTGRES_PORT · pgAdmin en http://localhost:$PGADMIN_PORT (admin@admin.com / admin)"
  status "✓ Contenedores de base de datos activos en segundo plano (docker compose up -d)."
  log "Para detener la base de datos: docker compose stop postgres pgadmin · Para limpiarlo todo: ./scripts/clean-docker.sh"
  status "Aplicación en el host: ejecuta  npm run dev  (compila la app con next dev)."
fi
