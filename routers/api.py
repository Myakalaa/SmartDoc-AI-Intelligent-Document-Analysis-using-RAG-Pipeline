from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from jose import jwt, JWTError
from fastapi.security import OAuth2PasswordBearer
import io
import os

from connection import get_db
from database import Documents
from schema import DocumentIn, DocumentOut, RAGQuery, RAGResponse, RAGSource
from llm_service import analyze_document, rag_answer
from embeddings import get_embedding, get_query_embedding
from faiss_store import faiss_store

router = APIRouter(prefix="/documents", tags=["Documents"])

# ── JWT guard ─────────────────────────────────────────────────────────────────
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/login")
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM  = "HS256"


def get_current_user(token: str = Depends(oauth2_scheme)) -> str:
    """Decode the JWT and return the username, or raise 401."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if not username or payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token")
        return username
    except JWTError:
        raise HTTPException(status_code=401, detail="Token expired or invalid")


# ── POST /documents  — analyze, embed & save ──────────────────────────────────
@router.post("/", response_model=DocumentOut, status_code=201)
def analyze_and_save(
    body: DocumentIn,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    """
    Full pipeline:
    1. Validate input
    2. LLM analysis via Gemini  → summary, key_points, entities, sentiment, type
    3. Generate embedding via text-embedding-004
    4. Save document + embedding to MySQL
    5. Add embedding to FAISS index
    6. Return structured DocumentOut
    """
    doc_text = body.get_text()
    if not doc_text:
        raise HTTPException(status_code=400, detail="Document text cannot be empty")

    # ── Step 2: LLM Analysis ──────────────────────────────────────────────────
    try:
        result = analyze_document(doc_text)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM analysis failed: {str(e)}")

    # ── Step 3: Generate Embedding ────────────────────────────────────────────
    try:
        embedding = get_embedding(doc_text)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Embedding generation failed: {str(e)}")

    # ── Step 4: Save to MySQL ─────────────────────────────────────────────────
    doc = Documents(
        original_text  = doc_text,
        summary        = result.get("summary", ""),
        key_points     = result.get("key_points", []),
        entities       = result.get("entities", {}),
        document_type  = result.get("document_type", ""),
        sentiment      = result.get("sentiment", ""),
        embedding_json = embedding,     # persisted for index rebuilds
    )

    try:
        db.add(doc)
        db.commit()
        db.refresh(doc)
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to save document")

    # ── Step 5: Add to FAISS ──────────────────────────────────────────────────
    faiss_store.add_document(doc.id, embedding)

    return doc


# ── POST /documents/upload — upload file (.pdf, .txt, .md), extract & save ────
@router.post("/upload", response_model=DocumentOut, status_code=201)
async def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    """
    Accepts file uploads (.pdf, .txt, .md, .csv, .json), extracts text,
    runs Gemini analysis + embeddings, and saves to MySQL & FAISS.
    """
    filename = file.filename or "uploaded_file"
    ext = os.path.splitext(filename)[1].lower()
    content = await file.read()

    doc_text = ""
    if ext == ".pdf":
        try:
            from pypdf import PdfReader
            reader = PdfReader(io.BytesIO(content))
            pages_text = [page.extract_text() or "" for page in reader.pages]
            doc_text = "\n".join(pages_text).strip()
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to read PDF: {str(e)}")
    else:
        try:
            doc_text = content.decode("utf-8").strip()
        except UnicodeDecodeError:
            try:
                doc_text = content.decode("latin-1").strip()
            except Exception:
                raise HTTPException(status_code=400, detail="Could not decode text file")

    if not doc_text:
        raise HTTPException(status_code=400, detail="File is empty or contains no extractable text")

    try:
        result = analyze_document(doc_text)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM analysis failed: {str(e)}")

    try:
        embedding = get_embedding(doc_text)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Embedding generation failed: {str(e)}")

    doc = Documents(
        original_text  = doc_text,
        summary        = result.get("summary", ""),
        key_points     = result.get("key_points", []),
        entities       = result.get("entities", {}),
        document_type  = result.get("document_type", ""),
        sentiment      = result.get("sentiment", ""),
        embedding_json = embedding,
    )

    try:
        db.add(doc)
        db.commit()
        db.refresh(doc)
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to save document")

    faiss_store.add_document(doc.id, embedding)
    return doc


# ── POST /documents/query  — RAG question answering ───────────────────────────
@router.post("/query", response_model=RAGResponse)
def query_documents(
    body: RAGQuery,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    """
    RAG Pipeline:
    1. Embed the user's query
    2. Search FAISS for top_k most similar documents
    3. Fetch those documents from MySQL
    4. Send query + retrieved context to Gemini
    5. Return answer + source documents
    """
    if not body.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    if faiss_store.total == 0:
        raise HTTPException(
            status_code=404,
            detail="No documents indexed yet. Upload documents first."
        )

    # ── Step 1: Embed query ───────────────────────────────────────────────────
    try:
        q_embedding = get_query_embedding(body.query)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Query embedding failed: {str(e)}")

    # ── Step 2: FAISS similarity search ──────────────────────────────────────
    hits = faiss_store.search(q_embedding, top_k=body.top_k)

    if not hits:
        return RAGResponse(
            query=body.query,
            answer="No relevant documents found.",
            sources=[]
        )

    # ── Step 3: Fetch docs from MySQL ─────────────────────────────────────────
    doc_ids  = [h["doc_id"] for h in hits if h["doc_id"] != -1]
    score_map = {h["doc_id"]: h["score"] for h in hits}

    db_docs = db.query(Documents).filter(Documents.id.in_(doc_ids)).all()

    if not db_docs:
        return RAGResponse(
            query=body.query,
            answer="Referenced documents no longer exist in the database.",
            sources=[]
        )

    # ── Step 4: Build context list & call Gemini ──────────────────────────────
    context_docs = [
        {
            "original_text": d.original_text,
            "summary":       d.summary,
            "document_type": d.document_type or "Unknown",
            "score":         score_map.get(d.id, 0.0),
        }
        for d in db_docs
    ]

    try:
        answer_text = rag_answer(body.query, context_docs)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"RAG generation failed: {str(e)}")

    # ── Step 5: Build response with sources ───────────────────────────────────
    sources = [
        RAGSource(
            doc_id        = d.id,
            id            = d.id,
            score         = score_map.get(d.id, 0.0),
            document_type = d.document_type or "Unknown",
            summary       = d.summary,
            snippet       = d.summary or (d.original_text[:200] if d.original_text else ""),
        )
        for d in db_docs
    ]

    return RAGResponse(
        query=body.query,
        answer=answer_text,
        sources=sources,
    )


# ── GET /documents  — list all ───────────────────────────────────────────────
@router.get("/", response_model=list[DocumentOut])
def list_documents(
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    """Return all analyzed documents (newest first)."""
    return db.query(Documents).order_by(Documents.created_at.desc()).all()


# ── GET /documents/{id} ───────────────────────────────────────────────────────
@router.get("/{doc_id}", response_model=DocumentOut)
def get_document(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    doc = db.query(Documents).filter(Documents.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


# ── DELETE /documents/{id} ────────────────────────────────────────────────────
@router.delete("/{doc_id}", status_code=204)
def delete_document(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    doc = db.query(Documents).filter(Documents.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    db.delete(doc)
    db.commit()
    faiss_store.remove(doc_id)   # tombstone from FAISS index
