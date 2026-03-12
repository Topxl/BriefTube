"""Notion Deliverer — crée une page dans une database Notion."""

import httpx
import logging

logger = logging.getLogger(__name__)
NOTION_API = "https://api.notion.com/v1"


async def send_to_notion(
    access_token: str,
    database_id: str,
    video_title: str,
    video_id: str,
    summary: str,
    audio_url: str,
    language: str = "fr",
) -> bool:
    """Create a page in the user's Notion database with the video summary."""
    if not access_token or not database_id:
        logger.warning(f"Notion delivery skipped: missing access_token or database_id for {video_id}")
        return False

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
    }

    children = [
        {
            "object": "block",
            "type": "paragraph",
            "paragraph": {
                "rich_text": [{"type": "text", "text": {"content": summary[:2000]}}],
            },
        },
        {
            "object": "block",
            "type": "bookmark",
            "bookmark": {"url": f"https://youtu.be/{video_id}"},
        },
    ]
    if audio_url:
        children.append({
            "object": "block",
            "type": "paragraph",
            "paragraph": {
                "rich_text": [
                    {"type": "text", "text": {"content": "Audio: "}},
                    {
                        "type": "text",
                        "text": {"content": "Listen to summary", "link": {"url": audio_url}},
                    },
                ],
            },
        })

    payload = {
        "parent": {"database_id": database_id},
        "properties": {
            "title": {"title": [{"text": {"content": video_title[:2000]}}]},
        },
        "children": children,
    }

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(f"{NOTION_API}/pages", headers=headers, json=payload)

        if resp.status_code == 401:
            logger.warning(f"Notion token revoked for database {database_id[:8]}…")
            return False  # Triggers mark_user_platform_disconnected
        if resp.status_code == 404:
            logger.warning(f"Notion database not found: {database_id[:8]}…")
            return False
        resp.raise_for_status()
        logger.info(f"Notion page created: {video_title[:50]}")
        return True
    except Exception as e:
        logger.error(f"Notion delivery failed for {video_id}: {e}")
        return False
