#!/bin/bash
# Cron throughput stress test.
# Fires N parallel cron requests and measures throughput.
# Usage: CRON_SECRET=xxx BASE_URL=https://your-app.vercel.app ./scripts/cron-stress-test.sh [concurrency] [total]
# Requires: curl, bc (optional for avg calculation)

set -e
CRON_SECRET="${CRON_SECRET:?CRON_SECRET required}"
BASE_URL="${BASE_URL:-http://localhost:3000}"
CONCURRENCY="${1:-5}"
TOTAL="${2:-20}"

echo "Cron stress test: $CONCURRENCY concurrent, $TOTAL total requests to $BASE_URL/api/cron/run-jobs"

SUCCESS=0
FAIL=0
TOTAL_MS=0

# Portable millisecond timestamp (macOS date lacks %N)
for i in $(seq 1 "$TOTAL"); do
  (
    START=$(python3 -c "import time; print(int(time.time()*1000))" 2>/dev/null || echo "$(date +%s)000")
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X GET -H "x-cron-secret: $CRON_SECRET" "$BASE_URL/api/cron/run-jobs")
    END=$(python3 -c "import time; print(int(time.time()*1000))" 2>/dev/null || echo "$(date +%s)000")
    MS=$((END - START))
    echo "$STATUS $MS" > /tmp/cron-stress-$i
  ) &
  if [ $((i % CONCURRENCY)) -eq 0 ] || [ "$i" -eq "$TOTAL" ]; then
    wait
  fi
done

for i in $(seq 1 "$TOTAL"); do
  read -r STATUS MS < /tmp/cron-stress-$i
  rm -f /tmp/cron-stress-$i
  if [ "$STATUS" = "200" ]; then
    SUCCESS=$((SUCCESS + 1))
  else
    FAIL=$((FAIL + 1))
  fi
  TOTAL_MS=$((TOTAL_MS + MS))
done

echo "Done: $SUCCESS success, $FAIL fail, total ${TOTAL_MS}ms"
if [ "$SUCCESS" -gt 0 ] && command -v bc >/dev/null 2>&1; then
  AVG=$(echo "scale=0; $TOTAL_MS / $SUCCESS" | bc)
  echo "Avg response time (success): ${AVG}ms"
fi
