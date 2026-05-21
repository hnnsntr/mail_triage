#!/bin/zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

SETUP_ONLY="false"
if [[ "${1:-}" == "--setup-only" ]]; then
  SETUP_ONLY="true"
fi

ENV_FILE="$ROOT_DIR/.env"
DEFAULT_CONTAINER="ai-mailing-postgres"
DEFAULT_DB_PORT="${AI_MAILING_DB_PORT:-55432}"
DEFAULT_DB_URL="postgresql://postgres:password@localhost:${DEFAULT_DB_PORT}/ai_mailing?schema=public"
OLD_MANAGED_DB_URL='postgresql://postgres:password@localhost:5432/ai_mailing?schema=public'
PLACEHOLDER_DB_URL='postgresql://user:password@localhost:5432/ai_mailing?schema=public'

info() {
  printf "\033[1;34m%s\033[0m\n" "$1"
}

warn() {
  printf "\033[1;33m%s\033[0m\n" "$1"
}

fail() {
  printf "\033[1;31m%s\033[0m\n" "$1" >&2
  exit 1
}

ask() {
  local prompt="$1"
  local default_value="${2:-}"
  local answer

  if [[ -n "$default_value" ]]; then
    printf "%s [%s]: " "$prompt" "$default_value" >&2
  else
    printf "%s: " "$prompt" >&2
  fi

  read -r answer
  if [[ -z "$answer" ]]; then
    answer="$default_value"
  fi
  printf "%s" "$answer"
}

ensure_env_file() {
  if [[ ! -f "$ENV_FILE" ]]; then
    cp .env.example "$ENV_FILE"
  fi
}

env_value() {
  local key="$1"
  if [[ ! -f "$ENV_FILE" ]]; then
    return 0
  fi

  local line
  line="$(grep -E "^${key}=" "$ENV_FILE" | tail -n 1 || true)"
  line="${line#*=}"
  line="${line%\"}"
  line="${line#\"}"
  printf "%s" "$line"
}

set_env_value() {
  local key="$1"
  local value="$2"
  local escaped
  escaped="$(printf "%s" "$value" | sed 's/[\/&]/\\&/g')"

  if grep -qE "^${key}=" "$ENV_FILE"; then
    sed -i.bak "s/^${key}=.*/${key}=\"${escaped}\"/" "$ENV_FILE"
    rm -f "$ENV_FILE.bak"
  else
    printf '%s="%s"\n' "$key" "$value" >> "$ENV_FILE"
  fi
}

load_zshrc() {
  if [[ -f "$HOME/.zshrc" ]]; then
    set +u
    source "$HOME/.zshrc" >/dev/null 2>&1 || true
    set -u
  fi
}

ensure_openai_key() {
  local env_key="${OPENAI_API_KEY:-}"
  local file_key
  file_key="$(env_value OPENAI_API_KEY)"

  if [[ -n "$env_key" ]]; then
    info "Using OPENAI_API_KEY from your shell environment."
    return
  fi

  if [[ -n "$file_key" ]]; then
    export OPENAI_API_KEY="$file_key"
    info "Using OPENAI_API_KEY from .env."
    return
  fi

  warn "OPENAI_API_KEY was not found in the shell or .env."
  local pasted
  pasted="$(ask "Paste OPENAI_API_KEY now, or press Enter to start without AI" "")"
  if [[ -n "$pasted" ]]; then
    export OPENAI_API_KEY="$pasted"
    set_env_value OPENAI_API_KEY "$pasted"
  else
    warn "Starting without AI. The app will use fallback analysis until OPENAI_API_KEY is set."
  fi
}

ensure_encryption_key() {
  local existing
  existing="$(env_value ENCRYPTION_KEY)"
  if [[ -n "$existing" && "$existing" != "base64-or-hex-32-byte-key" ]]; then
    return
  fi

  local generated
  generated="$(openssl rand -base64 32)"
  set_env_value ENCRYPTION_KEY "$generated"
  info "Generated ENCRYPTION_KEY in .env."
}

docker_cli_available() {
  command -v docker >/dev/null 2>&1
}

docker_daemon_ready() {
  docker info >/dev/null 2>&1
}

start_docker_desktop() {
  if docker_daemon_ready; then
    return
  fi

  if [[ "$(uname -s)" == "Darwin" ]]; then
    if [[ -d "/Applications/Docker.app" || -d "$HOME/Applications/Docker.app" ]]; then
      info "Starting Docker Desktop."
      open -gja Docker >/dev/null 2>&1 || open -a Docker >/dev/null 2>&1 || true
    fi
  fi

  info "Waiting for Docker to become ready."
  for _ in {1..90}; do
    if docker_daemon_ready; then
      return
    fi
    sleep 2
  done

  fail "Docker is installed but the Docker daemon did not start. Open Docker Desktop once, then rerun npm run bootstrap."
}

container_exists() {
  docker ps -a --format '{{.Names}}' | grep -qx "$DEFAULT_CONTAINER"
}

ensure_database_url() {
  local existing
  existing="$(env_value DATABASE_URL)"

  if [[ -n "$existing" && "$existing" != "$PLACEHOLDER_DB_URL" && "$existing" != "$OLD_MANAGED_DB_URL" && "$existing" != "$DEFAULT_DB_URL" ]]; then
    info "Using existing DATABASE_URL from .env."
    return
  fi

  if ! docker_cli_available; then
    fail "Docker CLI was not found. Install Docker Desktop, then rerun npm run bootstrap."
  fi

  start_docker_desktop
  local db_port="$DEFAULT_DB_PORT"

  if container_exists; then
    if ! docker ps --format '{{.Names}}' | grep -qx "$DEFAULT_CONTAINER"; then
      info "Starting existing Postgres container."
      docker start "$DEFAULT_CONTAINER" >/dev/null
    fi
    local mapped_port
    mapped_port="$(docker port "$DEFAULT_CONTAINER" 5432/tcp 2>/dev/null | head -n 1 | awk -F: '{print $NF}' || true)"
    if [[ -n "$mapped_port" ]]; then
      db_port="$mapped_port"
    fi
  else
    info "Creating local Postgres container."
    docker run \
      --name "$DEFAULT_CONTAINER" \
      -e POSTGRES_PASSWORD=password \
      -e POSTGRES_DB=ai_mailing \
      -p "${db_port}:5432" \
      -d postgres:16 >/dev/null
  fi

  set_env_value DATABASE_URL "postgresql://postgres:password@localhost:${db_port}/ai_mailing?schema=public"
  info "Using Docker Postgres at localhost:${db_port}."
}

wait_for_database() {
  local database_url
  database_url="$(env_value DATABASE_URL)"

  info "Checking database connection."
  for _ in {1..30}; do
    if DATABASE_URL="$database_url" npx prisma db execute --stdin >/dev/null 2>&1 <<< "SELECT 1;"; then
      return
    fi
    sleep 1
  done

  fail "Database did not become ready. Check DATABASE_URL in .env and start Postgres."
}

ensure_dependencies() {
  if [[ ! -d node_modules ]]; then
    info "Installing dependencies."
    npm install
  fi
}

run_migrations() {
  info "Applying database migrations."
  npx prisma migrate dev --name init
}

start_app() {
  info "Starting AI Mailing at http://localhost:3000"
  npm run dev
}

main() {
  load_zshrc
  ensure_env_file
  ensure_openai_key
  ensure_encryption_key
  ensure_database_url
  ensure_dependencies
  wait_for_database
  run_migrations

  if [[ "$SETUP_ONLY" == "true" ]]; then
    info "Setup complete."
    return
  fi

  start_app
}

main "$@"
