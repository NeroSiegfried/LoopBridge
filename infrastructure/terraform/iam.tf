# ─────────────────────────────────────────────────────────────────────────────
# infrastructure/terraform/iam.tf
# IAM roles, instance profile, CI/CD user
# ─────────────────────────────────────────────────────────────────────────────

# ════════════════════════════════════════════════════════════════════════════
# 1. EC2 Instance Role
# ════════════════════════════════════════════════════════════════════════════

resource "aws_iam_role" "ec2" {
  name = "${local.name_prefix}-ec2-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

# AWS managed policies
resource "aws_iam_role_policy_attachment" "ec2_ssm" {
  role       = aws_iam_role.ec2.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy_attachment" "ec2_ecr_read" {
  role       = aws_iam_role.ec2.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
}

resource "aws_iam_role_policy_attachment" "ec2_secrets" {
  role       = aws_iam_role.ec2.name
  policy_arn = "arn:aws:iam::aws:policy/SecretsManagerReadWrite"
}

# Inline: S3 access for uploads + Litestream replication
resource "aws_iam_role_policy" "ec2_s3" {
  name = "loopbridge-s3-access"
  role = aws_iam_role.ec2.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:ListBucket"]
      Resource = [
        "arn:aws:s3:::${local.bucket_name}",
        "arn:aws:s3:::${local.bucket_name}/*"
      ]
    }]
  })
}

# Inline: MediaConvert job submission + PassRole
resource "aws_iam_role_policy" "ec2_mediaconvert" {
  name = "MediaConvertAccess"
  role = aws_iam_role.ec2.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "mediaconvert:CreateJob",
          "mediaconvert:GetJob",
          "mediaconvert:ListJobs",
          "mediaconvert:DescribeEndpoints"
        ]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = "iam:PassRole"
        Resource = aws_iam_role.mediaconvert.arn
      }
    ]
  })
}

# Instance Profile wrapping the role
resource "aws_iam_instance_profile" "ec2" {
  name = "${local.name_prefix}-ec2-profile"
  role = aws_iam_role.ec2.name
}

# ════════════════════════════════════════════════════════════════════════════
# 2. MediaConvert Role
# ════════════════════════════════════════════════════════════════════════════

resource "aws_iam_role" "mediaconvert" {
  name = "${local.name_prefix}-mediaconvert-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "mediaconvert.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

# Inline: Read input from /uploads/, write output to /transcoded/
resource "aws_iam_role_policy" "mediaconvert_s3" {
  name = "MediaConvertS3Access"
  role = aws_iam_role.mediaconvert.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:GetObjectAcl"]
        Resource = "arn:aws:s3:::${local.bucket_name}/uploads/*"
      },
      {
        Effect   = "Allow"
        Action   = ["s3:PutObject", "s3:PutObjectAcl"]
        Resource = "arn:aws:s3:::${local.bucket_name}/transcoded/*"
      },
      {
        Effect   = "Allow"
        Action   = "s3:ListBucket"
        Resource = "arn:aws:s3:::${local.bucket_name}"
      }
    ]
  })
}

# ════════════════════════════════════════════════════════════════════════════
# 3. CI/CD IAM User (loopbridge-admin)
# Credentials go into GitHub Secrets: AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY
# ════════════════════════════════════════════════════════════════════════════

resource "aws_iam_user" "cicd" {
  name = "${local.name_prefix}-admin"
  path = "/"
}

resource "aws_iam_user_policy" "cicd_deploy" {
  name = "loopbridge-cicd-deploy"
  user = aws_iam_user.cicd.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "ECRAuth"
        Effect   = "Allow"
        Action   = "ecr:GetAuthorizationToken"
        Resource = "*"
      },
      {
        Sid    = "ECRPush"
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload",
          "ecr:PutImage",
          "ecr:BatchGetImage",
          "ecr:GetDownloadUrlForLayer",
          "ecr:DescribeRepositories",
          "ecr:ListImages"
        ]
        Resource = aws_ecr_repository.api.arn
      },
      {
        Sid    = "SSMDeploy"
        Effect = "Allow"
        Action = [
          "ssm:SendCommand",
          "ssm:GetCommandInvocation",
          "ssm:ListCommandInvocations",
          "ssm:DescribeInstanceInformation"
        ]
        Resource = [
          "arn:aws:ssm:${var.aws_region}::document/AWS-RunShellScript",
          aws_instance.app.arn,
          "arn:aws:ssm:${var.aws_region}:${local.account_id}:*"
        ]
      },
      {
        Sid    = "S3Litestream"
        Effect = "Allow"
        Action = ["s3:GetObject", "s3:PutObject", "s3:ListBucket"]
        Resource = [
          "arn:aws:s3:::${local.bucket_name}",
          "arn:aws:s3:::${local.bucket_name}/litestream/*"
        ]
      },
      {
        Sid      = "EC2DescribeForHealthCheck"
        Effect   = "Allow"
        Action   = "ec2:DescribeInstances"
        Resource = "*"
      }
    ]
  })
}

# Access key — value is in Terraform state (sensitive).
# After apply: terraform output -raw cicd_access_key_id
#              terraform output -raw cicd_secret_access_key
resource "aws_iam_access_key" "cicd" {
  user = aws_iam_user.cicd.name
}
