"""Database-backed auth and app-data routes."""
import base64
import hashlib
import hmac
import os
import secrets
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import delete as sql_delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from database import get_db
from db_models import AppUser, Asset, Loan, PasswordResetToken, SigninOtp, Watchlist, WatchlistItem
from services import email_service
from models.common import ApiResponse
from models.persistence_models import (
    AssetCreate,
    AssetUpdate,
    AuthCredentials,
    LoanCreate,
    LoanUpdate,
    OtpResend,
    OtpVerify,
    PasswordResetConfirm,
    PasswordResetRequest,
    WatchlistCreate,
    WatchlistItemCreate,
    WatchlistUpdate,
)

router = APIRouter(tags=["persistence"])

JWT_SECRET = os.getenv("JWT_SECRET") or os.getenv("SECRET_KEY")
if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET environment variable must be set")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_MINUTES = 60
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() == "true"
COOKIE_SAMESITE = os.getenv("COOKIE_SAMESITE", "lax").lower()
RESET_TOKEN_MINUTES = 30
OTP_EXPIRE_MINUTES = 10
OTP_MAX_ATTEMPTS = 5

_rate_buckets: dict[str, deque[float]] = defaultdict(deque)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _rate_limit(request: Request, key: str, limit: int = 10, window_seconds: int = 60) -> None:
    client = request.client.host if request.client else "unknown"
    bucket = _rate_buckets[f"{key}:{client}"]
    now = time.time()
    while bucket and now - bucket[0] > window_seconds:
        bucket.popleft()
    if len(bucket) >= limit:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many attempts. Try again later.")
    bucket.append(now)


def _hash_password(password: str, salt: bytes | None = None, iterations: int = 200_000) -> str:
    salt = salt or os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    return f"pbkdf2_sha256_{iterations}${base64.b64encode(salt).decode()}${base64.b64encode(digest).decode()}"


def _verify_password(password: str, stored: str) -> bool:
    try:
        algorithm, salt_b64, digest_b64 = stored.split("$", 2)
        if algorithm == "pbkdf2_sha256":
            iterations = 120_000
        elif algorithm.startswith("pbkdf2_sha256_"):
            iterations = int(algorithm.removeprefix("pbkdf2_sha256_"))
        else:
            return False
        expected = _hash_password(password, base64.b64decode(salt_b64), iterations).split("$", 2)[2]
        return hmac.compare_digest(expected, digest_b64)
    except (ValueError, TypeError):
        return False


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _create_access_token(user: AppUser) -> str:
    expires_at = _now() + timedelta(minutes=ACCESS_TOKEN_MINUTES)
    return jwt.encode(
        {"sub": user.id, "email": user.email, "exp": expires_at, "iat": _now()},
        JWT_SECRET,
        algorithm=JWT_ALGORITHM,
    )


def _set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        "access_token",
        token,
        max_age=ACCESS_TOKEN_MINUTES * 60,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        path="/",
    )


def _clear_auth_cookie(response: Response) -> None:
    response.delete_cookie("access_token", path="/")


def _current_user(request: Request, db: Session = Depends(get_db)) -> AppUser:
    token = request.cookies.get("access_token")
    auth_header = request.headers.get("Authorization", "")
    if not token and auth_header.startswith("Bearer "):
        token = auth_header.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired session")
    user = db.get(AppUser, payload.get("sub"))
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session")
    return user


def _iso(value: datetime) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.isoformat()


def _number(value) -> float:
    return float(value) if isinstance(value, Decimal) else value


def _user_row(user: AppUser) -> dict:
    return {"id": user.id, "email": user.email, "createdAt": _iso(user.created_at)}


def _loan_row(loan: Loan) -> dict:
    return {
        "id": loan.id,
        "name": loan.name,
        "principal": _number(loan.principal),
        "interestRate": _number(loan.interest_rate),
        "loanTerm": loan.loan_term,
        "monthlyPayment": _number(loan.monthly_payment),
        "totalAmountPaid": _number(loan.total_amount_paid),
        "totalInterest": _number(loan.total_interest),
        "notes": loan.notes,
        "createdAt": _iso(loan.created_at),
        "updatedAt": _iso(loan.updated_at),
    }


def _asset_row(asset: Asset) -> dict:
    return {
        "id": asset.id,
        "name": asset.name,
        "assetType": asset.asset_type,
        "value": _number(asset.value),
        "institution": asset.institution,
        "notes": asset.notes,
        "createdAt": _iso(asset.created_at),
        "updatedAt": _iso(asset.updated_at),
    }


def _watchlist_row(watchlist: Watchlist) -> dict:
    return {
        "id": watchlist.id,
        "name": watchlist.name,
        "description": watchlist.description,
        "isDefault": watchlist.is_default,
        "createdAt": _iso(watchlist.created_at),
        "updatedAt": _iso(watchlist.updated_at),
    }


def _watchlist_item_row(item: WatchlistItem) -> dict:
    return {"id": item.id, "symbol": item.symbol, "notes": item.notes, "addedDate": _iso(item.added_date)}


def _ensure_watchlist(db: Session, user_id: str, watchlist_id: str) -> Watchlist:
    watchlist = db.scalar(select(Watchlist).where(Watchlist.id == watchlist_id, Watchlist.user_id == user_id))
    if not watchlist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Watchlist not found")
    return watchlist


@router.post("/auth/signup", status_code=status.HTTP_201_CREATED)
async def signup(payload: AuthCredentials, request: Request, response: Response, db: Session = Depends(get_db)):
    _rate_limit(request, "signup", limit=5, window_seconds=300)
    if len(payload.password) < 12:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password must be at least 12 characters")
    user = AppUser(email=payload.email.strip().lower(), password_hash=_hash_password(payload.password))
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email is already registered")
    db.refresh(user)
    _set_auth_cookie(response, _create_access_token(user))
    return ApiResponse(success=True, data={"user": _user_row(user)}).model_dump(by_alias=True)


@router.post("/auth/signin")
async def signin(payload: AuthCredentials, request: Request, db: Session = Depends(get_db)):
    _rate_limit(request, "signin", limit=8, window_seconds=300)
    user = db.scalar(select(AppUser).where(AppUser.email == payload.email.strip().lower()))
    if not user or not _verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    db.execute(sql_delete(SigninOtp).where(SigninOtp.user_id == user.id))
    code = f"{secrets.randbelow(1_000_000):06d}"
    db.add(SigninOtp(user_id=user.id, code_hash=_token_hash(code), expires_at=_now() + timedelta(minutes=OTP_EXPIRE_MINUTES)))
    db.commit()
    await email_service.send_otp_email(user.email, code)
    return ApiResponse(success=True, data={"pendingUserId": user.id}).model_dump(by_alias=True)


@router.post("/auth/verify-otp")
async def verify_otp(payload: OtpVerify, request: Request, response: Response, db: Session = Depends(get_db)):
    _rate_limit(request, "verify-otp", limit=10, window_seconds=300)
    otp = db.scalar(
        select(SigninOtp).where(SigninOtp.user_id == payload.pending_user_id, SigninOtp.expires_at > _now())
    )
    if not otp or otp.attempts >= OTP_MAX_ATTEMPTS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired code")
    if not hmac.compare_digest(otp.code_hash, _token_hash(payload.code.strip())):
        otp.attempts += 1
        db.commit()
        remaining = OTP_MAX_ATTEMPTS - otp.attempts
        detail = "Invalid code" if remaining > 0 else "Too many incorrect attempts. Please sign in again."
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)
    user = db.get(AppUser, otp.user_id)
    db.delete(otp)
    db.commit()
    _set_auth_cookie(response, _create_access_token(user))
    return ApiResponse(success=True, data={"user": _user_row(user)}).model_dump(by_alias=True)


@router.post("/auth/resend-otp")
async def resend_otp(payload: OtpResend, request: Request, db: Session = Depends(get_db)):
    _rate_limit(request, "resend-otp", limit=3, window_seconds=300)
    user = db.get(AppUser, payload.pending_user_id)
    if user:
        db.execute(sql_delete(SigninOtp).where(SigninOtp.user_id == user.id))
        code = f"{secrets.randbelow(1_000_000):06d}"
        db.add(SigninOtp(user_id=user.id, code_hash=_token_hash(code), expires_at=_now() + timedelta(minutes=OTP_EXPIRE_MINUTES)))
        db.commit()
        await email_service.send_otp_email(user.email, code)
    return ApiResponse(success=True, message="If a pending sign-in exists, a new code has been sent.").model_dump(by_alias=True)


@router.post("/auth/signout")
async def signout(response: Response):
    _clear_auth_cookie(response)
    return ApiResponse(success=True).model_dump(by_alias=True)


@router.get("/auth/me")
async def me(user: AppUser = Depends(_current_user)):
    return ApiResponse(success=True, data={"user": _user_row(user)}).model_dump(by_alias=True)


@router.post("/auth/request-password-reset")
async def request_password_reset(payload: PasswordResetRequest, request: Request, db: Session = Depends(get_db)):
    _rate_limit(request, "password-reset", limit=5, window_seconds=300)
    user = db.scalar(select(AppUser).where(AppUser.email == payload.email.strip().lower()))
    reset_token: str | None = None
    if user:
        reset_token = secrets.token_urlsafe(32)
        db.add(
            PasswordResetToken(
                user_id=user.id,
                token_hash=_token_hash(reset_token),
                expires_at=_now() + timedelta(minutes=RESET_TOKEN_MINUTES),
            )
        )
        db.commit()
    data = {"resetToken": reset_token} if reset_token and os.getenv("ENV", "development") != "production" else None
    return ApiResponse(success=True, data=data, message="If that email exists, a reset link will be sent.").model_dump(
        by_alias=True
    )


@router.post("/auth/reset-password")
async def reset_password(payload: PasswordResetConfirm, request: Request, db: Session = Depends(get_db)):
    _rate_limit(request, "password-reset-confirm", limit=8, window_seconds=300)
    if len(payload.password) < 12:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password must be at least 12 characters")
    row = db.scalar(
        select(PasswordResetToken).where(
            PasswordResetToken.token_hash == _token_hash(payload.token),
            PasswordResetToken.used_at.is_(None),
            PasswordResetToken.expires_at > _now(),
        )
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset token")
    user = db.get(AppUser, row.user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid reset token")
    user.password_hash = _hash_password(payload.password)
    row.used_at = _now()
    db.commit()
    return ApiResponse(success=True, message="Password reset successfully").model_dump(by_alias=True)


@router.get("/loans")
async def get_loans(user: AppUser = Depends(_current_user), db: Session = Depends(get_db)):
    loans = db.scalars(select(Loan).where(Loan.user_id == user.id).order_by(Loan.created_at.desc())).all()
    return ApiResponse(success=True, data=[_loan_row(loan) for loan in loans]).model_dump(by_alias=True)


@router.post("/loans", status_code=status.HTTP_201_CREATED)
async def create_loan(payload: LoanCreate, user: AppUser = Depends(_current_user), db: Session = Depends(get_db)):
    loan = Loan(
        user_id=user.id,
        name=payload.name.strip(),
        principal=payload.principal,
        interest_rate=payload.interest_rate,
        loan_term=payload.loan_term,
        monthly_payment=payload.monthly_payment,
        total_amount_paid=payload.total_amount_paid,
        total_interest=payload.total_interest,
        notes=payload.notes.strip() if payload.notes else None,
    )
    db.add(loan)
    db.commit()
    db.refresh(loan)
    return ApiResponse(success=True, data=_loan_row(loan)).model_dump(by_alias=True)


@router.patch("/loans/{loan_id}")
async def update_loan(
    loan_id: str,
    payload: LoanUpdate,
    user: AppUser = Depends(_current_user),
    db: Session = Depends(get_db),
):
    loan = db.scalar(select(Loan).where(Loan.id == loan_id, Loan.user_id == user.id))
    if not loan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Loan not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(loan, key, value.strip() if isinstance(value, str) else value)
    db.commit()
    db.refresh(loan)
    return ApiResponse(success=True, data=_loan_row(loan)).model_dump(by_alias=True)


@router.delete("/loans/{loan_id}")
async def delete_loan(loan_id: str, user: AppUser = Depends(_current_user), db: Session = Depends(get_db)):
    loan = db.scalar(select(Loan).where(Loan.id == loan_id, Loan.user_id == user.id))
    if not loan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Loan not found")
    db.delete(loan)
    db.commit()
    return ApiResponse(success=True).model_dump(by_alias=True)


@router.get("/assets")
async def get_assets(user: AppUser = Depends(_current_user), db: Session = Depends(get_db)):
    assets = db.scalars(select(Asset).where(Asset.user_id == user.id).order_by(Asset.created_at.desc())).all()
    return ApiResponse(success=True, data=[_asset_row(asset) for asset in assets]).model_dump(by_alias=True)


@router.post("/assets", status_code=status.HTTP_201_CREATED)
async def create_asset(payload: AssetCreate, user: AppUser = Depends(_current_user), db: Session = Depends(get_db)):
    if payload.value < 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Asset value must be 0 or greater")
    asset = Asset(
        user_id=user.id,
        name=payload.name.strip(),
        asset_type=payload.asset_type.strip(),
        value=payload.value,
        institution=payload.institution.strip() if payload.institution else None,
        notes=payload.notes.strip() if payload.notes else None,
    )
    if not asset.name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Asset name is required")
    if not asset.asset_type:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Asset type is required")
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return ApiResponse(success=True, data=_asset_row(asset)).model_dump(by_alias=True)


@router.patch("/assets/{asset_id}")
async def update_asset(
    asset_id: str,
    payload: AssetUpdate,
    user: AppUser = Depends(_current_user),
    db: Session = Depends(get_db),
):
    asset = db.scalar(select(Asset).where(Asset.id == asset_id, Asset.user_id == user.id))
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")
    updates = payload.model_dump(exclude_unset=True)
    if updates.get("value") is not None and updates["value"] < 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Asset value must be 0 or greater")
    for key, value in updates.items():
        setattr(asset, key, value.strip() if isinstance(value, str) else value)
    if not asset.name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Asset name is required")
    if not asset.asset_type:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Asset type is required")
    db.commit()
    db.refresh(asset)
    return ApiResponse(success=True, data=_asset_row(asset)).model_dump(by_alias=True)


@router.delete("/assets/{asset_id}")
async def delete_asset(asset_id: str, user: AppUser = Depends(_current_user), db: Session = Depends(get_db)):
    asset = db.scalar(select(Asset).where(Asset.id == asset_id, Asset.user_id == user.id))
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")
    db.delete(asset)
    db.commit()
    return ApiResponse(success=True).model_dump(by_alias=True)


@router.get("/watchlists")
async def get_watchlists(user: AppUser = Depends(_current_user), db: Session = Depends(get_db)):
    watchlists = db.scalars(
        select(Watchlist)
        .where(Watchlist.user_id == user.id)
        .order_by(Watchlist.is_default.desc(), Watchlist.created_at.asc())
    ).all()
    return ApiResponse(success=True, data=[_watchlist_row(watchlist) for watchlist in watchlists]).model_dump(
        by_alias=True
    )


@router.post("/watchlists", status_code=status.HTTP_201_CREATED)
async def create_watchlist(
    payload: WatchlistCreate,
    user: AppUser = Depends(_current_user),
    db: Session = Depends(get_db),
):
    if payload.is_default:
        db.query(Watchlist).filter(Watchlist.user_id == user.id).update({"is_default": False})
    watchlist = Watchlist(
        user_id=user.id,
        name=payload.name.strip(),
        description=payload.description.strip() if payload.description else None,
        is_default=payload.is_default,
    )
    db.add(watchlist)
    db.commit()
    db.refresh(watchlist)
    return ApiResponse(success=True, data=_watchlist_row(watchlist)).model_dump(by_alias=True)


@router.patch("/watchlists/{watchlist_id}")
async def update_watchlist(
    watchlist_id: str,
    payload: WatchlistUpdate,
    user: AppUser = Depends(_current_user),
    db: Session = Depends(get_db),
):
    watchlist = _ensure_watchlist(db, user.id, watchlist_id)
    updates = payload.model_dump(exclude_unset=True)
    if updates.get("is_default"):
        db.query(Watchlist).filter(Watchlist.user_id == user.id, Watchlist.id != watchlist_id).update(
            {"is_default": False}
        )
    for key, value in updates.items():
        setattr(watchlist, key, value.strip() if isinstance(value, str) else value)
    db.commit()
    db.refresh(watchlist)
    return ApiResponse(success=True, data=_watchlist_row(watchlist)).model_dump(by_alias=True)


@router.delete("/watchlists/{watchlist_id}")
async def delete_watchlist(
    watchlist_id: str,
    user: AppUser = Depends(_current_user),
    db: Session = Depends(get_db),
):
    db.delete(_ensure_watchlist(db, user.id, watchlist_id))
    db.commit()
    return ApiResponse(success=True).model_dump(by_alias=True)


@router.get("/watchlists/{watchlist_id}/items")
async def get_watchlist_items(
    watchlist_id: str,
    user: AppUser = Depends(_current_user),
    db: Session = Depends(get_db),
):
    _ensure_watchlist(db, user.id, watchlist_id)
    items = db.scalars(
        select(WatchlistItem)
        .where(WatchlistItem.watchlist_id == watchlist_id)
        .order_by(WatchlistItem.added_date.asc())
    ).all()
    return ApiResponse(success=True, data=[_watchlist_item_row(item) for item in items]).model_dump(by_alias=True)


@router.post("/watchlists/{watchlist_id}/items", status_code=status.HTTP_201_CREATED)
async def create_watchlist_item(
    watchlist_id: str,
    payload: WatchlistItemCreate,
    user: AppUser = Depends(_current_user),
    db: Session = Depends(get_db),
):
    _ensure_watchlist(db, user.id, watchlist_id)
    item = WatchlistItem(
        watchlist_id=watchlist_id,
        symbol=payload.symbol.strip().upper(),
        notes=payload.notes.strip() if payload.notes else None,
    )
    db.add(item)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
    return ApiResponse(success=True).model_dump(by_alias=True)


@router.delete("/watchlists/{watchlist_id}/items/{symbol}")
async def delete_watchlist_item(
    symbol: str,
    watchlist_id: str,
    user: AppUser = Depends(_current_user),
    db: Session = Depends(get_db),
):
    _ensure_watchlist(db, user.id, watchlist_id)
    item = db.scalar(
        select(WatchlistItem).where(
            WatchlistItem.watchlist_id == watchlist_id,
            WatchlistItem.symbol == symbol.strip().upper(),
        )
    )
    if item:
        db.delete(item)
        db.commit()
    return ApiResponse(success=True).model_dump(by_alias=True)
