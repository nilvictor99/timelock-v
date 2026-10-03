#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
# shellcheck source=lib/common.sh
source "$ROOT_DIR/scripts/lib/common.sh"

# Carga segura de .env (sin $() para que los export persistan en este shell).
env_rc=0
tl_load_env .env .env.example || env_rc=$?
if (( env_rc != 0 )); then
  echo "Error: no se pudo preparar/cargar .env (código $env_rc). Líneas válidas: comentarios, vacías y VARIABLE=valor." >&2
  exit 1
fi
case "$TL_ENV_OUTCOME" in
  created) echo "✓ Se creó .env desde .env.example." ;;
  *)       echo "✓ Configuración local encontrada (.env)." ;;
esac

node_status=0
tl_require_node || node_status=$?
case "$node_status" in
  1) echo "Error: Node.js es necesario (recomendado: Node 20 LTS)." >&2 ; exit 1 ;;
  2) echo "Error: npm es necesario. Instálalo junto con Node.js." >&2 ; exit 1 ;;
  3) echo "Error: la versión de Node.js es demasiado antigua ($(node -v 2>/dev/null || echo '?')). Next.js 14 requiere Node >= 18." >&2 ; exit 1 ;;
esac
echo "✓ Node.js y npm disponibles ($(node -v), npm $(npm -v))."

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

db_host="localhost"
db_port="5432"
if [[ "${DATABASE_URL:-}" =~ @([^:/]+):([0-9]+)/ ]]; then
  db_host="${BASH_REMATCH[1]}"
  db_port="${BASH_REMATCH[2]}"
fi

docker_pg="$(docker_postgres_port)"
system_pg="no"
if system_postgres_on_port "$db_port"; then system_pg="yes"; fi

if ! tl_tcp_available "$db_host" "$db_port"; then
  echo "Error: PostgreSQL no responde en $db_host:$db_port." >&2
  if [[ -n "$docker_pg" ]]; then
    if [[ "$docker_pg" != "$db_port" ]]; then
      echo "El PostgreSQL de Docker publica en localhost:$docker_pg, pero DATABASE_URL usa $db_host:$db_port." >&2
      echo "Ejecuta ./scripts/start-docker.sh (modo dev) para sincronizar .env, o edita DATABASE_URL." >&2
    else
      echo "El contenedor timelock-postgres está activo, pero algo impide la conexión en localhost:$db_port." >&2
      echo "Comprueba el mapeo de puertos: docker ps" >&2
    fi
  else
    echo "Ejecuta ./scripts/start-docker.sh (BD en Docker) o ./scripts/start.sh (BD local) antes de usar npm run dev." >&2
  fi
  exit 1
fi

if ! db_check="$(npm run db:check 2>&1)"; then
  if [[ "$db_check" == *"P1000"* ]]; then
    echo "Error: PostgreSQL responde en $db_host:$db_port, pero rechaza las credenciales de DATABASE_URL." >&2
    if [[ "$system_pg" == "yes" && -n "$docker_pg" && "$docker_pg" == "$db_port" ]]; then
      echo "Detectado: DOS PostgreSQL compiten por el mismo puerto $db_port." >&2
      echo "  - El contenedor timelock-postgres (Docker) publica en localhost:$db_port con credenciales timelock/timelock." >&2
      echo "  - Un cluster PostgreSQL del sistema ocupa 127.0.0.1:$db_port y gana la conexión local." >&2
      echo "Solución: dejar UN solo PostgreSQL. Deten y desactiva el del sistema:" >&2
      echo "  sudo systemctl stop postgresql && sudo systemctl disable postgresql" >&2
    elif [[ -n "$docker_pg" && "$docker_pg" == "$db_port" ]]; then
      echo "El único PostgreSQL aparente es el de Docker, pero rechaza las credenciales." >&2
      echo "El volumen timelock_postgres puede tener credenciales antiguas. Recrea la BD:" >&2
      echo "  ./scripts/clean-docker.sh" >&2
    elif [[ -n "$docker_pg" ]]; then
      echo "El contenedor timelock-postgres publica en localhost:$docker_pg, pero DATABASE_URL usa $db_host:$db_port." >&2
      echo "Ejecuta ./scripts/start-docker.sh (modo dev) para sincronizar .env." >&2
    else
      echo "Corrige el usuario/contraseña/host de DATABASE_URL en .env, o crea el usuario timelock en tu PostgreSQL." >&2
    fi
  else
    echo "$db_check" >&2
  fi
  exit 1
fi

if [[ -n "$docker_pg" && "$docker_pg" == "$db_port" && "$system_pg" == "no" ]]; then
  echo "✓ PostgreSQL único disponible en $db_host:$db_port (contenedor Docker timelock-postgres)."
else
  echo "✓ PostgreSQL disponible en $db_host:$db_port."
fi

exec npx next dev "$@"
