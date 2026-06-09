# ─────────────────────────────────────────────────────────────────────────────
# infrastructure/terraform/ec2.tf
# ─────────────────────────────────────────────────────────────────────────────

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
  instance_type          = local.instance_type
  subnet_id              = aws_subnet.public.id
  vpc_security_group_ids = [aws_security_group.app.id]
  iam_instance_profile   = aws_iam_instance_profile.ec2.name
  key_name               = var.ec2_key_pair_name != "" ? var.ec2_key_pair_name : null

  root_block_device {
    volume_type           = "gp3"
    volume_size           = var.root_volume_size_gb
    delete_on_termination = true
    encrypted             = true
    tags = { Name = "${local.name_prefix}-root" }
  }

  # Bootstrap: Docker + Docker Compose + SSM Agent
  user_data = base64encode(<<-EOF
    #!/bin/bash
    set -euo pipefail
    exec > /var/log/user-data.log 2>&1

    dnf update -y

    # Docker
    dnf install -y docker
    systemctl enable --now docker
    usermod -aG docker ec2-user

    # Docker Compose v2
    mkdir -p /usr/local/lib/docker/cli-plugins
    curl -fsSL \
      "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64" \
      -o /usr/local/lib/docker/cli-plugins/docker-compose
    chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

    # AWS CLI v2
    dnf install -y unzip
    curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o /tmp/awscliv2.zip
    unzip -q /tmp/awscliv2.zip -d /tmp && /tmp/aws/install
    rm -rf /tmp/awscliv2.zip /tmp/aws

    # SSM Agent
    dnf install -y amazon-ssm-agent
    systemctl enable --now amazon-ssm-agent

    # Persistent data directory for SQLite
    mkdir -p /data
    chown ec2-user:ec2-user /data

    echo "Bootstrap complete"
  EOF
  )

  tags = {
    Name    = "${local.name_prefix}-app"
    Project = "LoopBridge"
  }

  lifecycle {
    ignore_changes = [ami, user_data]
  }
}

resource "aws_eip" "app" {
  instance = aws_instance.app.id
  domain   = "vpc"
  tags     = { Name = "${local.name_prefix}-eip" }
}
