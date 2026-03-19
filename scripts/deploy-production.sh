#!/usr/bin/env sh
set -eu

COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.production"

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --build --remove-orphans

attempt=1
max_attempts=20

while [ "$attempt" -le "$max_attempts" ]; do
  if docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps --format json | python3 -c "import json, sys; services = [json.loads(line) for line in sys.stdin if line.strip()]; sys.exit(0 if services and all(s.get('State') == 'running' and (s.get('Health') in ('', 'healthy')) for s in services) else 1)"; then
    exit 0
  fi

  sleep 5
  attempt=$((attempt + 1))
done

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" logs --tail 100 proxy backend frontend
exit 1
