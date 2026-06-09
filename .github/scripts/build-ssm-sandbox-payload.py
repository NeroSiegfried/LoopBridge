#!/usr/bin/env python3
"""
Build the AWS SSM send-command JSON payload for the SANDBOX deploy.
All values come from environment variables (set in the workflow env: block)
so no secrets ever appear in the YAML or shell strings.

Writes JSON to stdout.
"""
import json, os, sys

image    = os.environ['IMAGE']
sha      = os.environ['SHA']
instance = os.environ['INSTANCE']
container= os.environ['CONTAINER']
port     = os.environ['PORT']
db       = os.environ['DBPATH']
bucket   = os.environ['BUCKET']
region   = os.environ['REGION']
registry = '680128294518.dkr.ecr.us-east-1.amazonaws.com'
mc_role  = 'arn:aws:iam::680128294518:role/loopbridge-mediaconvert-role'
ec2_ip   = os.environ.get('EC2_IP', '44.197.184.251')

cmds = [
    'set -euo pipefail',
    'echo "--- Authenticating with ECR ---"',
    f'aws ecr get-login-password --region {region} | sudo docker login --username AWS --password-stdin {registry}',
    f'echo "--- Pulling {image}:sandbox-{sha} ---"',
    f'sudo docker pull {image}:sandbox-{sha}',
    'echo "--- Stopping old sandbox container ---"',
    f'sudo docker rm -f {container} 2>/dev/null || true',
    'echo "--- Checkpointing prod WAL ---"',
    (
        "sudo docker exec -w /app/server loopbridge node -e "
        "\"const db=require('better-sqlite3')(process.env.DB_PATH);"
        "db.pragma('wal_checkpoint(TRUNCATE)');db.close();\" "
        "|| echo 'WARNING: checkpoint failed'"
    ),
    'echo "--- Snapshotting prod DB ---"',
    f'sudo cp /data/loopbridge.db {db} && sudo rm -f {db}-wal {db}-shm '
    f'&& echo "DB snapshot done" || echo "WARNING: prod DB not found, starting fresh"',
    f'echo "--- Starting sandbox on port {port} ---"',
    (
        f'sudo docker run -d --name {container} --restart unless-stopped'
        f' -p {port}:3000 -v /data:/data'
        f' -e NODE_ENV=production -e DB_TYPE=sqlite -e DB_PATH={db}'
        f' -e STORAGE_DRIVER=s3 -e S3_BUCKET={bucket} -e S3_REGION={region} -e S3_PREFIX=sandbox/'
        f' -e MEDIACONVERT_ENDPOINT=https://mediaconvert.{region}.amazonaws.com'
        f' -e MEDIACONVERT_ROLE_ARN={mc_role}'
        f' -e TRANSCODE_WEBHOOK_URL=http://{ec2_ip}:{port}/api/transcode/webhook'
        f' -e COOKIE_SECURE=false -e CORS_ORIGIN=true'
        f' {image}:sandbox-{sha}'
    ),
    'echo "--- Container status ---"',
    f'sleep 5 && sudo docker ps --filter name={container} --format "table {{{{.Names}}}}\\t{{{{.Status}}}}\\t{{{{.Ports}}}}"',
    'echo "--- Last 10 log lines ---"',
    f'sudo docker logs {container} --tail 10',
    'echo "--- Pruning old sandbox images ---"',
    f"sudo docker images {image} --format '{{{{.Tag}}}} {{{{.ID}}}}' | grep '^sandbox-' | tail -n +4 | awk '{{print $2}}' | xargs -r sudo docker rmi -f 2>/dev/null || true",
]

payload = {
    'InstanceIds': [instance],
    'DocumentName': 'AWS-RunShellScript',
    'Comment': f'Sandbox deploy {sha}',
    'TimeoutSeconds': 300,
    'Parameters': {'commands': cmds},
}

json.dump(payload, sys.stdout, indent=2)
