"""Authentication — two-role password-based JWT auth.

Roles
-----
admin  : password "Test2525"  — can trigger data collection, run analysis, update settings
viewer : password "LookSys555" — read-only access to dashboard, graph, reports

Usage
-----
POST /api/auth/login  → { token, role }
All protected routes: Authorization: Bearer <token>
"""
import logging
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from pydantic import BaseModel

from config import settings

logger = logging.getLogger(__name__)
router = APIRouter()

_bearer = HTTPBearer(auto_error=False)

Role = Literal["admin", "viewer"]


# ── helpers ──────────────────────────────────────────────────────────────────

def _create_token(role: Role) -> str:
    payload = {
        "sub": role,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=settings.jwt_expire_hours),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def _decode_token(token: str) -> dict:
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])


# ── dependency helpers (importable by other routers) ─────────────────────────

def get_current_role(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> Role:
    """Returns role or raises 401."""
    if not credentials:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="認証が必要です")
    try:
        data = _decode_token(credentials.credentials)
        return data["role"]
    except JWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="トークンが無効または期限切れです")


def require_admin(role: Role = Depends(get_current_role)) -> Role:
    """Raises 403 if not admin."""
    if role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="管理者権限が必要です（パスワード: Test2525）")
    return role


def require_viewer(role: Role = Depends(get_current_role)) -> Role:
    """Passes for both admin and viewer."""
    return role


# ── endpoints ────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    password: str


class LoginResponse(BaseModel):
    token: str
    role: Role
    expires_in_hours: int


@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest):
    if body.password == settings.admin_password:
        role: Role = "admin"
    elif body.password == settings.viewer_password:
        role = "viewer"
    else:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="パスワードが違います")

    token = _create_token(role)
    logger.info(f"Login: role={role}")
    return LoginResponse(token=token, role=role, expires_in_hours=settings.jwt_expire_hours)


@router.get("/me")
async def me(role: Role = Depends(get_current_role)):
    return {"role": role}
