# Imports
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import jwt, JWTError
from passlib.context import CryptContext


# Password hashing configuration (bcrypt)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)

# JWT configuration (token signing)
SECRET_KEY = "CHANGE_ME_TO_A_LONG_RANDOM_SECRET"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

# Creates a signed JWT access token + adds an expiry so tokens expire automatically
def create_access_token(
    data: Dict[str, Any],
    expires_minutes: int = ACCESS_TOKEN_EXPIRE_MINUTES
) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=expires_minutes)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

# FastAPI security scheme 
bearer_scheme = HTTPBearer()

def get_current_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> Dict[str, Any]:
    """
    Reads: Authorization: Bearer <token>
    Returns: {id, username, role}
    """
    # Rejects missing / invalid auth header
    if creds is None or creds.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    token = creds.credentials
    try:
        # decoding + verifying token signature + expiry
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        
        # Extract user details from token payload
        user_id = payload.get("sub")
        username = payload.get("username")
        role = payload.get("role")

        # Validate required fields exist
        if user_id is None or role is None:
            raise HTTPException(status_code=401, detail="Invalid token payload")

        # Return a simple user dict used by route dependencies
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

# Role-based access control dependecy
def require_role(required_role: str):
    """
    Usage:
        user = Depends(require_role("admin"))
    """
    def _checker(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
        if user.get("role") != required_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden",
            )
        return user

    return _checker
