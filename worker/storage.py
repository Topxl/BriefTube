"""Cloudflare R2 storage — audio file upload, URL and deletion.

R2 is S3-compatible with zero egress cost, which eliminates the main
source of Supabase bandwidth overage.

Required env vars (set in .env):
  R2_ACCOUNT_ID        — Cloudflare Account ID (found in dashboard sidebar)
  R2_ACCESS_KEY_ID     — R2 API token "Access Key ID"
  R2_SECRET_ACCESS_KEY — R2 API token "Secret Access Key"
  R2_BUCKET_NAME       — bucket name (default: brieftube-audio)
  R2_PUBLIC_URL        — public base URL, no trailing slash
                         e.g. "https://pub-xxxx.r2.dev"
                         or   "https://audio.brief-tube.com"
"""

import logging
from pathlib import Path

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from config import (
    R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
    R2_BUCKET_NAME,
    R2_PUBLIC_URL,
    R2_PROXY_HTTP,
)

logger = logging.getLogger(__name__)


def _client():
    """Return a boto3 S3 client pointed at Cloudflare R2.

    When R2_PROXY_HTTP is set, all R2 traffic is routed through that HTTP proxy.
    This is a workaround for networks that block the Cloudflare IP range
    (e.g. an ISP/router blackholing TCP 443 to 172.64.0.0/13) — the proxy exits
    from an unblocked residential IP. Costs proxy bandwidth, so only enable while
    the underlying network block is active.
    """
    if not R2_ACCOUNT_ID or not R2_ACCESS_KEY_ID or not R2_SECRET_ACCESS_KEY:
        raise RuntimeError(
            "Cloudflare R2 credentials not configured. "
            "Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY in .env"
        )
    config_kwargs = {"signature_version": "s3v4"}
    if R2_PROXY_HTTP:
        config_kwargs["proxies"] = {"http": R2_PROXY_HTTP, "https": R2_PROXY_HTTP}
    return boto3.client(
        "s3",
        endpoint_url=f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY,
        config=Config(**config_kwargs),
        region_name="auto",
    )


def upload_audio(local_path: Path, storage_key: str) -> str:
    """Upload an MP3 file to R2 and return its public URL.

    Args:
        local_path:  Path to the local audio file.
        storage_key: Object key in the bucket, e.g. "audio/abc123_fr.mp3".

    Returns:
        Public URL of the uploaded file.

    Raises:
        RuntimeError: If credentials are missing.
        ClientError:  If the upload fails on R2 side.
    """
    if not R2_PUBLIC_URL:
        raise RuntimeError(
            "R2_PUBLIC_URL is not set. "
            "Enable public access on the bucket and set R2_PUBLIC_URL in .env"
        )

    client = _client()
    with open(local_path, "rb") as f:
        client.put_object(
            Bucket=R2_BUCKET_NAME,
            Key=storage_key,
            Body=f,
            ContentType="audio/mpeg",
        )

    url = f"{R2_PUBLIC_URL.rstrip('/')}/{storage_key}"
    logger.debug(f"R2 upload OK: {storage_key} → {url}")
    return url


def delete_audio(storage_key: str) -> None:
    """Delete an object from R2 (best-effort, errors are logged not raised)."""
    try:
        _client().delete_object(Bucket=R2_BUCKET_NAME, Key=storage_key)
        logger.debug(f"R2 delete OK: {storage_key}")
    except ClientError as e:
        logger.warning(f"R2 delete failed for {storage_key}: {e}")


def is_configured() -> bool:
    """Return True if all required R2 env vars are present."""
    return bool(R2_ACCOUNT_ID and R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY and R2_PUBLIC_URL)
