---
title: Product
description: Everything you need to run modern services in production.
---

# A complete platform, not a pile of services

Cumulus bundles compute, storage, networking, and observability into one product that fits in your head. You'll learn the surface area in an afternoon.

## Compute

<div class="feature-grid">

<div class="feature">
<div class="feature-icon">⚙️</div>

### Containers

Run any OCI image. We handle scheduling, scaling, and health checks. No Kubernetes manifests.

</div>

<div class="feature">
<div class="feature-icon">λ</div>

### Functions

Event-triggered code in nine languages, with cold starts measured in milliseconds.

</div>

<div class="feature">
<div class="feature-icon">🧩</div>

### Background jobs

Durable queues, scheduled tasks, and retries with exponential backoff — built in.

</div>

</div>

## Data

<div class="feature-grid">

<div class="feature">
<div class="feature-icon">🗄️</div>

### Postgres

Managed Postgres 16 with point-in-time recovery and read replicas in one click.

</div>

<div class="feature">
<div class="feature-icon">📦</div>

### Object storage

S3-compatible buckets with global replication. Egress to your own apps is free.

</div>

<div class="feature">
<div class="feature-icon">⏱️</div>

### Cache

A managed Redis-compatible cache, co-located with your compute for sub-ms latency.

</div>

</div>

## Developer experience

```bash
# Deploy from your laptop, the same way it'll deploy in CI.
cumulus deploy

# Tail logs from any region.
cumulus logs --region eu-west

# Open a SQL shell against the production replica.
cumulus db psql --read-only
```

The CLI is the same surface humans and machines use. Whatever you can do in the dashboard, you can script. Whatever you can script, you can put under code review.
