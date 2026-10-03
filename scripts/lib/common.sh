#!/usr/bin/env bash
# shellcheck shell=bash
#
# Librería compartida para los scripts de TimeLock-v (start, start-docker, dev, clean).
# Este archivo NUNCA se ejecuta directamente: solo se hace `source` desde otros scripts.
#
# Reglas de la librería:
# - No ejecuta nunca comandos destructivos: solo utilidades de verificación y carga de entorno.

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  echo "Error: scripts/lib/common.sh es una librería; haz 'source' en lugar de ejecutarla." >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Carga segura de archivos .env
# ---------------------------------------------------------------------------
# tl_load_env <archivo_env> [archivo_ejemplo]
#
# - Si <archivo_env> no existe y existe [archivo_ejemplo], lo copia (TL_ENV_OUTCOME="created").
# - Si <archivo_env> no existe y no hay ejemplo (return 3).
# - Analiza el archivo línea a línea SIN usar `source`, por lo que una línea
#   maliciosa o rota (p. ej. "[TEMPLATE]", "FOO=$(rm -rf /)") no se ejecuta.
# - Acepta: comentarios, líneas vacías, VAR=valor, export VAR=valor y valores
#   entre comillas simples o dobles (sin expansiones ni sustituciones).
# - Cualquier otra línea es un ERROR (return 4) con mensaje claro a stderr.
# - La carga es ATÓMICA: si alguna línea es inválida no se exporta NADA.
# - Debe llamarse SIN sustitución de comandos para que los `export` persistan
#   en el shell actual; deja el resultado en la variable global TL_ENV_OUTCOME
#   ("created" o "reused").

# Escanea el archivo: mode="validate" solo comprueba; mode="export" exporta.
_tl_env_scan() {
  local file="$1" mode="$2"
  local line lineno=0 raw key value

  while IFS= read -r line || [[ -n "$line" ]]; do
    lineno=$((lineno + 1))
    line="${line%$'\r'}"                                         # tolera finales CRLF
    line="${line#"${line%%[![:space:]]*}"}"                      # recorta espacios iniciales
    [[ -z "$line" || "$line" == \#* ]] && continue

    raw="$line"
    if [[ "$raw" == export\ * ]]; then
      raw="${raw#export }"
      raw="${raw#"${raw%%[![:space:]]*}"}"
    fi

    if [[ "$raw" != *=* ]]; then
      printf 'tl_load_env: línea %s de %s no es válida (se esperaba VARIABLE=valor): %s\n' \
        "$lineno" "$file" "$line" >&2
      return 4
    fi

    key="${raw%%=*}"
    value="${raw#*=}"
    if [[ ! "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
      printf 'tl_load_env: nombre de variable inválido en la línea %s de %s: %s\n' \
        "$lineno" "$file" "$key" >&2
      return 4
    fi

    # Quita comillas envolventes (sin interpretar escapes ni expansiones).
    if [[ "${#value}" -ge 2 ]]; then
      if [[ "$value" == \"*\" && "$value" == *\" ]]; then
        value="${value:1:${#value}-2}"
      elif [[ "$value" == \'*\' && "$value" == *\' ]]; then
        value="${value:1:${#value}-2}"
      fi
    fi

    if [[ "$mode" == "export" ]]; then
      # Exporta sin reevaluar el valor: nunca se ejecuta contenido del archivo.
      export "$key=$value"
    fi
  done < "$file"
  return 0
}

tl_load_env() {
  local env_file="${1:-.env}"
  local example_file="${2:-.env.example}"

  TL_ENV_OUTCOME="reused"

  if [[ ! -f "$env_file" ]]; then
    if [[ ! -f "$example_file" ]]; then
      printf 'tl_load_env: no existe %s y tampoco %s para generarlo.\n' "$env_file" "$example_file" >&2
      return 3
    fi
    cp "$example_file" "$env_file" || return 3
    TL_ENV_OUTCOME="created"
  fi

  # Pasada 1: validar TODO el archivo antes de exportar nada (carga atómica).
  _tl_env_scan "$env_file" validate || return $?
  # Pasada 2: exportar.
  _tl_env_scan "$env_file" export || return $?
  return 0
}

# ---------------------------------------------------------------------------
# Verificación de Node.js y npm (Next.js 14 requiere Node >= 18)
# ---------------------------------------------------------------------------
# tl_require_node -> 0 ok; 1 falta node; 2 falta npm; 3 versión antigua.
tl_require_node() {
  local major
  command -v node >/dev/null 2>&1 || return 1
  command -v npm >/dev/null 2>&1 || return 2
  major="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || printf '0')"
  [[ "$major" =~ ^[0-9]+$ ]] || major=0
  (( major >= 18 )) || return 3
  return 0
}

tl_node_check_or_fail() { # $1=status_fn  $2=fail_fn
  local status_fn="$1" fail_fn="$2" reason=0
  tl_require_node || reason=$?
  case "$reason" in
    0) ;;
    1) "$fail_fn" "Node.js es necesario. Instálalo (recomendado: Node 20 LTS) y vuelve a intentarlo." ;;
    2) "$fail_fn" "npm es necesario. Instálalo junto con Node.js y vuelve a intentarlo." ;;
    3) "$fail_fn" "La versión de Node.js es demasiado antigua ($(node -v 2>/dev/null || echo 'desconocida')). Next.js 14 requiere Node >= 18." ;;
    *) "$fail_fn" "No se pudo verificar Node.js/npm." ;;
  esac
  "$status_fn" "✓ Node.js y npm disponibles ($(node -v), npm $(npm -v))."
}

# ---------------------------------------------------------------------------
# Puertos y conectividad
# ---------------------------------------------------------------------------
tl_port_available() {
  local port="$1"
  if command -v ss >/dev/null 2>&1; then
    ! ss -H -ltn "( sport = :$port )" 2>/dev/null | grep -q .
  else
    ! timeout 1 bash -c ":</dev/tcp/127.0.0.1/$port" >/dev/null 2>&1
  fi
}

tl_next_free_port() {
  local port="$1"
  while (( port <= 65535 )) && ! tl_port_available "$port"; do
    port=$((port + 1))
  done
  (( port <= 65535 )) || return 1
  printf '%s' "$port"
}

tl_tcp_available() {
  local host="$1" port="$2"
  timeout 1 bash -c ":</dev/tcp/$host/$port" >/dev/null 2>&1
}

# tl_wait_tcp <host> <puerto> <intentos> <pausa_seg>  -> 0 si abre TCP a tiempo.
tl_wait_tcp() {
  local host="$1" port="$2" attempts="$3" pause="$4" i
  for ((i = 1; i <= attempts; i++)); do
    if tl_tcp_available "$host" "$port"; then return 0; fi
    sleep "$pause"
  done
  return 1
}

# ---------------------------------------------------------------------------
# Confirmación interactiva
# ---------------------------------------------------------------------------
# tl_confirm <pregunta> -> 0 = sí (s/sí/y/yes); 1 = no; 2 = no hay terminal.
tl_confirm() {
  local prompt="$1" reply=""
  if [[ -r /dev/tty ]]; then
    printf '%s' "$prompt" > /dev/tty
    IFS= read -r reply < /dev/tty || reply=""
  elif [[ -t 0 ]]; then
    printf '%s' "$prompt"
    IFS= read -r reply || reply=""
  else
    return 2
  fi
  if [[ "$reply" =~ ^[[:space:]]*([YySs]|si|SI|Si|sí|SÍ|yes|YES|Yes)([[:space:]]|$) ]]; then
    return 0
  fi
  return 1
}

# Guarda comunes del modo "limpio": bloquea producción y exige confirmación.
# tl_clean_reset_guard <status_fn> <fail_fn> <mensaje_advertencia...>
tl_clean_reset_guard() {
  local status_fn="$1" fail_fn="$2"
  shift 2
  if [[ "${NODE_ENV:-development}" == "production" || "${VERCEL:-}" == "1" ]]; then
    "$fail_fn" "El desarrollo limpio está bloqueado en producción (NODE_ENV/VERCEL)."
  fi
  local warning
  for warning in "$@"; do
    "$status_fn" "⚠️ $warning"
  done
  case "$(tl_confirm '¿Continuar? (s/n): ')" in
    0) return 0 ;;
    1)
      "$status_fn" "Desarrollo limpio cancelado; no se modificó nada."
      exit 0
      ;;
    *)
      "$fail_fn" "La opción de reset limpio requiere confirmación interactiva; no se ejecutó nada."
      ;;
  esac
}

# ---------------------------------------------------------------------------
# Aviso de configuración de IA (solo advierte, nunca falla el arranque)
# ---------------------------------------------------------------------------
# tl_check_ai_config <log_fn> <warn_status_fn>
tl_check_ai_config() {
  local log_fn="$1" warn_fn="$2"
  local provider key_var key_value
  provider="${AI_PROVIDER:-}"
  [[ -z "$provider" ]] && return 0
  case "$provider" in
    custom) key_var="CUSTOM_AI_API_KEY" ;;
    ollama) return 0 ;; # Ollama normalmente no requiere clave
    *)
      key_var="$(printf '%s' "$provider" | tr '[:lower:]-' '[:upper:]_')_API_KEY"
      ;;
  esac
  key_value="${!key_var:-}"
  if [[ -z "$key_value" ]]; then
    "$log_fn" "AVISO: AI_PROVIDER='$provider' pero $key_var está vacía en .env; las sugerencias de IA quedarán desactivadas."
    "$warn_fn" "⚠️ AI_PROVIDER='$provider' sin $key_var en .env (la app arranca, pero sin sugerencias de IA)."
  fi
  if [[ "$provider" == "custom" && -z "${CUSTOM_AI_BASE_URL:-}" ]]; then
    "$log_fn" "AVISO: AI_PROVIDER='custom' pero CUSTOM_AI_BASE_URL está vacía en .env."
    "$warn_fn" "⚠️ AI_PROVIDER='custom' requiere CUSTOM_AI_BASE_URL en .env."
  fi
  return 0
}
