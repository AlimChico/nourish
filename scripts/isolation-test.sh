#!/usr/bin/env bash
# Test d'isolation entre comptes : le compte B (jetable) tente d'atteindre les
# données du compte A (amine@test.tn, qui a 5 jours loggés) via l'API.
set -u
API="http://localhost:3210"
JAR_B=$(mktemp)
JAR_A=$(mktemp)
EMAIL="idtest-$(date +%s)@sahtek.test"
OTHER_DATE="2026-09-27"
OTHER_RECIPE="rcp_seed_1_5732cb75"
pass=0; fail=0
chk() { # chk "libellé" "attendu" "obtenu"
  if [ "$2" = "$3" ]; then echo "  ✅ $1 → $3"; pass=$((pass+1));
  else echo "  ❌ $1 → attendu $2, obtenu $3"; fail=$((fail+1)); fi
}
code() { # code METHOD URL JAR [BODY]
  if [ -n "${5:-}" ]; then
    curl -s -o /tmp/body.txt -w "%{http_code}" -X "$1" "$API$2" -b "$3" -H 'content-type: application/json' -d "$5"
  else
    curl -s -o /tmp/body.txt -w "%{http_code}" -X "$1" "$API$2" -b "$3" -H 'content-type: application/json'
  fi
}

echo "── 1. Création du compte jetable B ──"
curl -s -c "$JAR_B" -o /tmp/signup.json -w "signup=%{http_code}\n" -X POST "$API/api/auth/signup" \
  -H 'content-type: application/json' -d "{\"name\":\"Isolation Test\",\"email\":\"$EMAIL\",\"password\":\"Test1234!\"}"
echo "  cookie B : $(grep -c sahtek_session "$JAR_B" 2>/dev/null || echo 0) cookie(s)"

echo "── 2. B tente de lire les données de A ──"
c=$(code GET "/api/sync/day?date=$OTHER_DATE" "$JAR_B"); chk "GET /api/sync/day (jour de A)" "200" "$c"
echo "     corps : $(head -c 120 /tmp/body.txt)"
if grep -q '"day":null' /tmp/body.txt; then echo "  ✅ aucun jour de A renvoyé"; pass=$((pass+1)); else echo "  ❌ fuite possible : $(head -c 200 /tmp/body.txt)"; fail=$((fail+1)); fi
c=$(code GET "/api/sync/days" "$JAR_B"); chk "GET /api/sync/days" "200" "$c"
echo "     corps : $(head -c 120 /tmp/body.txt)"
if grep -q '"days":\[\]' /tmp/body.txt; then echo "  ✅ aucun jour de A listé"; pass=$((pass+1)); else echo "  ❌ fuite possible"; fail=$((fail+1)); fi
c=$(code GET "/api/sync/account" "$JAR_B"); chk "GET /api/sync/account" "200" "$c"
if grep -q '"account":null' /tmp/body.txt; then echo "  ✅ compte de A non lisible"; pass=$((pass+1)); else echo "  ⚠️  corps: $(head -c 160 /tmp/body.txt)"; fail=$((fail+1)); fi
c=$(code GET "/api/sync/scans" "$JAR_B"); chk "GET /api/sync/scans" "200" "$c"
if grep -q '"scans":\[\]' /tmp/body.txt; then echo "  ✅ aucun scan de A"; pass=$((pass+1)); else echo "  ❌ fuite possible"; fail=$((fail+1)); fi
c=$(code GET "/api/sync/health" "$JAR_B"); chk "GET /api/sync/health" "200" "$c"
if grep -q '"health":null' /tmp/body.txt; then echo "  ✅ santé de A non lisible"; pass=$((pass+1)); else echo "  ❌ fuite"; fail=$((fail+1)); fi

echo "── 3. B tente de supprimer une recette de A ──"
c=$(code DELETE "/api/community" "$JAR_B" "" "{\"kind\":\"deleteRecipe\",\"id\":\"$OTHER_RECIPE\"}")
chk "DELETE recette d'autrui (doit échouer)" "403" "$c"
echo "     corps : $(head -c 140 /tmp/body.txt)"

echo "── 4. B tente les endpoints admin / premium ──"
c=$(code GET "/api/stats" "$JAR_B"); chk "GET /api/stats sans clé admin" "401" "$c"
c=$(code GET "/api/premium/status" "$JAR_B"); chk "GET /api/premium/status" "200" "$c"
echo "     corps (doit montrer nullptr pour B) : $(head -c 140 /tmp/body.txt)"
c=$(code POST "/api/premium/create-code" "$JAR_B" "" '{"code":"HACK-TEST","days":365}')
chk "POST create-code sans clé admin" "401" "$c"

echo "── 5. Sans cookie / cookie forgé ──"
c=$(code GET "/api/sync/day?date=$OTHER_DATE" /dev/null); chk "anonyme GET /api/sync/day" "401" "$c"
c=$(code GET "/api/sync/days" /dev/null); chk "anonyme GET /api/sync/days" "401" "$c"
c=$(code GET "/api/sync/account" /dev/null); chk "anonyme GET /api/sync/account" "401" "$c"
c=$(code PUT "/api/sync/account" /dev/null "" '{"account":{"name":"x","email":"y@z.tn"}}'); chk "anonyme PUT /api/sync/account" "401" "$c"
c=$(code POST "/api/sync/delete-account" /dev/null); chk "anonyme delete-account" "401" "$c"
echo "sahtek_session=deadbeefdeadbeef" > "$JAR_A"
c=$(code GET "/api/sync/days" "$JAR_A"); chk "cookie forgé GET /api/sync/days" "401" "$c"

echo "── 6. B écrit chez lui, A reste intact ──"
c=$(code PUT "/api/sync/day" "$JAR_B" "" "{\"day\":{\"date\":\"2026-09-28\",\"meals\":{\"breakfast\":[],\"lunch\":[],\"dinner\":[],\"snacks\":[]},\"water\":1,\"history\":[]}}")
chk "PUT /api/sync/day (B)" "200" "$c"
c=$(code GET "/api/sync/day?date=2026-09-28" "$JAR_B"); chk "B relit son jour" "200" "$c"
c=$(code GET "/api/sync/day?date=2026-09-28" /dev/null); chk "anonyme relit ce jour" "401" "$c"

echo "── 7. En-têtes du cookie de session ──"
curl -s -D - -o /dev/null -X POST "$API/api/auth/login" -H 'content-type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"Test1234!\"}" | grep -i "^set-cookie" | sed 's/^/  /'

echo "── 8. Nettoyage : suppression du compte jetable ──"
c=$(code POST "/api/sync/delete-account" "$JAR_B"); chk "delete-account (B)" "200" "$c"
rm -f "$JAR_A" "$JAR_B"

echo
echo "RÉSULTAT : $pass OK / $fail KO"
