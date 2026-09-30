#!/usr/bin/env bash
# Test E2E du classement XP : compte jetable -> 3 journées journalisées ->
# lecture du classement -> suppression du compte (cascade).
set -u
BASE="http://localhost:3210"
STAMP=$(date +%s)
EMAIL="xptest-$STAMP@sahtek.test"
PASS="Test1234!"
JAR="/tmp/xp-test-cookie.txt"
rm -f "$JAR"

TODAY=$(date +%F)
D1=$(date -d "-1 day" +%F)
D2=$(date -d "-2 days" +%F)

day_payload() { # $1 = date, $2 = nombre d'entrées
  local date="$1" n="$2"
  node -e '
    const date = process.argv[1], n = Number(process.argv[2]);
    const mk = (i) => ({ entryId: "e" + i, quantity: 1, food: { id: "f" + i, name: "Test", serving: "1", calories: 200, protein: 10, carbs: 20, fat: 5, emoji: "🍽️" } });
    const meals = { breakfast: [], lunch: [], dinner: [], snacks: [] };
    const keys = ["breakfast", "lunch", "dinner", "snacks"];
    for (let i = 0; i < n; i++) meals[keys[i % 4]].push(mk(i));
    process.stdout.write(JSON.stringify({ day: { date, meals, water: 3, history: [], customFoods: [], weightEntries: [] } }));
  ' "$date" "$n"
}

echo "== 1. inscription =="
curl -s -c "$JAR" -X POST "$BASE/api/auth/signup" -H "Content-Type: application/json" \
  -d "{\"name\":\"XP Test\",\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" | head -c 200; echo

echo "== 2. journées : $D2 (4), $D1 (3), $TODAY (2) =="
for pair in "$D2 4" "$D1 3" "$TODAY 2"; do
  set -- $pair
  code=$(curl -s -b "$JAR" -o /dev/null -w "%{http_code}" -X PUT "$BASE/api/sync/day?date=$1" \
    -H "Content-Type: application/json" -d "$(day_payload "$1" "$2")")
  echo "  $1 ($2 entrées) -> HTTP $code"
done

echo "== 3. classement (sans cookie = doit être refusé) =="
curl -s -o /dev/null -w "  anonyme -> HTTP %{http_code}\n" "$BASE/api/leaderboard"

echo "== 4. classement (connecté) =="
curl -s -b "$JAR" "$BASE/api/leaderboard" | node -e '
  let raw = "";
  process.stdin.on("data", (d) => (raw += d));
  process.stdin.on("end", () => {
    const r = JSON.parse(raw);
    console.log("  total:", r.total, "| updatedAt:", new Date(r.updatedAt).toISOString());
    console.log("  me:", JSON.stringify(r.me));
    console.log("  top:", r.entries.slice(0, 5).map((e) => `${e.rank}. ${e.name} ${e.xp}XP L${e.level}(${e.title}) streak=${e.streak}${e.isMe ? " <ME>" : ""}`).join("\n       "));
    const leaked = JSON.stringify(r).match(/@|email|userId|id"/g);
    console.log("  champs sensibles exposés:", leaked ? leaked.slice(0, 5).join(",") : "aucun");
    const exp = 4 * 10 + 20 + 3 * 10 + 20 + 5 + 2 * 10 + 10; // 145
    console.log("  XP attendu:", exp, "| XP calculé:", r.me ? r.me.xp : "n/a", r.me && r.me.xp === exp ? "✅" : "❌");
  });
'

echo "== 5. suppression du compte (cascade) =="
curl -s -b "$JAR" -o /dev/null -w "  delete-account -> HTTP %{http_code}\n" -X POST "$BASE/api/sync/delete-account"
rm -f "$JAR"
