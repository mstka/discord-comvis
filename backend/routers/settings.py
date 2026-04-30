import logging
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from config import settings, get_settings

logger = logging.getLogger(__name__)
router = APIRouter()


def _mask(key: str) -> str:
    if not key:
        return ""
    return "*" * (len(key) - 4) + key[-4:] if len(key) >= 4 else "****"


@router.get("/available-models")
async def list_available_models():
    """List Gemini models accessible with the current API key."""
    import httpx
    from config import settings as cfg
    key = cfg.gemini_api_key
    if not key:
        return {"error": "GEMINI_API_KEY not set"}
    results = {}
    async with httpx.AsyncClient(timeout=10) as client:
        for ver in ("v1", "v1beta"):
            url = f"https://generativelanguage.googleapis.com/{ver}/models?key={key}"
            try:
                resp = await client.get(url)
                if resp.status_code == 200:
                    models = [m["name"] for m in resp.json().get("models", [])]
                    results[ver] = models
                else:
                    results[ver] = f"HTTP {resp.status_code}"
            except Exception as e:
                results[ver] = str(e)
    return results


@router.get("")
async def get_settings_endpoint():
    return {
        "discord_bot_token": _mask(settings.discord_bot_token),
        "gemini_api_key": _mask(settings.gemini_api_key),
        "slow_alpha": settings.slow_alpha,
        "slow_beta": settings.slow_beta,
        "slow_gamma": settings.slow_gamma,
        "slow_delta": settings.slow_delta,
        "slow_lambda_default": settings.slow_lambda_default,
        "slow_lambda_incident": settings.slow_lambda_incident,
        "slow_lambda_casual": settings.slow_lambda_casual,
        "edge_confidence_threshold": settings.edge_confidence_threshold,
        "open_socket_timeout_hours": settings.open_socket_timeout_hours,
    }


class SettingsUpdate(BaseModel):
    discord_bot_token: Optional[str] = None
    gemini_api_key: Optional[str] = None
    slow_alpha: Optional[float] = None
    slow_beta: Optional[float] = None
    slow_gamma: Optional[float] = None
    slow_delta: Optional[float] = None
    slow_lambda_default: Optional[float] = None
    edge_confidence_threshold: Optional[float] = None
    open_socket_timeout_hours: Optional[int] = None


@router.put("")
async def update_settings(update: SettingsUpdate):
    import os

    env_path = ".env"
    lines: list[str] = []
    try:
        with open(env_path, "r", encoding="utf-8") as f:
            lines = f.readlines()
    except FileNotFoundError:
        pass

    env_map: dict[str, str] = {}
    for line in lines:
        if "=" in line and not line.startswith("#"):
            k, _, v = line.partition("=")
            env_map[k.strip()] = v.strip()

    update_dict = update.model_dump(exclude_none=True)
    field_map = {
        "discord_bot_token": "DISCORD_BOT_TOKEN",
        "gemini_api_key": "GEMINI_API_KEY",
        "slow_alpha": "SLOW_ALPHA",
        "slow_beta": "SLOW_BETA",
        "slow_gamma": "SLOW_GAMMA",
        "slow_delta": "SLOW_DELTA",
        "slow_lambda_default": "SLOW_LAMBDA_DEFAULT",
        "edge_confidence_threshold": "EDGE_CONFIDENCE_THRESHOLD",
        "open_socket_timeout_hours": "OPEN_SOCKET_TIMEOUT_HOURS",
    }

    for field, env_key in field_map.items():
        if field in update_dict:
            env_map[env_key] = str(update_dict[field])

    with open(env_path, "w", encoding="utf-8") as f:
        for k, v in env_map.items():
            f.write(f"{k}={v}\n")

    return {"status": "saved", "note": "Restart server to apply token/key changes"}
