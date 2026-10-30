from fastapi import FastAPI,Depends,HTTPException
from jose import jwt,JWTError 
from fastapi.security import OAuth2,OAuth2PasswordBearer
from datetime import datetime, timedelta, timezone 
from sqlalchemy.orm import Session 

from fastapi import APIRouter 

from dotenv import load_dotenv 
import os 

from pydantic import BaseModel, Field
from connection import get_db
from database import users 
from schema import RegisterUser, LoginUser
from pwdlib import PasswordHash 

password_hash = PasswordHash.recommended()

router=APIRouter()


load_dotenv()

SECRET_KEY=os.getenv("SECRET_KEY")
ALGORITHM="HS256"


def create_token(username:str):
    payload={
        "sub":username,
        "type":"access",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=15)
    }

    return jwt.encode(payload,SECRET_KEY,algorithm=ALGORITHM)

def refresh_token(username:str):
    payload={
        "sub":username,
        "type":"refresh",
        "exp":datetime.now(timezone.utc) + timedelta(days=7)
    } 

    return jwt.encode(payload,SECRET_KEY,algorithm=ALGORITHM)


def verify_token(token: str, expected_type: str):
    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        if payload.get("type") != expected_type:
            return None

        if not payload.get("sub"):
            return None

        return payload

    except JWTError:
        return None 





@router.post("/register", status_code=201)
def register(data: RegisterUser, db: Session = Depends(get_db)):

  
    existing_user = db.query(users).filter(
        users.username == data.username
    ).first()

    if existing_user:
        raise HTTPException(
            status_code=409,
            detail="Username already exists"
        )


    existing_mobile = db.query(users).filter(
        users.mobile_number == data.mobile_number
    ).first()

    if existing_mobile:
        raise HTTPException(
            status_code=409,
            detail="Mobile number already registered"
        )

  
    new_user = users(
        username=data.username,
        mobile_number=data.mobile_number,
        password_hash=password_hash.hash(data.password)
    )

    try:
        db.add(new_user)
        db.commit()
        db.refresh(new_user)

    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Registration failed"
        )

    return {
        "message": "Registration successful",
        "username": new_user.username
    }  


@router.post("/login")
def login(data: LoginUser, db: Session = Depends(get_db)):

    # Find user in MySQL
    user = db.query(users).filter(
        users.username == data.username
    ).first()

    # Verify password
    if not user or not password_hash.verify(
        data.password, user.password_hash
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password"
        )

    # Generate JWT tokens
    access_token = create_token(user.username)
    refresh = refresh_token(user.username)

    return {
        "message": "Login successful",
        "access_token": access_token,
        "refresh_token": refresh,
        "token_type": "bearer"
    }



