#!/usr/bin/env bash
# Tehran Network Edge Panel — Easy Installer (script edition)
# مقصد: کاربر فقط یک توکن Cloudflare بسازد و اینجا Paste کند؛ بقیهٔ کار خودکار است.
# Flow: token -> verify -> account -> KV -> Worker upload -> workers.dev -> health -> panel links
# Token is used only inside this process and is never written to disk.
set -uo pipefail

API_BASE="${TN_CF_API:-https://api.cloudflare.com/client/v4}"
PANEL_BASE="${TN_PANEL_BASE:-}"
REPO_RAW="${TN_REPO_RAW:-https://raw.githubusercontent.com/tehrannetwork021/FreePanel-VPN/main}"
REPO_CDN="${TN_REPO_CDN:-https://cdn.jsdelivr.net/gh/tehrannetwork021/FreePanel-VPN@main}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd || echo .)"

WORKER_NAME=""
ACCOUNT_ID=""
ADMIN_PASSWORD=""
TOKEN="${CF_API_TOKEN:-${TN_CF_TOKEN:-}}"
ASSUME_YES=0
ARTIFACT=""
NO_JQ="${TN_NO_JQ:-0}"

have_jq() { [ "$NO_JQ" = "1" ] && return 1 || command -v jq >/dev/null 2>&1; }

TMP_DIR=""
META_FILE=""
trap '[ -n "$TMP_DIR" ] && rm -rf "$TMP_DIR"; [ -n "$META_FILE" ] && rm -f "$META_FILE"' EXIT

c_reset() { [ -t 1 ] && printf '\033[0m' || true; }
say() { printf '%s\n' "$*"; }
step() { say ""; say "==> $*"; }
die() { printf '\033[31m[✗] %s\033[0m\n' "$*" >&2; exit 1; }

usage() {
  cat <<'USAGE'
Tehran Network Edge Panel — Easy Installer

Usage:
  bash install.sh [options]

Options:
  --token TOKEN        Cloudflare API token (or paste it when prompted)
  --account ID         Cloudflare account id (skip the account picker)
  --name NAME          Worker name (default: tehran-network-edge)
  --password PW        Panel admin password (default: a random one is generated)
  --artifact PATH      Path to the worker bundle (default: download the signed release)
  --yes                Non-interactive; fail instead of prompting
  -h, --help           Show this help

Required token scopes: Workers Scripts Edit + Workers KV Storage Edit + Account Settings Read
TOKEN="" ... TOKEN is only kept in memory and never saved to disk.
USAGE
}

while [ $# -gt 0 ]; do
  case "$1" in
    --token) TOKEN="${2:-}"; shift 2 ;;
    --account) ACCOUNT_ID="${2:-}"; shift 2 ;;
    --name) WORKER_NAME="${2:-}"; shift 2 ;;
    --password) ADMIN_PASSWORD="${2:-}"; shift 2 ;;
    --artifact) ARTIFACT="${2:-}"; shift 2 ;;
    --yes) ASSUME_YES=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) die "unknown option: $1 (see --help)" ;;
  esac
done

command -v curl >/dev/null 2>&1 || die "curl not found. Install curl and retry."
[ -t 0 ] && INTERACTIVE=1 || INTERACTIVE=0

# ---------- tiny helpers ----------
rand_hex() {
  local bytes="$1"
  if command -v openssl >/dev/null 2>&1; then openssl rand -hex "$bytes" 2>/dev/null && return 0; fi
  if [ -r /dev/urandom ]; then od -An -tx1 -N"$bytes" /dev/urandom | tr -d ' \n' && return 0; fi
  # last resort (weaker): shell PRNG
  local out="" i
  for i in $(seq 1 $((bytes * 2))); do out="$out$(printf '%x' $((RANDOM % 16)))"; done
  printf '%s' "$out"
}

json_get() { # json_get BODY JQ_PATH -> raw value or empty  (jq preferred, sed fallback uses last path segment)
  local body="$1"
  local key="$2"
  local field="${key##*.}"
  if have_jq; then printf '%s' "$body" | jq -r "$key // empty" 2>/dev/null && return 0; fi
  printf '%s' "$body" | sed -n "s/.*\"${field}\":\"\([^\"]*\)\".*/\1/p" | head -1
}

http() { # http METHOD PATH [BODY] [CONTENT_TYPE] -> sets REPLY_BODY / REPLY_CODE
  local method="$1" path="$2" body="${3:-}" ctype="${4:-}"
  local args=(-sS --max-time 60 -X "$method" -H "Authorization: Bearer $TOKEN")
  [ -n "$ctype" ] && args+=(-H "Content-Type: $ctype")
  [ -n "$body" ] && args+=(-d "$body")
  local out
  out=$(curl "${args[@]}" -w $'\n%{http_code}' "$API_BASE$path" 2>&1) || die "network error while calling Cloudflare API ($method $path). Check your connection and retry."
  REPLY_CODE="${out##*$'\n'}"
  REPLY_BODY="${out%$'\n'*}"
}

cf_fail() { # cf_fail STAGE CODE HTTP BODY
  local stage="$1" code="$2" http_code="$3" body="$4"
  local msg
  msg=$(json_get "$body" '.errors[0].message')
  case "$http_code" in
    401) die "[$stage] token-invalid — the token is wrong or expired. Create a fresh one." ;;
    403) die "[$stage] insufficient-scope — the token is missing a permission. Required: Workers Scripts Edit, Workers KV Storage Edit, Account Settings Read." ;;
  esac
  die "[$stage] $code failed (HTTP $http_code). ${msg:+Cloudflare says: $msg}"
}

# ---------- 1) token ----------
if [ -z "$TOKEN" ]; then
  if [ "$ASSUME_YES" = "1" ] || [ "$INTERACTIVE" != "1" ]; then
    die "no token provided. Use --token or set CF_API_TOKEN."
  fi
  say "╔══════════════════════════════════════════════════════════════╗"
  say "║   Tehran Network Edge Panel — Easy Installer                 ║"
  say "║   1) لینک ساخت توکن باز می‌شود — Create Token را بزن           ║"
  say "║   2) توکن را کپی و همین‌جا Paste کن                           ║"
  say "╚══════════════════════════════════════════════════════════════╝"
  say ""
  say "لینک ساخت توکن (پیش‌تنظیم با دسترسی‌های لازم):"
  say "https://dash.cloudflare.com/profile/api-tokens?permissionGroupKeys=%5B%7B%22key%22%3A%22workers_scripts%22%2C%22type%22%3A%22edit%22%7D%2C%7B%22key%22%3A%22workers_kv_storage%22%2C%22type%22%3A%22edit%22%7D%2C%7B%22key%22%3A%22account_settings%22%2C%22type%22%3A%22read%22%7D%5D&accountId=%2A"
  say ""
  printf 'توکن Cloudflare را Paste کن و Enter بزن: '
  read -rs TOKEN
  say ""
  TOKEN=$(printf '%s' "$TOKEN" | tr -d '\r\n \t')
  [ -n "$TOKEN" ] || die "token is empty."
fi

step "1/7 بررسی توکن"
http GET "/user/tokens/verify"
[ "$REPLY_CODE" = "200" ] || cf_fail token verify "$REPLY_CODE" "$REPLY_BODY"
STATUS=$(json_get "$REPLY_BODY" '.result.status')
[ "$STATUS" = "active" ] || die "[token] توکن فعال نیست (status=$STATUS)."
say "OK — توکن فعال است."

step "2/7 شناسایی حساب"
http GET "/accounts?per_page=50"
[ "$REPLY_CODE" = "200" ] || cf_fail account list "$REPLY_CODE" "$REPLY_BODY"
ACCOUNTS_JSON="$REPLY_BODY"
ACCOUNT_COUNT=0
if have_jq; then
  ACCOUNT_COUNT=$(printf '%s' "$ACCOUNTS_JSON" | jq '.result | length' 2>/dev/null || echo 0)
else
  ACCOUNT_COUNT=$(printf '%s' "$ACCOUNTS_JSON" | grep -oE '"id":"[0-9a-f]{32}"' | wc -l | tr -d ' ')
fi
[ "${ACCOUNT_COUNT:-0}" -ge 1 ] 2>/dev/null || die "[account] هیچ حسابی برای این توکن پیدا نشد."

if [ -n "$ACCOUNT_ID" ]; then
  printf '%s' "$ACCOUNTS_JSON" | grep -q "\"id\": *\"$ACCOUNT_ID\"" || die "[account] حساب $ACCOUNT_ID برای این توکن قابل دسترس نیست."
elif [ "${ACCOUNT_COUNT:-0}" = "1" ]; then
  ACCOUNT_ID=$(json_get "$ACCOUNTS_JSON" '.result[0].id')
else
  say "چند حساب پیدا شد؛ یکی را انتخاب کن:"
  if have_jq; then
    printf '%s' "$ACCOUNTS_JSON" | jq -r '.result | to_entries[] | "  \(.key+1)) \(.value.name)  [\(.value.id)]"'
  else
    printf '%s' "$ACCOUNTS_JSON" | tr '{' '\n' | sed -n 's/^.*"id":"\([0-9a-f]\{32\}\)","name":"\([^"]*\)".*/  [\1] \2/p'
  fi
  [ "$ASSUME_YES" = "1" ] && die "[account] چند حساب هست؛ با --account انتخاب کن."
  printf 'شماره حساب: '
  read -r CHOICE
  ACCOUNT_ID=$(have_jq && printf '%s' "$ACCOUNTS_JSON" | jq -r ".result[$((CHOICE-1))].id" 2>/dev/null)
  [ -n "$ACCOUNT_ID" ] || ACCOUNT_ID=$(printf '%s' "$ACCOUNTS_JSON" | tr '{' '\n' | sed -n "${CHOICE}p" | grep -oE '"id":"[0-9a-f]{32}"' | head -1 | cut -d'"' -f4)
  [ -n "$ACCOUNT_ID" ] || die "[account] انتخاب نامعتبر."
fi
say "OK — account: $ACCOUNT_ID"

step "3/7 نام Worker و رمز مدیریت"
if [ -z "$WORKER_NAME" ]; then
  if [ "$ASSUME_YES" = "1" ] || [ "$INTERACTIVE" != "1" ]; then
    WORKER_NAME="tehran-network-edge"
  else
    printf "نام Worker [tehran-network-edge]: "
    read -r WORKER_NAME
    WORKER_NAME="${WORKER_NAME:-tehran-network-edge}"
  fi
fi
printf '%s' "$WORKER_NAME" | grep -qE '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$' || die "[worker] نام نامعتبر: فقط حروف کوچک انگلیسی، رقم و خط تیره."
if [ -z "$ADMIN_PASSWORD" ]; then
  if [ "$ASSUME_YES" = "1" ] || [ "$INTERACTIVE" != "1" ]; then
    ADMIN_PASSWORD=$(rand_hex 16)
  else
    printf "رمز مدیریت پنل [Enter = ساخت رمز تصادفی]: "
    read -r ADMIN_PASSWORD
    ADMIN_PASSWORD="${ADMIN_PASSWORD:-$(rand_hex 16)}"
  fi
fi
[ -n "$ADMIN_PASSWORD" ] || die "[secret] رمز خالی است."
say "OK — worker: $WORKER_NAME"

step "4/7 ساخت/پیدا کردن فضای KV"
KV_TITLE="$WORKER_NAME-config"
http GET "/accounts/$ACCOUNT_ID/storage/kv/namespaces?per_page=100"
[ "$REPLY_CODE" = "200" ] || cf_fail kv list "$REPLY_CODE" "$REPLY_BODY"
KV_ID=""
if have_jq; then
  KV_ID=$(printf '%s' "$REPLY_BODY" | jq -r ".result[]? | select(.title==\"$KV_TITLE\") | .id" | head -1)
else
  KV_ID=$(printf '%s' "$REPLY_BODY" | tr '{' '\n' | sed -n "s/^.*\"id\": *\"\([0-9a-f]\{32\}\)\",\"title\": *\"$KV_TITLE\".*/\1/p" | head -1)
fi
if [ -n "$KV_ID" ]; then
  say "OK — KV موجود استفاده شد."
else
  http POST "/accounts/$ACCOUNT_ID/storage/kv/namespaces" "{\"title\":\"$KV_TITLE\"}" "application/json"
  [ "$REPLY_CODE" = "200" ] || cf_fail kv create "$REPLY_CODE" "$REPLY_BODY"
  KV_ID=$(json_get "$REPLY_BODY" '.result.id')
  say "OK — KV ساخته شد."
fi
[ -n "$KV_ID" ] || die "[kv] شناسهٔ KV خوانده نشد."

step "5/7 آماده‌سازی باندل Worker"
WORKER_FILE=""
if [ -n "${ARTIFACT:-}" ]; then
  [ -f "$ARTIFACT" ] || die "[artifact] فایل پیدا نشد: $ARTIFACT"
  WORKER_FILE="$ARTIFACT"
elif [ -f "$SCRIPT_DIR/dist/edge-worker.js" ]; then
  WORKER_FILE="$SCRIPT_DIR/dist/edge-worker.js"
  say "OK — از مخزن محلی: $WORKER_FILE"
else
  TMP_DIR=$(mktemp -d)
  say "... دانلود باندل امضاشده از GitHub"
  curl -fsSL --max-time 60 "$REPO_RAW/dist/edge-worker.js" -o "$TMP_DIR/edge-worker.js" \
    || curl -fsSL --max-time 60 "$REPO_CDN/dist/edge-worker.js" -o "$TMP_DIR/edge-worker.js" \
    || die "[artifact] دانلود باندل ناموفق بود. اتصال شبکه را بررسی کن یا مخزن را clone کن."
  curl -fsSL --max-time 60 "$REPO_RAW/dist/installer-artifacts/edge-worker-manifest.json" -o "$TMP_DIR/manifest.json" \
    || curl -fsSL --max-time 60 "$REPO_CDN/dist/installer-artifacts/edge-worker-manifest.json" -o "$TMP_DIR/manifest.json" \
    || true
  if [ -s "$TMP_DIR/manifest.json" ]; then
    EXPECTED=$(json_get "$(cat "$TMP_DIR/manifest.json")" 'sha256')
    ACTUAL=$(sha256sum "$TMP_DIR/edge-worker.js" 2>/dev/null | cut -d' ' -f1 || shasum -a 256 "$TMP_DIR/edge-worker.js" | cut -d' ' -f1)
    [ "$ACTUAL" = "$EXPECTED" ] || die "[artifact] SHA-256 مطابقت ندارد ($ACTUAL != $EXPECTED). دانلود ناقص یا دستکاری‌شده."
    say "OK — SHA-256 تأیید شد."
  fi
  WORKER_FILE="$TMP_DIR/edge-worker.js"
fi

step "6/7 آپلود Worker (KV + رمز مدیریت)"
PASS_ESC=$(printf '%s' "$ADMIN_PASSWORD" | sed 's/\\/\\\\/g; s/"/\\"/g')
if have_jq; then
  METADATA=$(jq -cn --arg ns "$KV_ID" --arg pw "$ADMIN_PASSWORD" \
    '{main_module:"worker.mjs",compatibility_date:"2026-09-19",bindings:[{type:"kv_namespace",name:"C",namespace_id:$ns},{type:"secret_text",name:"ADMIN_PASSWORD",text:$pw}]}')
else
  METADATA="{\"main_module\":\"worker.mjs\",\"compatibility_date\":\"2026-09-19\",\"bindings\":[{\"type\":\"kv_namespace\",\"name\":\"C\",\"namespace_id\":\"$KV_ID\"},{\"type\":\"secret_text\",\"name\":\"ADMIN_PASSWORD\",\"text\":\"$PASS_ESC\"}]}"
fi
META_FILE=$(mktemp)
printf '%s' "$METADATA" > "$META_FILE"
UPLOAD_OUT=$(curl -sS --max-time 120 -X PUT \
  -H "Authorization: Bearer $TOKEN" \
  -F "metadata=<${META_FILE};type=application/json" \
  -F "worker.mjs=@$WORKER_FILE;type=application/javascript+module" \
  -w $'\n%{http_code}' "$API_BASE/accounts/$ACCOUNT_ID/workers/scripts/$WORKER_NAME" 2>&1) \
  || die "[worker] خطای شبکه هنگام آپلود."
UPLOAD_CODE="${UPLOAD_OUT##*$'\n'}"
UPLOAD_BODY="${UPLOAD_OUT%$'\n'*}"
[ "$UPLOAD_CODE" = "200" ] || cf_fail worker upload "$UPLOAD_CODE" "$UPLOAD_BODY"
say "OK — Worker آپلود شد."

step "7/7 فعال‌سازی workers.dev"
SUBDOMAIN=""
http GET "/accounts/$ACCOUNT_ID/workers/subdomain"
if [ "$REPLY_CODE" = "200" ]; then
  SUBDOMAIN=$(json_get "$REPLY_BODY" '.result.subdomain')
fi
if [ -z "${SUBDOMAIN:-}" ]; then
  CANDIDATE="tn-$(printf '%s' "$WORKER_NAME" | cut -c1-20)-$(rand_hex 3)"
  http PUT "/accounts/$ACCOUNT_ID/workers/subdomain" "{\"subdomain\":\"$CANDIDATE\"}" "application/json"
  [ "$REPLY_CODE" = "200" ] || cf_fail subdomain create "$REPLY_CODE" "$REPLY_BODY"
  SUBDOMAIN=$(json_get "$REPLY_BODY" '.result.subdomain')
  SUBDOMAIN="${SUBDOMAIN:-$CANDIDATE}"
fi
http POST "/accounts/$ACCOUNT_ID/workers/scripts/$WORKER_NAME/subdomain" '{"enabled":true,"previews_enabled":false}' "application/json"
[ "$REPLY_CODE" = "200" ] || cf_fail subdomain enable "$REPLY_CODE" "$REPLY_BODY"
say "OK — workers.dev فعال شد."

PANEL_URL="${PANEL_BASE:-https://$WORKER_NAME.$SUBDOMAIN.workers.dev}"

step "بررسی سلامت پنل"
HEALTH_OK=0
for i in 1 2 3 4 5 6 7 8 9 10; do
  HEALTH=$(curl -sS --max-time 15 "$PANEL_URL/health" 2>/dev/null) && \
    printf '%s' "$HEALTH" | grep -q '"ok" *: *true' && { HEALTH_OK=1; break; }
  sleep 3
done
if [ "$HEALTH_OK" = "1" ]; then say "OK — پنل پاسخ می‌دهد."; else say "! بررسی سلامت ناموفق بود (شاید workers.dev روی شبکهٔ تو محدود است)؛ ادامه می‌دهیم..."; fi

step "ساخت کانفیگ‌ها"
LINKS=$(curl -sS --max-time 30 -X POST -H "Authorization: Bearer $ADMIN_PASSWORD" "$PANEL_URL/api/setup" 2>/dev/null || true)
VLESS_WS=$(json_get "$LINKS" 'links.vlessWs')
TROJAN_WS=$(json_get "$LINKS" 'links.trojanWs')
VLESS_XHTTP=$(json_get "$LINKS" 'links.vlessXhttp')
SUB_URL=$(json_get "$LINKS" 'subscriptionUrl')

say ""
say "════════════════════════════════════════════════════════"
say "  ✅ نصب کامل شد — Tehran Network Edge Panel"
say "════════════════════════════════════════════════════════"
say "  آدرس پنل:            $PANEL_URL"
say "  رمز مدیریت (ADMIN_PASSWORD):"
say "    $ADMIN_PASSWORD"
say "  ⚠️  این رمز را جایی امن ذخیره کن؛ فقط همین‌جا نمایش داده می‌شود."
if [ -n "$VLESS_WS" ]; then
  say ""
  say "  VLESS-WS:   $VLESS_WS"
  say "  Trojan-WS:  $TROJAN_WS"
  say "  XHTTP:      $VLESS_XHTTP"
  say "  Subscription: $SUB_URL"
  say ""
  say "  لینک‌ها را در کلاینت (v2rayNG / Hiddify / Streisand) وارد کن"
  say "  یا آدرس Subscription را به‌عنوان پروفایل اضافه کن."
fi
say ""
say "  امنیت: توکن Cloudflare فقط در همین اجرا استفاده شد و ذخیره نشد."
say "  برای حذف توکن: https://dash.cloudflare.com/profile/api-tokens"
say "════════════════════════════════════════════════════════"
