#!/usr/bin/env python3
"""DB health check queries - runs on VPS via SSH."""
import json
from datetime import datetime, timezone, timedelta
from db import get_client

sb = get_client()
results = {}

cutoff_30m = (datetime.now(timezone.utc) - timedelta(minutes=30)).isoformat()
r = sb.table("processing_queue").select("id").eq("status", "processing").lt("created_at", cutoff_30m).execute()
results["stuck_processing"] = len(r.data) if r.data else 0

cutoff_1h = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
r = sb.table("processed_videos").select("id").eq("status", "failed").gt("created_at", cutoff_1h).execute()
results["recent_failures"] = len(r.data) if r.data else 0

cutoff_10m = (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat()
r = sb.table("deliveries").select("id").eq("status", "sending").lt("created_at", cutoff_10m).execute()
results["stuck_deliveries"] = len(r.data) if r.data else 0

r = sb.table("deliveries").select("id", count="exact").eq("status", "pending").execute()
results["pending_deliveries"] = r.count if r.count is not None else (len(r.data) if r.data else 0)

r = sb.table("processing_queue").select("id", count="exact").eq("status", "pending").execute()
results["pending_jobs"] = r.count if r.count is not None else (len(r.data) if r.data else 0)

cutoff_24h = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
r_sent = sb.table("deliveries").select("id", count="exact").eq("status", "sent").gt("created_at", cutoff_24h).execute()
r_failed = sb.table("deliveries").select("id", count="exact").eq("status", "failed").gt("created_at", cutoff_24h).execute()
results["deliveries_sent_24h"] = r_sent.count if r_sent.count is not None else (len(r_sent.data) if r_sent.data else 0)
results["deliveries_failed_24h"] = r_failed.count if r_failed.count is not None else (len(r_failed.data) if r_failed.data else 0)

print(json.dumps(results))
