#!/usr/bin/env python3
"""
Build the SSM send-command JSON payload for a production deploy.

Architecture: nginx (reverse proxy + rate limiting) + app (stateless API)
running as separate Docker Compose services on the EC2.
Config files are base64-encoded into the SSM command to avoid file dependencies.
"""
import base64, json, os, sys

ecr_registry = os.environ['ECR_REGISTRY']
sha          = os.environ['SHA']
region       = os.environ['REGION']
instance     = os.environ['INSTANCE']
bucket       = os.environ['S3_BUCKET']
mc_role      = os.environ.get('MC_ROLE', '')
image        = f"{ecr_registry}/loopbridge-api"

google  = os.environ.get('GOOGLE_CLIENT_ID', '')
s_host  = os.environ.get('SMTP_HOST', '')
s_port  = os.environ.get('SMTP_PORT', '587')
s_user  = os.environ.get('SMTP_USER', '')
s_pass  = os.environ.get('SMTP_PASS', '')
nl_from = os.environ.get('NEWSLETTER_FROM_EMAIL', '')
tw_sid  = os.environ.get('TWILIO_ACCOUNT_SID', '')
tw_tok  = os.environ.get('TWILIO_AUTH_TOKEN', '')
tw_wa   = os.environ.get('TWILIO_WHATSAPP_FROM', '')
tw_sms  = os.environ.get('TWILIO_SMS_FROM', '')
jwt     = os.environ.get('JWT_SECRET', '')

env_file_lines = [
    f'APP_IMAGE={image}:{sha}',
    'NODE_ENV=production',
    'DB_TYPE=sqlite',
    'DB_PATH=/data/loopbridge.db',
    'STORAGE_DRIVER=s3',
    f'S3_BUCKET={bucket}',
    f'S3_REGION={region}',
    'S3_PREFIX=uploads/',
    f'LITESTREAM_S3_PATH=s3://{bucket}/litestream/loopbridge.db',
    f'MEDIACONVERT_ENDPOINT=https://mediaconvert.{region}.amazonaws.com',
    f'MEDIACONVERT_ROLE_ARN={mc_role}',
    'COOKIE_SECURE=false',
    'CORS_ORIGIN=true',
    f'GOOGLE_CLIENT_ID={google}',
    f'SMTP_HOST={s_host}',
    f'SMTP_PORT={s_port}',
    f'SMTP_USER={s_user}',
    f'SMTP_PASS={s_pass}',
    f'NEWSLETTER_FROM_EMAIL={nl_from}',
    f'TWILIO_ACCOUNT_SID={tw_sid}',
    f'TWILIO_AUTH_TOKEN={tw_tok}',
    f'TWILIO_WHATSAPP_FROM={tw_wa}',
    f'TWILIO_SMS_FROM={tw_sms}',
    f'JWT_SECRET={jwt}',
]
env_file_content = '\\n'.join(env_file_lines)

# nginx.conf — HTTP only; SSL added later via certbot + nginx reload
nginx_conf = r"""events { worker_connections 1024; }

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    sendfile        on;
    keepalive_timeout 65;
    client_max_body_size 500m;
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    limit_req_zone $binary_remote_addr zone=api:10m rate=30r/s;

    upstream app {
        server app:3000;
        keepalive 32;
    }

    server {
        listen 80;
        server_name _;

        location = /health {
            access_log off;
            proxy_pass http://app;
        }

        location /api/ {
            limit_req zone=api burst=60 nodelay;
            proxy_pass         http://app;
            proxy_http_version 1.1;
            proxy_set_header   Connection "";
            proxy_set_header   Host              $host;
            proxy_set_header   X-Real-IP         $remote_addr;
            proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
            proxy_set_header   X-Forwarded-Proto $scheme;
            proxy_read_timeout 120s;
        }

        location / {
            proxy_pass         http://app;
            proxy_http_version 1.1;
            proxy_set_header   Connection "";
            proxy_set_header   Host              $host;
            proxy_set_header   X-Real-IP         $remote_addr;
            proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
            proxy_set_header   X-Forwarded-Proto $scheme;

            location ~* \.(js|css|woff2?|png|jpg|svg|ico)$ {
                proxy_pass http://app;
                proxy_cache_valid 200 365d;
                add_header Cache-Control "public, max-age=31536000, immutable";
            }
        }
    }
}"""

# docker-compose for EC2 — nginx + app with absolute config path
compose_yml = f"""services:
  nginx:
    image: nginx:1.27-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /opt/loopbridge/nginx.conf:/etc/nginx/nginx.conf:ro
      - nginx-cache:/var/cache/nginx
    depends_on:
      app:
        condition: service_healthy
    logging:
      driver: json-file
      options: {{max-size: "10m", max-file: "3"}}

  app:
    image: {image}:{sha}
    restart: unless-stopped
    expose:
      - "3000"
    env_file:
      - /etc/loopbridge.env
    volumes:
      - /data:/data
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/api/health"]
      interval: 15s
      timeout: 5s
      retries: 3
      start_period: 30s
    logging:
      driver: json-file
      options: {{max-size: "50m", max-file: "5"}}

volumes:
  nginx-cache: {{}}"""


def b64(content: str) -> str:
    return base64.b64encode(content.encode()).decode()


cmds = [
    'set -euo pipefail',
    f'aws ecr get-login-password --region {region} | docker login --username AWS --password-stdin {ecr_registry}',
    f'docker pull {image}:{sha}',
    # Write env file
    f"printf '{env_file_content}\\n' > /etc/loopbridge.env",
    'chmod 600 /etc/loopbridge.env',
    # Write nginx + compose config (base64 avoids all shell escaping issues)
    'mkdir -p /opt/loopbridge',
    f'echo "{b64(nginx_conf)}" | base64 -d > /opt/loopbridge/nginx.conf',
    f'echo "{b64(compose_yml)}" | base64 -d > /opt/loopbridge/docker-compose.yml',
    # Stop legacy single-container deploy if present
    'docker rm -f loopbridge 2>/dev/null || true',
    # Deploy: nginx + app as separate services
    'docker compose -f /opt/loopbridge/docker-compose.yml up -d --remove-orphans',
    'docker compose -f /opt/loopbridge/docker-compose.yml ps',
    'docker compose -f /opt/loopbridge/docker-compose.yml logs --tail 20 app',
    'docker image prune -f',
]

payload = {
    'InstanceIds': [instance],
    'DocumentName': 'AWS-RunShellScript',
    'Comment': f'Deploy {sha}',
    'TimeoutSeconds': 300,
    'Parameters': {'commands': cmds},
}
json.dump(payload, sys.stdout, indent=2)
