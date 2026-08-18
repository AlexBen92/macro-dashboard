#!/bin/bash
# Smoke test post-déploiement — vérifie prod RÉEL, pas local.
# Usage: ./scripts/smoke_prod.sh [base-url]
# Exit 1 si tout échec critique. À lancer après CHAQUE `vercel --prod`
# (auto-deploy GitHub HS → seul garde-fou contre déploiement cassé).

BASE="${1:-https://macro-dashboard-lemon.vercel.app}"
FAIL=0

check() {
  local name="$1" ok="$2"
  if [ "$ok" = "1" ]; then
    echo "PASS  $name"
  else
    echo "FAIL  $name"
    FAIL=1
  fi
}

# --- API critiques: JSON valide + assertions métier ---
state=$(curl -sf -m 20 "$BASE/api/agent/state") || state=""
if [ -n "$state" ]; then
  check "agent/state: HTTP 200 + JSON" 1
  check "agent/state: stale=false" "$(python3 -c "import json;print(int(json.loads('''$state''')['stale']==False))" 2>/dev/null || echo 0)"
  check "agent/state: data_complete=true" "$(python3 -c "import json;print(int(json.loads('''$state''')['data_complete']==True))" 2>/dev/null || echo 0)"
  check "agent/state: regime non-null" "$(python3 -c "import json;print(int(json.loads('''$state''')['regime']['wf_regime'] is not None))" 2>/dev/null || echo 0)"
  check "agent/state: funding non-null" "$(python3 -c "import json;print(int(json.loads('''$state''')['funding'] is not None))" 2>/dev/null || echo 0)"
else
  check "agent/state: HTTP 200 + JSON" 0
fi

for route in regime-matrix markets/sectors edge-m15-status regime-status orderflow-status funding-carry; do
  code=$(curl -s -m 20 -o /dev/null -w "%{http_code}" "$BASE/api/$route")
  check "/api/$route → 200" "$([ "$code" = "200" ] && echo 1 || echo 0)"
  # freshness: as_of < 26h
  if [ "$code" = "200" ]; then
    fresh=$(curl -sf -m 20 "$BASE/api/$route" | python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
    asof=d.get('as_of') or d.get('asOf') or d.get('last_export_success')
    if not asof: print(0)
    else:
        import datetime
        age=datetime.datetime.now(datetime.timezone.utc)-datetime.datetime.fromisoformat(asof.replace('Z','+00:00'))
        print(int(age.total_seconds()<26*3600))
except Exception: print(0)" 2>/dev/null || echo 0)
    check "/api/$route: data < 26h" "$fresh"
  fi
done

# --- Pages: 200 + contenu non-vide ---
for page in "" crypto markets research; do
  code=$(curl -s -m 20 -o /tmp/smoke_page.html -w "%{http_code}" "$BASE/$page")
  size=$(wc -c < /tmp/smoke_page.html)
  check "page /$page → 200 (>5KB)" "$([ "$code" = "200" ] && [ "$size" -gt 5000 ] && echo 1 || echo 0)"
done

# /scalping fusionné → doit rediriger (30x ou meta-refresh), pas servir l'ancien dashboard
scalping_body=$(curl -s -m 20 "$BASE/scalping")
check "page /scalping → redirection vers /" "$(echo "$scalping_body" | grep -q 'url=/\|http-equiv="refresh"' && echo 1 || echo 0)"

# --- 404 assumés: pas de lien mort dans nav ---
nav=$(curl -s -m 20 "$BASE/crypto" | grep -o 'href="/[a-z]*"' | sed 's/href="//;s/"//' | sort -u)
for href in $nav; do
  code=$(curl -s -m 20 -o /dev/null -w "%{http_code}" "$BASE$href")
  check "nav $href → $code" "$([ "$code" = "200" ] && echo 1 || echo 0)"
done

echo "---"
if [ "$FAIL" = "0" ]; then
  echo "SMOKE OK — $BASE"
else
  echo "SMOKE FAILED — $BASE — NE PAS considérer le fix comme livré"
fi
exit $FAIL
