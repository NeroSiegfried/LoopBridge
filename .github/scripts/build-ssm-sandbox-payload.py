#!/usr/bin/env python3
"""
Build the SSM send-command JSON payload for a sandbox deploy.
No hardcoded account IDs — all values come from environment variables.
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
registry = os.environ['IMAGE'].split('/')[0]   # derive from IMAGE

cmds = [
    'set -euo pipefail',
    f'aws ecr get-login-password --region {region} | docker login --username AWS --password-stdin {registry}',
    f'docker pull {image}:sandbox-{sha}',
    f'docker rm -f {container} 2>/dev/null || true',
    # Snapshot prod DB for sandbox testing
    f'cp /data/loopbridge.db {db} 2>/dev/null && rm -f {db}-wal {db}-shm || true',
    (
        f'docker run -d --name {container} --restart unless-stopped'
        f' -p {port}:3000 -v /data:/data'
        f' -e NODE_ENV=production'
        f' -e DB_TYPE=sqlite -e DB_PATH={db}'
        f' -e STORAGE_DRIVER=s3 -e S3_BUCKET={bucket} -e S3_REGION={region} -e S3_PREFIX=sandbox/'
        f' -e COOKIE_SECURE=false -e CORS_ORIGIN=true'
        f' {image}:sandbox-{sha}'
    ),
    f'sleep 5 && docker ps --filter name={container}',
    f'docker logs {container} --tail 20',
    # Prune old sandbox images (keep last 3)
    f"docker images {image} --format '{{{{.Tag}}}} {{{{.ID}}}}' | grep '^sandbox-' | tail -n +4 | awk '{{print $2}}' | xargs -r docker rmi -f 2>/dev/null || true",
]

payload = {
    'InstanceIds': [instance],
    'DocumentName': 'AWS-RunShellScript',
    'Comment': f'Sandbox {sha}',
    'TimeoutSeconds': 300,
    'Parameters': {'commands': cmds},
}
json.dump(payload, sys.stdout, indent=2)
