from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from connection import Base, engine, SessionLocal
from routers.auth import router as auth_router
from routers.api  import router as doc_router


def rebuild_faiss_on_startup():
    """
    On server start, load all existing documents from MySQL and
    rebuild the FAISS index so previous uploads are searchable.
    """
    from database import Documents
    from faiss_store import faiss_store

    db = SessionLocal()
    try:
        docs = db.query(Documents).filter(
            Documents.embedding_json.isnot(None)
        ).all()

        if docs:
            pairs = [(d.id, d.embedding_json) for d in docs]
            faiss_store.rebuild_from_db(pairs)
            print(f"[Startup] FAISS index rebuilt with {len(pairs)} documents.")
        else:
            print("[Startup] No existing documents — FAISS index is empty.")
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ───────────────────────────────────────────────────────────────
    Base.metadata.create_all(bind=engine)   # create tables if not exist
    rebuild_faiss_on_startup()
    yield
    # ── Shutdown (nothing needed) ─────────────────────────────────────────────


app = FastAPI(
    title="AI-Powered Document Analysis + RAG API",
    description=(
        "Upload documents → Gemini extracts structure + generates embeddings → "
        "stored in MySQL & FAISS. Ask questions → RAG retrieves relevant docs → "
        "Gemini answers with context."
    ),
    version="3.0.0",
    lifespan=lifespan,
)

# Allow frontend (file:// or localhost) to call the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, tags=["Auth"])
app.include_router(doc_router)


@app.get("/", tags=["Health"])
def home():
    from faiss_store import faiss_store
    return {
        "message": "Document Analysis + RAG API is running ✅",
        "indexed_documents": faiss_store.total,
    }
