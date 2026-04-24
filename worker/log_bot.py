#!/usr/bin/env python3
"""
BriefTube Log Bot — dashboard interactif pour le monitoring du worker.

Interface à boutons Telegram (pas de logs bruts) :
  - Statut worker (actif / en veille / arrêté)
  - Statistiques en temps réel depuis Supabase
  - Erreurs récentes reformatées lisiblement
  - Activité récente (résumés traités, livraisons)
  - Infos système (CPU, RAM, disque)
  - Alertes push automatiques (erreurs critiques, démarrage/arrêt)

Setup:
  LOG_BOT_TOKEN=...         token du bot (via @BotFather)
  LOG_BOT_ADMIN_CHAT_ID=... ton chat_id Telegram
"""

import asyncio
import atexit
import fcntl
import html as _html
import logging
import os
import re
import signal
import sys
import time
from collections import deque
from datetime import datetime, timezone
from pathlib import Path

import psutil
from dotenv import load_dotenv
from supabase import create_client, Client
from telegram import BotCommand, Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, CallbackQueryHandler, ContextTypes

from monitoring import format_log_line

load_dotenv(override=True)

# ── Single-instance enforcement ─────────────────────────────────────

# Lock/PID live under /tmp rather than the worker dir because the systemd
# hardening drop-in sets ProtectHome=read-only (see scripts/vps/harden.sh).
# With PrivateTmp=yes each service instance gets its own tmpfs under /tmp,
# so the lock is automatically fresh on each restart and invisible to other
# processes — which is exactly what we want for single-instance enforcement.
_LOCK_DIR = Path("/tmp")
_PID_FILE = _LOCK_DIR / "brieftube-log-bot.pid"
_LOCK_FILE = _LOCK_DIR / "brieftube-log-bot.lock"
_lock_fd = None  # keep fd open for the lifetime of the process (flock is held by the fd)


def _cleanup_pid_file() -> None:
    """Remove PID file and release flock on clean exit."""
    global _lock_fd
    try:
        if _PID_FILE.exists() and _PID_FILE.read_text().strip() == str(os.getpid()):
            _PID_FILE.unlink()
    except Exception:
        pass
    if _lock_fd is not None:
        try:
            fcntl.flock(_lock_fd, fcntl.LOCK_UN)
            _lock_fd.close()
        except Exception:
            pass


def _enforce_single_instance() -> None:
    """Guarantee that only one log_bot process runs at a time.

    Two-layer protection:
    1. fcntl exclusive flock — OS-level, released automatically by the kernel
       even if the process crashes (no stale lock possible).
    2. PID file — human-readable, lets systemd/scripts know the current PID.

    On conflict the new process exits immediately with code 1 so systemd
    does NOT retry (Restart=on-failure only triggers on non-zero exit from crash,
    not from a deliberate sys.exit(1) guard… but we also SIGTERM the old instance
    before trying, so in practice this path is only hit on race conditions).
    """
    global _lock_fd

    # ── Layer 1: OS-level exclusive flock ──────────────────────────
    fd = open(_LOCK_FILE, "w")
    try:
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        logger.error(
            "Another log_bot instance already holds the lock — exiting. "
            "Run 'sudo systemctl status brieftube-log-bot' to inspect."
        )
        fd.close()
        sys.exit(1)
    _lock_fd = fd  # keep open — flock is tied to the file descriptor lifetime

    # ── Layer 2: PID file (with graceful takeover of stale instances) ──
    if _PID_FILE.exists():
        try:
            old_pid = int(_PID_FILE.read_text().strip())
            os.kill(old_pid, 0)  # raises ProcessLookupError if dead
            logger.warning(f"Stale log_bot instance found (PID {old_pid}) — sending SIGTERM")
            os.kill(old_pid, signal.SIGTERM)
            for _ in range(20):  # wait up to 10 s
                time.sleep(0.5)
                try:
                    os.kill(old_pid, 0)
                except ProcessLookupError:
                    logger.info(f"Previous log_bot (PID {old_pid}) terminated cleanly")
                    break
            else:
                logger.warning(f"PID {old_pid} did not exit after SIGTERM — sending SIGKILL")
                try:
                    os.kill(old_pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
        except (ProcessLookupError, ValueError):
            pass  # already dead or corrupt PID file — fine

    _PID_FILE.write_text(str(os.getpid()))
    atexit.register(_cleanup_pid_file)
    logger.info(f"Log bot single-instance lock acquired (PID {os.getpid()}, lock: {_LOCK_FILE})")


# ── Config ─────────────────────────────────────────────────────────

LOG_FILE = Path(__file__).parent / "worker.log"
LOG_BOT_TOKEN = os.getenv("LOG_BOT_TOKEN", "")
LOG_BOT_ADMIN_CHAT_ID = os.getenv("LOG_BOT_ADMIN_CHAT_ID", "")
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

# Nombre max de caractères dans un message Telegram
_MAX_MSG = 3800

# ── Logging ────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s %(message)s",
)
logger = logging.getLogger("log_bot")

# ── Supabase ───────────────────────────────────────────────────────

_sb: Client | None = None


def _get_sb() -> Client | None:
    global _sb
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        return None
    if _sb is None:
        _sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    return _sb


# ── Watch state (pour les alertes live) ────────────────────────────

_watch_tasks: dict[str, asyncio.Task] = {}
_watch_offsets: dict[str, int] = {}

# ── Helpers ────────────────────────────────────────────────────────

def _is_admin(chat_id: str) -> bool:
    return bool(LOG_BOT_ADMIN_CHAT_ID) and chat_id == str(LOG_BOT_ADMIN_CHAT_ID)


def _log_size() -> int:
    try:
        return LOG_FILE.stat().st_size
    except Exception:
        return 0


def _last_log_time() -> datetime | None:
    """Retourne le timestamp de la dernière ligne du worker.log."""
    try:
        with open(LOG_FILE, "rb") as f:
            f.seek(max(0, _log_size() - 600))
            tail = f.read().decode("utf-8", errors="replace")
        matches = re.findall(r"(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}),\d+", tail)
        if not matches:
            return None
        return datetime.strptime(matches[-1], "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
    except Exception:
        return None


def _fmt_age(seconds: float) -> str:
    """Convertit des secondes en durée lisible : 42s / 5min / 1h30."""
    s = int(seconds)
    if s < 60:
        return f"{s}s"
    m = s // 60
    if m < 60:
        return f"{m}min"
    h, rm = divmod(m, 60)
    return f"{h}h{rm:02d}" if rm else f"{h}h"


def _worker_badge() -> str:
    """🟢 / 🟡 / 🔴 selon l'activité récente du worker."""
    last = _last_log_time()
    if last is None:
        return "🔴 Arrêté (aucun log)"
    age = (datetime.now(timezone.utc) - last).total_seconds()
    age_str = _fmt_age(age)
    if age < 120:
        return f"🟢 Actif (il y a {age_str})"
    if age < 600:
        return f"🟡 En veille (il y a {age_str})"
    return f"🔴 Inactif (il y a {age_str})"


def _queue_stats() -> dict:
    try:
        sb = _get_sb()
        if not sb:
            return {}
        res = sb.table("processing_queue").select("status").execute()
        counts: dict[str, int] = {}
        for row in res.data:
            s = row["status"]
            counts[s] = counts.get(s, 0) + 1
        return counts
    except Exception:
        return {}


def _delivery_stats() -> dict:
    """Livraisons du jour (depuis minuit UTC)."""
    try:
        sb = _get_sb()
        if not sb:
            return {}
        today = (
            datetime.now(timezone.utc)
            .replace(hour=0, minute=0, second=0, microsecond=0)
            .isoformat()
        )
        res = sb.table("deliveries").select("status").gte("created_at", today).execute()
        counts: dict[str, int] = {}
        for row in res.data:
            s = row["status"]
            counts[s] = counts.get(s, 0) + 1
        return counts
    except Exception:
        return {}


def _groq_stats_today() -> dict:
    """Parse today's Groq Whisper usage from worker.log.

    Returns cost, audio minutes, transcriptions count, rate-limit hits,
    and last known quota (seconds used from the 429 error message).
    """
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    total_cost = 0.0
    transcriptions = 0
    rate_limits = 0
    last_quota_used = 0
    ip_blocks = 0
    _COST_RE = re.compile(r"cost: ~\$(\d+\.\d+)")
    _QUOTA_RE = re.compile(r"Used (\d+), Requested \d+")

    try:
        with open(LOG_FILE, "r", encoding="utf-8", errors="replace") as f:
            for line in f:
                if today not in line:
                    continue
                m = _COST_RE.search(line)
                if m and "Transcription complete" in line:
                    total_cost += float(m.group(1))
                    transcriptions += 1
                if "rate_limit_exceeded" in line or "Rate limit reached" in line:
                    rate_limits += 1
                    qm = _QUOTA_RE.search(line)
                    if qm:
                        last_quota_used = max(last_quota_used, int(qm.group(1)))
                if "blocking requests" in line.lower() or "YouTube is blocking" in line:
                    ip_blocks += 1
    except Exception:
        pass

    return {
        "cost": total_cost,
        "minutes": total_cost / 0.00067 if total_cost else 0.0,
        "transcriptions": transcriptions,
        "rate_limits": rate_limits,
        "quota_used": last_quota_used,
        "ip_blocks": ip_blocks,
    }


def _recent_errors(n: int = 10) -> list[str]:
    """Dernières erreurs/warnings reformatés lisiblement."""
    try:
        with open(LOG_FILE, "r", encoding="utf-8", errors="replace") as f:
            lines = [l for l in f if " ERROR " in l or " WARNING " in l]
        tail = lines[-n:]
        result = []
        _RE = re.compile(r"\d{4}-\d{2}-\d{2} (\d{2}:\d{2}):\d{2},\d+ \[[^\]]+\] (\w+) (.*)")
        for line in tail:
            m = _RE.match(line.rstrip())
            if not m:
                continue
            time, level, msg = m.groups()
            # Tronque les messages très longs (ex : JSON d'erreur Groq)
            msg = msg[:130] + ("…" if len(msg) > 130 else "")
            safe = _html.escape(msg)
            if level in ("ERROR", "CRITICAL"):
                result.append(f"<b>{time}</b>  {safe}")
            else:
                result.append(f"<i>{time}</i>  {safe}")
        return result or ["✅ Aucune erreur récente"]
    except FileNotFoundError:
        return ["worker.log introuvable — le worker tourne-t-il ?"]
    except Exception as e:
        return [f"Erreur lecture log : {_html.escape(str(e))}"]


def _recent_activity(n: int = 18) -> list[str]:
    """Dernières lignes de log reformatées (sans les lignes de trace Python)."""
    try:
        with open(LOG_FILE, "r", encoding="utf-8", errors="replace") as f:
            raw_lines = list(deque(f, maxlen=n * 3))  # fetch more, then filter

        result = []
        _RE = re.compile(r"\d{4}-\d{2}-\d{2} (\d{2}:\d{2}):\d{2},\d+ \[[^\]]+\] (\w+) (.*)")
        for line in raw_lines:
            m = _RE.match(line.rstrip())
            if not m:
                continue  # skip Python tracebacks / blank lines
            time, level, msg = m.groups()
            msg = msg[:110] + ("…" if len(msg) > 110 else "")
            safe = _html.escape(msg)
            text = f"{time}  {safe}"
            if level in ("ERROR", "CRITICAL"):
                result.append(f"<b>{text}</b>")
            elif level == "WARNING":
                result.append(f"<i>{text}</i>")
            else:
                result.append(text)
            if len(result) >= n:
                break

        return result or ["(aucune activité)"]
    except FileNotFoundError:
        return ["worker.log introuvable"]
    except Exception as e:
        return [f"Erreur : {_html.escape(str(e))}"]


def _system_info() -> str:
    try:
        cpu = psutil.cpu_percent(interval=0.3)
        mem = psutil.virtual_memory()
        disk = psutil.disk_usage("/")
        used_gb = mem.used / 1024 ** 3
        total_gb = mem.total / 1024 ** 3
        size = _log_size()
        size_str = f"{size / 1024 / 1024:.1f} MB" if size >= 1024 * 1024 else f"{size // 1024} KB"
        return (
            f"CPU    {cpu}%\n"
            f"RAM    {mem.percent}% · {used_gb:.1f} / {total_gb:.0f} GB\n"
            f"Disk   {disk.free // 1024 ** 3} GB libres · {disk.percent}% utilisé\n"
            f"Log    {size_str}"
        )
    except Exception as e:
        return f"Indisponible : {e}"


def _read_new_bytes(offset: int) -> tuple[str, int]:
    try:
        size = _log_size()
        if size <= offset:
            return "", offset
        with open(LOG_FILE, "rb") as f:
            f.seek(offset)
            data = f.read()
        return data.decode("utf-8", errors="replace"), size
    except Exception as e:
        return f"Erreur : {e}", offset


# ── Text builders ───────────────────────────────────────────────────

def _text_menu() -> str:
    last = _last_log_time()
    last_str = last.strftime("%H:%M:%S") if last else "—"
    return (
        f"<b>BriefTube Worker</b>\n\n"
        f"Statut    {_worker_badge()}\n"
        f"Dernier log    {last_str}"
    )


def _text_stats() -> str:
    q = _queue_stats()
    d = _delivery_stats()
    g = _groq_stats_today()

    queued = q.get("queued", 0)
    processing = q.get("processing", 0)
    completed = q.get("completed", 0)
    failed_q = q.get("failed", 0)
    d_sent = d.get("sent", 0)
    d_pending = d.get("pending", 0)
    d_failed = d.get("failed", 0)

    # Groq quota display
    quota_used = g["quota_used"]
    quota_pct = quota_used / 28800 * 100 if quota_used else 0
    if quota_pct >= 95:
        quota_emoji = "🔴"
    elif quota_pct >= 80:
        quota_emoji = "🟡"
    else:
        quota_emoji = "🟢"

    groq_lines = (
        f"\n<b>Groq Whisper (aujourd'hui)</b>\n"
        f"• Coût          ${g['cost']:.4f}\n"
        f"• Audio         {g['minutes']:.0f} min\n"
        f"• Transcriptions {g['transcriptions']}\n"
    )
    if quota_used:
        groq_lines += f"• Quota  {quota_emoji} {quota_used}/28800s ({quota_pct:.0f}%)\n"
    if g["rate_limits"]:
        groq_lines += f"• Rate limits   ⚠️ {g['rate_limits']}\n"
    if g["ip_blocks"]:
        groq_lines += f"• IP bloquée    🔴 {g['ip_blocks']}x\n"

    return (
        f"<b>Statistiques</b>\n\n"
        f"<b>File de traitement</b>\n"
        f"• En attente    {queued}\n"
        f"• En cours      {processing}\n"
        f"• Terminées     {completed}\n"
        f"• Échecs        {failed_q}\n\n"
        f"<b>Livraisons (aujourd'hui)</b>\n"
        f"• Envoyées      {d_sent}\n"
        f"• En attente    {d_pending}\n"
        f"• Échouées      {d_failed}"
        f"{groq_lines}"
    )


def _text_errors() -> str:
    lines = _recent_errors(10)
    body = "\n".join(lines)
    if len(body) > _MAX_MSG:
        body = body[-_MAX_MSG:]
    return f"<b>Erreurs récentes</b>\n\n{body}"


def _text_activity() -> str:
    lines = _recent_activity(18)
    body = "\n".join(lines)
    if len(body) > _MAX_MSG:
        body = "…\n" + body[-_MAX_MSG:]
    return f"<b>Activité récente</b>\n\n{body}"


def _text_system() -> str:
    return f"<b>Système</b>\n\n<code>{_system_info()}</code>"


# ── Keyboards ───────────────────────────────────────────────────────

def _kb_menu(chat_id: str = "") -> InlineKeyboardMarkup:
    watch_on = bool(chat_id and chat_id in _watch_tasks and not _watch_tasks[chat_id].done())
    watch_label = "🔴 Alertes live : ON" if watch_on else "🔔 Alertes live : OFF"
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton("📊 Stats", callback_data="stats"),
            InlineKeyboardButton("⚠️ Erreurs", callback_data="errors"),
        ],
        [
            InlineKeyboardButton("📋 Activité", callback_data="activity"),
            InlineKeyboardButton("💻 Système", callback_data="system"),
        ],
        [
            InlineKeyboardButton(watch_label, callback_data="watch_toggle"),
            InlineKeyboardButton("🔄 Actualiser", callback_data="menu"),
        ],
    ])


def _kb_view(view: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton("🔙 Menu", callback_data="menu"),
            InlineKeyboardButton("🔄 Actualiser", callback_data=view),
        ]
    ])


# ── Command handlers ────────────────────────────────────────────────

async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    chat_id = str(update.effective_chat.id)
    if not _is_admin(chat_id):
        await update.message.reply_text(
            f"Accès refusé.\n\nTon chat ID : <code>{chat_id}</code>\n"
            "Ajoute-le dans LOG_BOT_ADMIN_CHAT_ID dans worker/.env.",
            parse_mode="HTML",
        )
        return
    await update.message.reply_text(
        _text_menu(),
        reply_markup=_kb_menu(chat_id),
        parse_mode="HTML",
    )


async def status_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    chat_id = str(update.effective_chat.id)
    if not _is_admin(chat_id):
        return
    await update.message.reply_text(_text_menu(), reply_markup=_kb_menu(chat_id), parse_mode="HTML")


async def stats_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    chat_id = str(update.effective_chat.id)
    if not _is_admin(chat_id):
        return
    await update.message.reply_text(_text_stats(), reply_markup=_kb_view("stats"), parse_mode="HTML")


def _start_watch(chat_id: str, bot) -> None:
    """Démarre la boucle d'alertes live pour ce chat (helper partagé)."""
    _watch_offsets[chat_id] = _log_size()
    _RE = re.compile(r"\d{4}-\d{2}-\d{2} (\d{2}:\d{2}):\d{2},\d+ \[[^\]]+\] (\w+) (.*)")

    async def _loop() -> None:
        while chat_id in _watch_offsets:
            await asyncio.sleep(20)
            if chat_id not in _watch_offsets:
                break
            new_text, new_offset = _read_new_bytes(_watch_offsets[chat_id])
            _watch_offsets[chat_id] = new_offset
            if not new_text.strip():
                continue
            error_lines = [
                l for l in new_text.splitlines()
                if " ERROR " in l or " WARNING " in l or "✅" in l
            ]
            if not error_lines:
                continue
            formatted = []
            for line in error_lines[-8:]:
                m = _RE.match(line.rstrip())
                if not m:
                    continue
                t, level, msg = m.groups()
                msg = msg[:120] + ("…" if len(msg) > 120 else "")
                safe = _html.escape(msg)
                txt = f"{t}  {safe}"
                if level in ("ERROR", "CRITICAL"):
                    formatted.append(f"<b>{txt}</b>")
                elif level == "WARNING":
                    formatted.append(f"<i>{txt}</i>")
                else:
                    formatted.append(txt)
            if formatted:
                try:
                    await bot.send_message(
                        chat_id=chat_id,
                        text="\n".join(formatted),
                        parse_mode="HTML",
                    )
                except Exception as e:
                    logger.error(f"Watch send error: {e}")

    _watch_tasks[chat_id] = asyncio.create_task(_loop())


async def watch_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Toggle live alerts from a slash command."""
    chat_id = str(update.effective_chat.id)
    if not _is_admin(chat_id):
        return
    if chat_id in _watch_tasks and not _watch_tasks[chat_id].done():
        _watch_tasks[chat_id].cancel()
        del _watch_tasks[chat_id]
        _watch_offsets.pop(chat_id, None)
        state = "désactivées"
    else:
        _start_watch(chat_id, context.bot)
        state = "activées"
    await update.message.reply_text(
        f"🔔 Alertes live {state}.\n\n{_text_menu()}",
        reply_markup=_kb_menu(chat_id),
        parse_mode="HTML",
    )


# ── Callback handler ────────────────────────────────────────────────

async def button_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    await query.answer()

    chat_id = str(query.message.chat_id)
    if not _is_admin(chat_id):
        return

    data = query.data

    # ── Watch toggle ────────────────────────────────────────────────
    if data == "watch_toggle":
        if chat_id in _watch_tasks and not _watch_tasks[chat_id].done():
            # Stop
            _watch_tasks[chat_id].cancel()
            del _watch_tasks[chat_id]
            if chat_id in _watch_offsets:
                del _watch_offsets[chat_id]
            await query.answer("Alertes live arrêtées", show_alert=True)
            text = _text_menu()
            kb = _kb_menu(chat_id)
        else:
            _start_watch(chat_id, context.bot)
            await query.answer("Alertes live activées (toutes les 20s)", show_alert=True)
            text = _text_menu()
            kb = _kb_menu(chat_id)

        try:
            await query.edit_message_text(text=text, reply_markup=kb, parse_mode="HTML")
        except Exception:
            pass
        return

    # ── Regular views ────────────────────────────────────────────────
    builders = {
        "menu": (_text_menu, lambda: _kb_menu(chat_id)),
        "stats": (_text_stats, lambda: _kb_view("stats")),
        "errors": (_text_errors, lambda: _kb_view("errors")),
        "activity": (_text_activity, lambda: _kb_view("activity")),
        "system": (_text_system, lambda: _kb_view("system")),
    }

    if data not in builders:
        return

    build_text, build_kb = builders[data]
    try:
        await query.edit_message_text(
            text=build_text(),
            reply_markup=build_kb(),
            parse_mode="HTML",
        )
    except Exception as e:
        # Telegram raises BadRequest if the message content hasn't changed
        logger.debug(f"Edit message skipped (likely unchanged): {e}")


# ── Entry point ────────────────────────────────────────────────────

async def _register_commands(app: Application) -> None:
    """Enregistre les commandes visibles dans le menu '/' de Telegram."""
    await app.bot.set_my_commands([
        BotCommand("start",  "Dashboard principal"),
        BotCommand("status", "Statut rapide du worker"),
        BotCommand("stats",  "Statistiques (file + livraisons + Groq)"),
        BotCommand("watch",  "Activer / désactiver les alertes live"),
    ])


def main() -> None:
    _enforce_single_instance()

    if not LOG_BOT_TOKEN:
        logger.error("LOG_BOT_TOKEN non défini — crée un bot via @BotFather")
        return
    if not LOG_BOT_ADMIN_CHAT_ID:
        logger.warning("LOG_BOT_ADMIN_CHAT_ID non défini — tous les accès seront refusés")

    app = (
        Application.builder()
        .token(LOG_BOT_TOKEN)
        .post_init(_register_commands)
        .build()
    )
    app.add_handler(CommandHandler("start",  start_command))
    app.add_handler(CommandHandler("status", status_command))
    app.add_handler(CommandHandler("stats",  stats_command))
    app.add_handler(CommandHandler("watch",  watch_command))
    app.add_handler(CallbackQueryHandler(button_callback))

    logger.info("Log bot starting...")
    app.run_polling(
        allowed_updates=["message", "callback_query"],
        drop_pending_updates=True,
    )


if __name__ == "__main__":
    main()
