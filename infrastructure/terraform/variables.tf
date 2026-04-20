# ─────────────────────────────────────────────────────────────────────────────
# infrastructure/terraform/variables.tf
# ─────────────────────────────────────────────────────────────────────────────

variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment label (production / staging)"
  type        = string
  default     = "production"
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "subnet_cidr" {
  description = "CIDR block for the public subnet"
  type        = string
  default     = "10.0.0.0/20"
}

variable "availability_zone" {
  description = "AZ for the subnet and EC2 instance"
  type        = string
  default     = "us-east-1a"
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t2.micro"
}

variable "root_volume_size_gb" {
  description = "Root EBS volume size in GiB"
  type        = number
  default     = 8
}

variable "ec2_key_pair_name" {
  description = "Name of an existing EC2 Key Pair for SSH access (optional — SSM is used for CI/CD)"
  type        = string
  default     = ""
}

variable "github_repo" {
  description = "GitHub repository in owner/repo format (used in outputs)"
  type        = string
  default     = "NeroSiegfried/LoopBridge"
}

variable "allowed_ssh_cidrs" {
  description = "CIDR list allowed SSH access. Leave empty to omit the rule (use SSM instead)."
  type        = list(string)
  default     = []
}
