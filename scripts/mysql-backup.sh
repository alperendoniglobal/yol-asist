#!/usr/bin/env bash
# yol-asist MySQL backup
# - Her 2 günde bir (cron) gece 00:00
# - gzip SQL dump
# - 30 günden eski yedekleri siler (1 aydan yeni olanlara dokunmaz)

set -euo pipefail

ENV_FILE="${ENV_FILE:-/var/www/yol-asist/.env}"
BACKUP_DIR="${BACKUP_DIR:-/var/www/yol-asist/backups/mysql}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
LOG_FILE="${BACKUP_DIR}/backup.log"
LOCK_FILE="${BACKUP_DIR}/.backup.lock"
MIN_INTERVAL_HOURS="${MIN_INTERVAL_HOURS:-40}" # 2 günde 1 için güvenlik (çift tetiklemeyi önler)

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

# Basit flock — aynı anda iki backup çalışmasın
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  log "SKIP: başka bir backup çalışıyor"
  exit 0
fi

if [[ ! -f "$ENV_FILE" ]]; then
  log "ERROR: .env bulunamadı: $ENV_FILE"
  exit 1
fi

# .env'den DB_* oku (export etme, sadece lokal)
DB_HOST="$(grep -E '^DB_HOST=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '\r' | sed 's/^["'\'']//;s/["'\'']$//')"
DB_PORT="$(grep -E '^DB_PORT=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '\r' | sed 's/^["'\'']//;s/["'\'']$//')"
DB_USER="$(grep -E '^DB_USER=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '\r' | sed 's/^["'\'']//;s/["'\'']$//')"
DB_PASSWORD="$(grep -E '^DB_PASSWORD=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '\r' | sed 's/^["'\'']//;s/["'\'']$//')"
DB_NAME="$(grep -E '^DB_NAME=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '\r' | sed 's/^["'\'']//;s/["'\'']$//')"

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"

if [[ -z "${DB_USER}" || -z "${DB_NAME}" ]]; then
  log "ERROR: DB_USER / DB_NAME eksik"
  exit 1
fi

# Son başarılı dump 40 saatten yeniyse atla (*/2 cron + manuel çakışma)
latest="$(ls -1t "$BACKUP_DIR"/${DB_NAME}_*.sql.gz 2>/dev/null | head -1 || true)"
if [[ -n "$latest" ]]; then
  latest_mtime="$(stat -c %Y "$latest" 2>/dev/null || echo 0)"
  now="$(date +%s)"
  age_h=$(( (now - latest_mtime) / 3600 ))
  if (( age_h < MIN_INTERVAL_HOURS )); then
    log "SKIP: son yedek ${age_h}s önce (${latest##*/}), min ${MIN_INTERVAL_HOURS}s"
    exit 0
  fi
fi

STAMP="$(date '+%Y%m%d_%H%M%S')"
OUT_FILE="${BACKUP_DIR}/${DB_NAME}_${STAMP}.sql.gz"
TMP_CNF="$(mktemp /tmp/yol-asist-mycnf.XXXXXX)"
chmod 600 "$TMP_CNF"

cleanup() {
  rm -f "$TMP_CNF"
}
trap cleanup EXIT

cat > "$TMP_CNF" <<EOF
[client]
host=${DB_HOST}
port=${DB_PORT}
user=${DB_USER}
password=${DB_PASSWORD}
EOF

log "START: ${DB_NAME} -> ${OUT_FILE##*/}"

if ! mysqldump \
  --defaults-extra-file="$TMP_CNF" \
  --single-transaction \
  --routines \
  --triggers \
  --events \
  --hex-blob \
  --default-character-set=utf8mb4 \
  "$DB_NAME" | gzip -9 > "$OUT_FILE"; then
  log "ERROR: mysqldump başarısız"
  rm -f "$OUT_FILE"
  exit 1
fi

# Boş/çok küçük dosya kontrolü
size="$(stat -c %s "$OUT_FILE" 2>/dev/null || echo 0)"
if (( size < 1024 )); then
  log "ERROR: dump çok küçük (${size} byte), siliniyor"
  rm -f "$OUT_FILE"
  exit 1
fi

chmod 600 "$OUT_FILE"
log "OK: ${OUT_FILE##*/} ($(du -h "$OUT_FILE" | awk '{print $1}'))"

# 30 günden eski yedekleri sil (1 aydan yeni olanlara dokunma)
deleted=0
while IFS= read -r -d '' old; do
  rm -f "$old"
  log "DELETE(> ${RETENTION_DAYS}g): ${old##*/}"
  deleted=$((deleted + 1))
done < <(find "$BACKUP_DIR" -maxdepth 1 -type f -name "${DB_NAME}_*.sql.gz" -mtime +"${RETENTION_DAYS}" -print0 2>/dev/null)

log "DONE: retention temizliği ${deleted} dosya silindi"
exit 0
