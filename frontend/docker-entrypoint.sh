#!/bin/sh
# Runs automatically when the nginx container starts: writes the backend URL
# from the API_URL environment variable so it can change without rebuilding.
cat > /usr/share/nginx/html/config.js <<CONF
window.__CONFIG__ = { API_URL: "${API_URL:-http://localhost:8080}" };
CONF
