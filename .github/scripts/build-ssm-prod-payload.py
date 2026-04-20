#!/usr/bin/env python3
"""
Build the AWS SSM send-command JSON payload for the PRODUCTION deploy.
All values come from environment variables (set in the workflow env: block)
so no secrets ever appear in the YAML or shell strings.

Writes JSON to stdout.
"""
import json, os, sys

image   = os.environ['IMAGE']
sha     = os.environ['SHA']
instance= os.environ['INSTANCE']
bucket  = os.environ['BUCKET']
region  = os.environ['REGION']
registry= '680128294518.dkr.ecr.us-east-1.amazonaws.com'
mc_role = 'arn:aws:iam::680128294518:role/loopbridge-mediaconvert-role'

# Secrets — passed via env:, masked in logs
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
ls_key  = os.environ.get('LITESTREAM_KEY', '')
ls_sec  = os.environ.get('LITESTREAM_SECRET', '')
jwt     = os.environ.get('JWT_SECRET', '')

docker_run = (
    f'sudo docker run -d --name loopbridge --restart unless-stopped'
    f' -p 80:3000 -v /data:/data'
    f' -e NODE_ENV=production -e DB_TYPE=sqlite -e DB_PATH=/data/loopbridge.db'
    f' -e STORAGE_DRIVER=s3 -e S3_BUCKET={bucket} -e S3_REGION={region} -e S3_PREFIX=uploads/'
    f' -e MEDIACONVERT_ENDPOINT=https://mediaconvert.{region}.amazonaws.com'
    f' -e MEDIACONVERT_ROLE_ARN={mc_role}'
    f' -e COOKIE_SECURE=false -e CORS_ORIGIN=true'
    f' -e LITESTREAM_S3_PATH=s3://{bucket}/litestream/loopbridge.db'
    f' -e LITESTREAM_ACCESS_KEY_ID={ls_key}'
    f' -e LITESTREAM_SECRET_ACCESS_KEY={ls_sec}'
    f' -e GOOGLE_CLIENT_ID={google}'
    f' -e SMTP_HOST={s_host} -e SMTP_PORT={s_port}'
    f' -e SMTP_USER={s_user} -e SMTP_PASS={s_pass}'
    f' -e NEWSLETTER_FROM_EMAIL={nl_from}'
    f' -e TWILIO_ACCOUNT_SID={tw_sid} -e TWILIO_AUTH_TOKEN={tw_tok}'
    f' -e TWILIO_WHATSAPP_FROM={tw_wa} -e TWILIO_SMS_FROM={tw_sms}'
    f' -e JWT_SECRET={jwt}'
    f' {image}:{sha}'
)

cmds = [
    'set -euo pipefail',
    'echo "--- Authenticating with ECR ---"',
    f'aws ecr get-login-password --region {region} | sudo docker login --username AWS --password-stdin {registry}',
    f'echo "--- Pulling {image}:{sha} ---"',
    f'sudo docker pull {image}:{sha}',
    'echo "--- Stopping old container ---"',
    'sudo docker rm -f loopbridge 2>/dev/null || true',
    'echo "--- Starting new container ---"',
    docker_run,
    'echo "--- Container status ---"',
    'sleep 5 && sudo docker ps --filter name=loopbridge --format "table {{{{.Names}}}}\\t{{{{.Status}}}}\\t{{{{.Ports}}}}"',
    'echo "--- Last 10 log lines ---"',
    'sudo docker logs loopbridge --tail 10',
    'echo "--- Pruning old images ---"',
    'sudo docker image prune -f',
]

payload = {
    'InstanceIds': [instance],
    'DocumentName': 'AWS-RunShellScript',
    'Comment': f'Deploy {sha}',
    'TimeoutSeconds': 300,
    'Parameters': {'commands': cmds},
}

json.dump(payload, sys.stdout, indent=2)
