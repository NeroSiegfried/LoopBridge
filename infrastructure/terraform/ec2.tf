# ─────────────────────────────────────────────────────────────────────────────
# infrastructure/terraform/ec2.tf
# EC2 t2.micro running Amazon Linux 2023 with Docker pre-installed
# ─────────────────────────────────────────────────────────────────────────────

# Latest Amazon Linux 2023 AMI in the configured region
data "aws_ami" "al2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }

  filter {
    name   = "architecture"
    values = ["x86_64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }

  filter {
    name   = "state"
    values = ["available"]
  }
}

resource "aws_instance" "app" {
  ami                    = data.aws_ami.al2023.id
  instance_type          = var.instance_type
  subnet_id              = aws_subnet.public.id
  vpc_security_group_ids = [aws_security_group.app.id]
  iam_instance_profile   = aws_iam_instance_profile.ec2.name
  key_name               = var.ec2_key_pair_name != "" ? var.ec2_key_pair_name : null

  # 8 GB gp3 root volume (same as current production)
  root_block_device {
    volume_type           = "gp3"
    volume_size           = var.root_volume_size_gb
    delete_on_termination = true
    encrypted             = true

    tags = { Name = "${local.name_prefix}-root-volume" }
  }

  # Bootstrap: install Docker + SSM Agent + AWS CLI on first boot
  user_data = base64encode(<<-EOF
    #!/bin/bash
    set -euo pipefail
    exec > /var/log/user-data.log 2>&1

    echo "=== Updating system ==="
    dnf update -y

    echo "=== Installing Docker ==="
    dnf install -y docker
    systemctl enable docker
    systemctl start docker
    usermod -aG docker ec2-user

    echo "=== Installing AWS CLI v2 ==="
    dnf install -y unzip
    curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o /tmp/awscliv2.zip
    unzip -q /tmp/awscliv2.zip -d /tmp
    /tmp/aws/install
    rm -rf /tmp/awscliv2.zip /tmp/aws

    echo "=== Installing SSM Agent ==="
    dnf install -y amazon-ssm-agent
    systemctl enable amazon-ssm-agent
    systemctl start amazon-ssm-agent

    echo "=== Creating /data directory for SQLite ==="
    mkdir -p /data
    chown ec2-user:ec2-user /data

    echo "=== Bootstrap complete ==="
  EOF
  )

  tags = { Name = "${local.name_prefix}-app" }

  # Prevent accidental termination of the running instance
  lifecycle {
    ignore_changes = [
      # AMI will drift as AWS releases new AL2023 versions — ignore to avoid
      # forced replacement on every apply after initial provisioning
      ami,
      # user_data runs only on first boot
      user_data,
    ]
  }
}

# Elastic IP so the public IP is stable across stop/start cycles
resource "aws_eip" "app" {
  instance = aws_instance.app.id
  domain   = "vpc"

  tags = { Name = "${local.name_prefix}-eip" }
}
