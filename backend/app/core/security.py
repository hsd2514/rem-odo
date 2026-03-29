from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import secrets

from jose import JWTError, jwt

from app.core.config import settings


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    hash_val = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100_000).hex()
    return f"{salt}${hash_val}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        salt, hash_val = hashed_password.split("$", 1)
        computed = hashlib.pbkdf2_hmac("sha256", plain_password.encode(), salt.encode(), 100_000).hex()
        return hmac.compare_digest(computed, hash_val)
    except (ValueError, AttributeError):
        return False


def create_token(subject: str, token_type: str, expires_minutes: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=expires_minutes)
    payload = {"sub": subject, "type": token_type, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise ValueError("Invalid token") from exc
