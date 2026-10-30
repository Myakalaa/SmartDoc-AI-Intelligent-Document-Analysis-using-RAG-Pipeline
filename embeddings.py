import os
import numpy as np
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

# Use the active Gemini embedding model
EMBEDDING_MODEL = "models/gemini-embedding-001"


def get_embedding(text: str) -> list[float]:
    """Generate normalized embedding vector for document content."""
    result = genai.embed_content(
        model=EMBEDDING_MODEL,
        content=text,
        task_type="retrieval_document"
    )
    return result["embedding"]


def get_query_embedding(query: str) -> list[float]:
    """Generate query embedding optimized for retrieval."""
    result = genai.embed_content(
        model=EMBEDDING_MODEL,
        content=query,
        task_type="retrieval_query"
    )
    return result["embedding"]


def to_numpy(embedding: list[float]) -> np.ndarray:
    """Convert a list of floats to float32 numpy array."""
    return np.array(embedding, dtype=np.float32).reshape(1, -1)
