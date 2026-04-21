# --------------------------------------------------
# Core imports
# --------------------------------------------------

import os
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import jwt, JWTError
from passlib.context import CryptContext


# --------------------------------------------------
# Password hashing configuration
# --------------------------------------------------

# Uses bcrypt hashing to securely store user passwords
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def password_hashing(password: str) -> str:
    # Hashes a plain-text password before storing it in the database
    return pwd_context.hash(password)


def password_verification(password: str, password_hash: str) -> bool:
    # Verifies a login password against the stored bcrypt hash
    return pwd_context.verify(password, password_hash)


# JWT configuration
# Stores the signing key and token settings used for authentication
SECRET_KEY = os.getenv("CARDIOX_SECRET_KEY", "dev-only-secret-change-this")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60


def create_access_token(
    data: Dict[str, Any],
    expires_minutes: int = ACCESS_TOKEN_EXPIRE_MINUTES,
) -> str:
    # Creates a signed JWT containing user identity and expiry information
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=expires_minutes)
    to_encode.update({"exp": expire})

    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


# --------------------------------------------------
# FastAPI bearer token security

# Extracts bearer tokens from the Authorization header
bearer_scheme = HTTPBearer()


def get_current_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> Dict[str, Any]:
    """
    Reads: Authorization: Bearer <token>
    Returns: {id, username, role}
    """
    # Rejects missing or invalid authentication headers
    if creds is None or creds.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    token = creds.credentials

    try:
        # Decodes the JWT and validates its signature and expiry
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

        # Extracts the authenticated user information from the token
        user_id = payload.get("sub")
        username = payload.get("username")
        role = payload.get("role")

        # Ensures the token contains the minimum required identity fields
        if user_id is None or role is None:
            raise HTTPException(status_code=401, detail="Invalid token payload")

        # Returns a lightweight user object for route protection and access control
        return {
            "id": int(user_id),
            "username": username,
            "role": role,
        }

    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )


# --------------------------------------------------
# Role-based access control

def require_role(required_role: str):
    """
    Usage:
        user = Depends(require_role("admin"))
    """

    def _checker(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
        # Restricts access to endpoints based on the user's assigned role
        if user.get("role") != required_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden",
            )
        return user

    return _checker