from pydantic import BaseModel
from datetime import datetime
from typing import Optional


# ── Auth schemas ──────────────────────────────────────────────────────────────

class RegisterUser(BaseModel):
    """Schema for user registration request body."""
    username: str
    mobile_number: Optional[str] = None
    password: str


class LoginUser(BaseModel):
    """Schema for user login request body."""
    username: str
    password: str


class UserOut(BaseModel):
    """Schema for returning user info (never expose password_hash)."""
    id: int
    username: str
    mobile_number: Optional[str]
    role: str
    created_at: datetime

    class Config:
        from_attributes = True   # Pydantic v2 (replaces orm_mode)


# ── Token schemas ─────────────────────────────────────────────────────────────

class TokenResponse(BaseModel):
    message: str
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


# ── Document schemas ──────────────────────────────────────────────────────────

class DocumentIn(BaseModel):
    """Request body for document analysis endpoint."""
    text: Optional[str] = None
    content: Optional[str] = None

    def get_text(self) -> str:
        return (self.text or self.content or "").strip()


class EntityOut(BaseModel):
    names: list[str] = []
    dates: list[str] = []
    amounts: list[str] = []


class DocumentOut(BaseModel):
    """Response schema after LLM analysis + DB save."""
    id: int
    original_text: str
    content: Optional[str] = None
    summary: str
    key_points: list[str]
    entities: dict = {}
    document_type: str = ""
    sentiment: str = ""
    created_at: datetime

    class Config:
        from_attributes = True


# ── RAG schemas ───────────────────────────────────────────────────────────────

class RAGQuery(BaseModel):
    """Request body for asking a question over uploaded documents."""
    query: str
    top_k: int = 3            # number of documents to retrieve from FAISS


class RAGSource(BaseModel):
    """One retrieved document shown as a source in the RAG response."""
    doc_id: int
    id: Optional[int] = None
    score: float
    document_type: str
    summary: str
    snippet: Optional[str] = None


class RAGResponse(BaseModel):
    """Response from the RAG /query endpoint."""
    query: str
    answer: str
    sources: list[RAGSource]
