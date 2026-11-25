#!/usr/bin/env bash
set -euo pipefail
umask 077

: "${GUSTI_PROJECT_DIR:?Define el directorio absoluto del despliegue}"
: "${GUSTI_ENV_FILE:?Define el archivo protegido con la configuración del despliegue}"
: "${RESTIC_REPOSITORY:?Define un repositorio externo}"
: "${RESTIC_PASSWORD_FILE:?Define el archivo con la clave del repositorio}"

case "$RESTIC_REPOSITORY" in
  sftp:*|s3:*|rest:*|b2:*|azure:*|gs:*|rclone:*) ;;
  *) echo "El repositorio debe estar en un destino remoto." >&2; exit 1 ;;
esac

project=$(cd "$GUSTI_PROJECT_DIR" && pwd)
state="${GUSTI_BACKUP_STATE_DIR:-/var/lib/gusti-backup}"
install -d -m 700 "$state"
state=$(cd "$state" && pwd)
exec 9>"$state/backup.lock"
flock -n 9 || { echo "Ya hay un respaldo en ejecución." >&2; exit 1; }

compose=(docker compose --project-directory "$project" --env-file "$GUSTI_ENV_FILE" -f "$project/docker-compose.yml")
if [[ -n "${GUSTI_COMPOSE_PROJECT:-}" ]]; then
  compose+=(-p "$GUSTI_COMPOSE_PROJECT")
fi
stage="$state/stage"
install -d -m 700 "$stage"
restart_app=false
cleanup() {
  local status=$?
  if [[ "$restart_app" == true ]]; then
    "${compose[@]}" start app || status=1
  fi
  rm -f -- "$stage/database.dump" "$stage/media.tar" "$stage/deployment.env" "$stage/docker-compose.yml" "$stage/recovery.md" "$stage/manifest.txt"
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

install -m 600 "$GUSTI_ENV_FILE" "$stage/deployment.env"
install -m 600 "$project/docker-compose.yml" "$stage/docker-compose.yml"
install -m 600 "$project/docs/respaldos.md" "$stage/recovery.md"
revision="${GUSTI_RELEASE:-$(git -C "$project" rev-parse HEAD 2>/dev/null || printf 'sin-revision')}"
printf 'created_at_utc=%s\nrelease=%s\n' "$(date -u +%FT%TZ)" "$revision" > "$stage/manifest.txt"

# Verify access before briefly pausing writes to coordinate PostgreSQL and media.
restic snapshots --latest 1 >/dev/null
running=$("${compose[@]}" ps --status running -q app)
if [[ -n "$running" ]]; then
  restart_app=true
  "${compose[@]}" stop app
fi
"${compose[@]}" exec -T db sh -ec 'pg_dump --format=custom --no-owner --no-acl -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > "$stage/database.dump"
"${compose[@]}" run --no-deps --rm -T --entrypoint tar app -C /app/storage -cf - . > "$stage/media.tar"
if [[ "$restart_app" == true ]]; then
  "${compose[@]}" start app
  restart_app=false
fi

"${compose[@]}" exec -T db pg_restore --list < "$stage/database.dump" >/dev/null
tar -tf "$stage/media.tar" >/dev/null
restic backup --tag gusti --host "${GUSTI_BACKUP_HOST:-$(hostname)}" "$stage"
