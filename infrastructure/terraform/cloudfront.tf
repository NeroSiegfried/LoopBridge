# CloudFront CDN is intentionally NOT provisioned at micro/small tier.
# S3 media is served via signed URLs from the app.
#
# Enable CloudFront when: you have significant global media traffic and S3
# egress costs justify the CDN overhead. Set enable_cloudfront = true in
# environments.tf production config and uncomment resources below.
