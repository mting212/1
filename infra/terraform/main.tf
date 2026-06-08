# MeetFlow MVP Infrastructure (placeholder — complete with real cloud provider)
# This file defines the expected resources. Customize for your cloud provider.

# ── Expected Resources (MVP Single-Server) ──────────────────
#
# 1. Compute: 1× VPS (4 vCPU, 8 GB RAM) — Hetzner CX42 / DigitalOcean / AWS t3.xlarge
# 2. Database: Managed PostgreSQL 16 (or self-hosted via compose)
# 3. Cache: Managed Redis 7 (or self-hosted via compose)
# 4. DNS: A record → VPS IP, with subdomain staging
# 5. Firewall: Allow 80/443 (HTTP/S), 22 (SSH), deny all other inbound
# 6. Backups: Daily PostgreSQL dump + off-site sync
#
# ── For single-server MVP, use compose.prod.yml directly. ──
# ── Uncomment and customize below when moving to cloud.    ──

terraform {
  required_version = ">= 1.5"
  # backend "s3" { ... }  # Configure remote state for teams
}

# ── Provider (example: Hetzner) ────────────────────────────
# provider "hcloud" {
#   token = var.hcloud_token
# }
#
# resource "hcloud_server" "meetflow" {
#   name        = "meetflow-mvp"
#   image       = "ubuntu-24.04"
#   server_type = "cx42"  # 4 vCPU, 8 GB RAM
#   location    = "nbg1"
#
#   public_net {
#     ipv4_enabled = true
#   }
#
#   ssh_keys = [hcloud_ssh_key.default.id]
# }

# ── Variables ──────────────────────────────────────────────
variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "staging"
}

variable "domain" {
  description = "Primary domain"
  type        = string
  default     = "meetflow.dev"
}
