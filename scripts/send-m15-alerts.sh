#!/bin/bash
# M15 Alerts - Send token scores to Telegram
# Run every 5 minutes during active sessions

cd /root/projects/macro-dashboard

# Telegram credentials (source from macro-dashboard .env)
export $(grep '^TELEGRAM' .env.local 2>/dev/null || echo "")

# API endpoint
API_URL="https://macro-dashboard-lemon.vercel.app/api/m15-alerts"

echo "[M15 Alerts] Sending at $(date)"

# Send summary alert
RESPONSE=$(curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "summary",
    "symbols": ["BTC", "ETH", "SOL", "BNB", "DOGE", "AVAX", "SUI", "ARB", "OP", "LINK", "WIF", "PEPE"]
  }')

echo "[M15 Alerts] Response: $RESPONSE"

# Parse JSON safely
if echo "$RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
  echo "[M15 Alerts] ✅ Sent successfully"
else
  echo "[M15 Alerts] ❌ Failed"
fi

echo "[M15 Alerts] Done at $(date)"
