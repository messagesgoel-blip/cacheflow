#!/bin/bash
# Test script to verify web UI is working

echo "Testing CacheFlow Web UI..."
echo "============================="

# Check if web container is running
if ! docker ps | grep -q cacheflow-web; then
  echo "❌ cacheflow-web container is not running"
  exit 1
fi

echo "✅ cacheflow-web container is running"

# Check if Next.js is listening
if docker exec cacheflow-web netstat -tulpn 2>/dev/null | grep -q ":3010.*LISTEN"; then
  echo "✅ Next.js is listening on port 3010"
else
  echo "❌ Next.js is not listening on port 3010"
fi

# Check environment variables
echo "Environment variables in web container:"
docker exec cacheflow-web printenv NEXT_PUBLIC_API_URL 2>/dev/null | sed 's/^/  NEXT_PUBLIC_API_URL: /'
docker exec cacheflow-web printenv HOSTNAME 2>/dev/null | sed 's/^/  HOSTNAME: /'
docker exec cacheflow-web printenv PORT 2>/dev/null | sed 's/^/  PORT: /'

# Check if can connect to API
echo -n "Testing API connection from web container... "
if docker exec cacheflow-web wget -q -O- http://api:8100/health 2>/dev/null | grep -q '"status":"ok"'; then
  echo "✅ Connected to API"
else
  echo "❌ Cannot connect to API"
fi

# Check Docker port mapping
echo -n "Docker port mapping: "
docker port cacheflow-web 3010 2>/dev/null | sed 's/^/  /'

# Check container logs for errors
echo "Recent container logs (last 5 lines):"
docker logs --tail 5 cacheflow-web 2>/dev/null | sed 's/^/  /'

echo ""
echo "Summary:"
echo "--------"
echo "If all checks pass ✅, the web UI should be working."
echo "Cloudflare access depends on:"
echo "1. Host firewall allowing port 3010"
echo "2. Cloudflare tunnel configuration"
echo "3. DNS pointing to Cloudflare"
echo ""
echo "To test from outside, try accessing:"
echo "  http://YOUR_HOST_IP:3010"
echo ""
echo "For Cloudflare Tunnel, ensure tunnel is configured to route to:"
echo "  http://localhost:3010 (on the host)"