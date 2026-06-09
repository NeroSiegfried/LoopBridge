# RDS is intentionally NOT provisioned.
# App uses SQLite + Litestream (S3 replication) — handles thousands of users cheaply.
#
# Add RDS when: you need > 1 concurrent write-app replica, or SQLite WAL is the
# measured bottleneck. Switch by setting DB_TYPE=postgres + DATABASE_URL.
