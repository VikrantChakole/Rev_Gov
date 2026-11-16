"""
JWT Authentication Routes
Separate admin and officer logins, JWT token issuance.
No hardcoded credentials — all loaded from settings/DB.
"""
import logging
import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlalchemy.orm import Session
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings
from app.core.database import get_db
from app.models.db_models import User, Citizen

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])

pwd_ctx = CryptContext(schemes=["sha256_crypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

ALGORITHM = "HS256"


# ── Schemas ──

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    role: str
    username: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    state: Optional[str] = "Maharashtra"
    nationality: Optional[str] = "Indian"
    expires_in: int


class UserInfo(BaseModel):
    username: str
    role: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    state: Optional[str] = "Maharashtra"
    nationality: Optional[str] = "Indian"


class CitizenRegisterRequest(BaseModel):
    identifier: str              # Phone (+91XXXXXXXXXX) or Email (citizen@example.com)
    password: str
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    state: Optional[str] = "Maharashtra"
    nationality: Optional[str] = "Indian"


class CitizenLoginRequest(BaseModel):
    identifier: str              # Phone or Email
    password: str


class CitizenAuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str = "CITIZEN"
    citizen_id: str
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    state: Optional[str] = "Maharashtra"
    nationality: Optional[str] = "Indian"
    expires_in: int


class CitizenProfileResponse(BaseModel):
    citizen_id: str
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    state: Optional[str] = "Maharashtra"
    nationality: Optional[str] = "Indian"
    preferred_language: str = "en"


class CitizenProfileUpdateRequest(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    state: Optional[str] = None
    nationality: Optional[str] = None


# ── Helpers ──

def _verify_password(plain: str, hashed: str) -> bool:
    return pwd_ctx.verify(plain, hashed)


def _hash_password(password: str) -> str:
    return pwd_ctx.hash(password)


def _create_token(data: dict) -> str:
    payload = data.copy()
    expire = datetime.datetime.utcnow() + datetime.timedelta(
        minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload["exp"] = expire
    payload["iat"] = datetime.datetime.utcnow()
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHM)


def _decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Dependency: decode JWT and return the User ORM object."""
    payload = _decode_token(token)
    username: Optional[str] = payload.get("sub")
    if not username:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    user = db.query(User).filter(User.username == username, User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    return user


def get_current_citizen(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    """
    Security dependency: decode JWT token and return authenticated Citizen.
    Throws 401 Unauthorized if invalid or missing token.
    """
    from app.data_layer.repositories.citizen_repo import CitizenRepository
    payload = _decode_token(token)
    citizen_ref: Optional[str] = payload.get("citizen_ref")
    username: Optional[str] = payload.get("sub")

    citizen_repo = CitizenRepository(db)

    citizen = None
    if citizen_ref:
        citizen = citizen_repo.get_by_ref(citizen_ref)
    if not citizen and username:
        citizen = citizen_repo.get_by_identifier(username)

    if not citizen:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authenticated citizen account not found.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return citizen


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in ("ADMIN",):
        raise HTTPException(status_code=403, detail="Admin role required")
    return current_user


def require_officer(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in ("ADMIN", "OFFICER"):
        raise HTTPException(status_code=403, detail="Officer role required")
    return current_user


def require_reviewer(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in ("ADMIN", "REVIEWER"):
        raise HTTPException(status_code=403, detail="Reviewer role required")
    return current_user


def require_approver(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in ("ADMIN", "APPROVER"):
        raise HTTPException(status_code=403, detail="Approver role required")
    return current_user


def require_auditor(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in ("ADMIN", "AUDITOR", "REVIEWER", "OFFICER"):
        raise HTTPException(status_code=403, detail="Auditor role required")
    return current_user


def require_operator(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in ("ADMIN", "OPERATOR"):
        raise HTTPException(status_code=403, detail="Assisted Operator role required")
    return current_user


def require_staff(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in ("ADMIN", "OFFICER", "DESK_CLERK", "DISTRICT_OFFICER", "REVIEWER", "APPROVER", "OPERATOR", "AUDITOR"):
        raise HTTPException(status_code=403, detail="Staff role required")
    return current_user


# ── Endpoints ──

@router.post("/login", response_model=TokenResponse)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """
    Issue JWT token for admin or officer login.
    Accepts username + password (form data).
    """
    user = db.query(User).filter(
        User.username == form_data.username,
        User.is_active == True,
    ).first()

    if not user or not _verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = _create_token({
        "sub": user.username,
        "role": user.role,
        "citizen_ref": user.citizen_ref,
        "state": user.state or "Maharashtra",
        "first_name": user.first_name,
        "last_name": user.last_name,
    })
    expire_seconds = settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60

    logger.info(f"Login: {user.username} ({user.role})")

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        role=user.role,
        username=user.username,
        first_name=user.first_name,
        last_name=user.last_name,
        state=user.state or "Maharashtra",
        nationality=user.nationality or "Indian",
        expires_in=expire_seconds,
    )


# ── CITIZEN AUTHENTICATION ENDPOINTS ──

@router.post("/citizen/register", response_model=CitizenAuthResponse)
def register_citizen(
    body: CitizenRegisterRequest,
    db: Session = Depends(get_db),
):
    """
    Register a new citizen account using Email or Phone.
    Allocates a unique permanent citizen_id (CIT-001).
    Links ChannelIdentity for omnichannel recognition across Web, WhatsApp, IVR.
    """
    import re
    from app.data_layer.repositories.citizen_repo import CitizenRepository
    from app.data_layer.repositories.channel_identity_repo import ChannelIdentityRepository

    # 1. Validate Full Name (At least 2 name parts required: First Name and Last Name)
    name_str = (body.name or "").strip()
    name_parts = [p for p in name_str.split() if p]
    if len(name_parts) < 2:
        raise HTTPException(
            status_code=400,
            detail="Please enter your complete Full Name including First Name and Last Name (e.g. Rajesh Sharma).",
        )

    # 2. Validate Password (at least 10 characters)
    if not body.password or len(body.password) < 10:
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 10 characters long.",
        )

    # 3. Validate Phone Number (10 digits) or Email
    raw_identifier = body.identifier.strip()
    if not raw_identifier:
        raise HTTPException(status_code=400, detail="Mobile number (10 digits) or Email is required.")

    email_val = body.email.strip().lower() if body.email else None
    phone_val = body.phone.strip() if body.phone else None

    if "@" in raw_identifier:
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", raw_identifier):
            raise HTTPException(status_code=400, detail="Please enter a valid email address (e.g. citizen@example.com).")
        email_val = raw_identifier.lower()
        identifier = email_val
    else:
        cleaned_phone = re.sub(r"\D", "", raw_identifier)
        if cleaned_phone.startswith("91") and len(cleaned_phone) == 12:
            cleaned_phone = cleaned_phone[2:]
        elif cleaned_phone.startswith("0") and len(cleaned_phone) == 11:
            cleaned_phone = cleaned_phone[1:]

        if len(cleaned_phone) != 10:
            raise HTTPException(
                status_code=400,
                detail="Mobile number must be exactly 10 digits (e.g. 9876543210).",
            )

        phone_val = f"+91{cleaned_phone}"
        identifier = phone_val

    # Check if user/citizen already exists
    existing = db.query(User).filter(
        (User.username == identifier) |
        (User.username == raw_identifier) |
        (User.username == (phone_val or "")) |
        (User.username == (email_val or ""))
    ).first()

    if not existing and phone_val:
        existing = db.query(Citizen).filter(Citizen.phone == phone_val).first()

    if not existing and email_val:
        existing = db.query(Citizen).filter(Citizen.email == email_val).first()

    if existing:
        raise HTTPException(status_code=400, detail="An account with this Email or Phone number already exists. Please sign in.")

    citizen_repo = CitizenRepository(db)
    channel_repo = ChannelIdentityRepository(db)

    # Extract first and last name
    first_name = name_parts[0] if name_parts else None
    last_name = " ".join(name_parts[1:]) if len(name_parts) > 1 else None
    user_state = (body.state or "Maharashtra").strip()
    user_nat = (body.nationality or "Indian").strip()

    # Create Citizen record with permanent citizen_id
    citizen = citizen_repo.create(
        name=body.name or "Citizen User",
        phone=phone_val,
        email=email_val,
        address=body.address,
        state=user_state,
        nationality=user_nat,
    )

    # Create User authentication record
    hashed_pw = _hash_password(body.password)
    user = User(
        username=identifier,
        hashed_password=hashed_pw,
        role="CITIZEN",
        citizen_ref=citizen.citizen_ref,
        first_name=first_name,
        last_name=last_name,
        phone=phone_val,
        state=user_state,
        nationality=user_nat,
        is_active=True,
    )
    db.add(user)
    db.commit()

    # Link ChannelIdentities for Web, WhatsApp, IVR
    if phone_val:
        channel_repo.create(
            citizen_ref=citizen.citizen_ref,
            channel="WHATSAPP",
            identifier=phone_val,
            identifier_type="WHATSAPP_NUMBER",
            verified=True,
        )
        channel_repo.create(
            citizen_ref=citizen.citizen_ref,
            channel="IVR",
            identifier=phone_val,
            identifier_type="PHONE",
            verified=True,
        )
    if email_val:
        channel_repo.create(
            citizen_ref=citizen.citizen_ref,
            channel="EMAIL",
            identifier=email_val,
            identifier_type="EMAIL",
            verified=True,
        )

    token = _create_token({
        "sub": user.username,
        "role": "CITIZEN",
        "citizen_ref": citizen.citizen_ref,
    })

    logger.info(f"Citizen Registered: {citizen.citizen_ref} ({user.username})")

    return CitizenAuthResponse(
        access_token=token,
        token_type="bearer",
        role="CITIZEN",
        citizen_id=citizen.citizen_ref,
        name=citizen.name,
        email=citizen.email,
        phone=citizen.phone,
        state=getattr(citizen, "state", None) or user.state or "Maharashtra",
        nationality=getattr(citizen, "nationality", None) or user.nationality or "Indian",
        expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/citizen/login", response_model=CitizenAuthResponse)
def login_citizen(
    body: CitizenLoginRequest,
    db: Session = Depends(get_db),
):
    """
    Authenticate citizen account via Email or Phone + password.
    Returns persistent citizen_id (CIT-001) and JWT bearer access token.
    """
    from app.data_layer.repositories.citizen_repo import CitizenRepository

    import re
    identifier = body.identifier.strip().lower()
    alt_identifier = None
    cleaned = re.sub(r"\D", "", identifier)
    if cleaned.startswith("91") and len(cleaned) == 12:
        alt_identifier = cleaned[2:]
    elif len(cleaned) == 10:
        alt_identifier = f"+91{cleaned}"

    if alt_identifier:
        user = db.query(User).filter(
            (User.username == identifier) | (User.username == alt_identifier),
            User.is_active == True
        ).first()
    else:
        user = db.query(User).filter(User.username == identifier, User.is_active == True).first()

    if not user or not _verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Email/Phone or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    citizen_repo = CitizenRepository(db)
    citizen = None
    if user.citizen_ref:
        citizen = citizen_repo.get_by_ref(user.citizen_ref)
    if not citizen:
        citizen = citizen_repo.resolve_or_create(identifier=identifier, name=user.username)
        user.citizen_ref = citizen.citizen_ref
        db.commit()

    token = _create_token({
        "sub": user.username,
        "role": "CITIZEN",
        "citizen_ref": citizen.citizen_ref,
    })

    logger.info(f"Citizen Login Successful: {citizen.citizen_ref} ({user.username})")

    return CitizenAuthResponse(
        access_token=token,
        token_type="bearer",
        role="CITIZEN",
        citizen_id=citizen.citizen_ref,
        name=citizen.name,
        email=citizen.email,
        phone=citizen.phone,
        state=getattr(citizen, "state", None) or getattr(user, "state", None) or "Maharashtra",
        nationality=getattr(citizen, "nationality", None) or getattr(user, "nationality", None) or "Indian",
        expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.get("/citizen/profile", response_model=CitizenProfileResponse)
def get_citizen_profile(
    current_citizen = Depends(get_current_citizen),
):
    """Get authenticated citizen profile details."""
    return CitizenProfileResponse(
        citizen_id=current_citizen.citizen_ref,
        name=current_citizen.name or "Citizen User",
        phone=current_citizen.phone,
        email=current_citizen.email,
        address=current_citizen.address,
        state=getattr(current_citizen, "state", None) or "Maharashtra",
        nationality=getattr(current_citizen, "nationality", None) or "Indian",
        preferred_language=current_citizen.preferred_language or "en",
    )


@router.patch("/citizen/profile", response_model=CitizenProfileResponse)
def update_citizen_profile(
    body: CitizenProfileUpdateRequest,
    current_citizen = Depends(get_current_citizen),
    db: Session = Depends(get_db),
):
    """Update authenticated citizen profile details."""
    from app.data_layer.repositories.citizen_repo import CitizenRepository
    repo = CitizenRepository(db)
    updated = repo.update_profile(
        citizen_ref=current_citizen.citizen_ref,
        name=body.name,
        phone=body.phone,
        email=body.email,
        address=body.address,
        state=body.state,
        nationality=body.nationality,
    )

    # Synchronize with User record if exists
    user = db.query(User).filter(User.citizen_ref == current_citizen.citizen_ref).first()
    if user:
        if body.state is not None: user.state = body.state
        if body.nationality is not None: user.nationality = body.nationality
        if body.phone is not None: user.phone = body.phone
        if body.name:
            parts = body.name.strip().split()
            if parts:
                user.first_name = parts[0]
                user.last_name = " ".join(parts[1:]) if len(parts) > 1 else ""
        db.commit()

    return CitizenProfileResponse(
        citizen_id=updated.citizen_ref,
        name=updated.name,
        phone=updated.phone,
        email=updated.email,
        address=updated.address,
        state=getattr(updated, "state", None) or "Maharashtra",
        nationality=getattr(updated, "nationality", None) or "Indian",
        preferred_language=updated.preferred_language or "en",
    )


@router.get("/me", response_model=UserInfo)
def get_me(current_user: User = Depends(get_current_user)):
    """Return current user info from JWT."""
    return UserInfo(
        username=current_user.username,
        role=current_user.role,
        first_name=current_user.first_name,
        last_name=current_user.last_name,
        state=current_user.state or "Maharashtra",
        nationality=current_user.nationality or "Indian",
    )


@router.post("/logout")
def logout():
    """
    JWT is stateless — logout is handled client-side by deleting the token.
    This endpoint exists for audit trail purposes.
    """
    return {"message": "Logged out. Please delete your token client-side."}


# ── ADMIN USER DIRECTORY ──

class AdminUserItem(BaseModel):
    id: str
    username: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    mobile_number: Optional[str] = None
    state: Optional[str] = "Maharashtra"
    nationality: Optional[str] = "Indian"
    role: str
    is_active: bool = True
    created_at: Optional[str] = None


class AdminUsersListResponse(BaseModel):
    users: list[AdminUserItem]
    total: int
    page: int
    limit: int


@router.get("/admin/users", response_model=AdminUsersListResponse)
def get_all_users_for_admin(
    search: Optional[str] = None,
    role: Optional[str] = None,
    page: int = 1,
    limit: int = 100,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """
    Admin endpoint to view all users available in the application with
    id, first name, last name, mobile number, state, nationality, and role.
    """
    import re
    query = db.query(User)

    if role and role.upper() != "ALL":
        query = query.filter(User.role == role.upper())

    all_users = query.order_by(User.created_at.desc()).all()

    items = []
    for u in all_users:
        c = u.citizen
        f_name = u.first_name or (c.name.split()[0] if c and c.name else u.username)
        l_name = u.last_name or (" ".join(c.name.split()[1:]) if c and c.name and len(c.name.split()) > 1 else "")
        mob = u.phone or (c.phone if c else None) or (u.username if re.match(r"^\+?\d{10,13}$", u.username) else "Not provided")
        user_state = u.state or (c.state if c else None) or "Maharashtra"
        user_nat = u.nationality or (c.nationality if c else None) or "Indian"

        if search:
            s = search.lower().strip()
            haystack = f"{u.id} {u.username} {f_name} {l_name} {mob} {user_state} {user_nat} {u.role}".lower()
            if s not in haystack:
                continue

        items.append(AdminUserItem(
            id=u.id,
            username=u.username,
            first_name=f_name,
            last_name=l_name,
            mobile_number=mob,
            state=user_state,
            nationality=user_nat,
            role=u.role,
            is_active=u.is_active,
            created_at=u.created_at.isoformat() if u.created_at else None,
        ))

    total = len(items)
    start_idx = (page - 1) * limit
    paginated = items[start_idx : start_idx + limit]

    return AdminUsersListResponse(
        users=paginated,
        total=total,
        page=page,
        limit=limit,
    )


class AdminCreateUserRequest(BaseModel):
    role: str  # "DESK_CLERK" | "DISTRICT_OFFICER"
    username: str
    password: str
    first_name: str
    last_name: str
    phone: Optional[str] = None
    state: str = "Maharashtra"
    nationality: str = "Indian"


@router.post("/admin/users", response_model=AdminUserItem)
def create_user_by_admin(
    body: AdminCreateUserRequest,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """
    Onboard a new Service Officer ('Desk Clerk' or 'District Officer')
    with their assigned State and Nationality='Indian'.
    """
    role = body.role.strip().upper()
    allowed_roles = {"DESK_CLERK", "DISTRICT_OFFICER", "OFFICER"}
    if role not in allowed_roles:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid role '{body.role}'. Allowed roles for onboarding: {', '.join(allowed_roles)}"
        )

    username = body.username.strip().lower()
    if not username:
        raise HTTPException(status_code=400, detail="Username is required.")

    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters long.")

    existing = db.query(User).filter(User.username == username).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Username '{username}' already exists. Please choose a different username.")

    phone_clean = body.phone.strip() if body.phone else None
    user_state = (body.state or "Maharashtra").strip()
    user_nat = (body.nationality or "Indian").strip()

    hashed_pw = _hash_password(body.password)
    new_user = User(
        username=username,
        hashed_password=hashed_pw,
        role=role,
        first_name=body.first_name.strip(),
        last_name=body.last_name.strip(),
        phone=phone_clean,
        state=user_state,
        nationality=user_nat,
        is_active=True,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    logger.info(f"Admin onboarded new user: {new_user.username} ({new_user.role}) for state: {new_user.state}")

    return AdminUserItem(
        id=new_user.id,
        username=new_user.username,
        first_name=new_user.first_name,
        last_name=new_user.last_name,
        mobile_number=new_user.phone or "Not provided",
        state=new_user.state or "Maharashtra",
        nationality=new_user.nationality or "Indian",
        role=new_user.role,
        is_active=new_user.is_active,
        created_at=new_user.created_at.isoformat() if new_user.created_at else None,
    )


