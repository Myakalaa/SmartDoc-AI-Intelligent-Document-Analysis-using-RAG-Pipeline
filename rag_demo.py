"""
rag_demo.py — Minimal, standalone Gemini LLM + RAG implementation in Python
Demonstrates:
  1. Text Embeddings with Gemini text-embedding-004
  2. Vector Similarity Search (Cosine similarity)
  3. Context Augmentation & Grounded Generation with Gemini 2.0 Flash
"""

import os
import numpy as np
import google.generativeai as genai
from dotenv import load_dotenv

# 1. Authenticate with Gemini API
load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    raise ValueError("GEMINI_API_KEY not found in .env file!")
genai.configure(api_key=api_key)

# 2. Knowledge Base (Raw documents)
documents = [
    "Doc 1: Enterprise Server X900 comes with a 3-year full on-site hardware warranty.",
    "Doc 2: Office headquarters is located at 450 Silicon Avenue, San Francisco, CA.",
    "Doc 3: Leave policy: Full-time employees are entitled to 20 days paid annual leave."
]

def get_embedding(text: str, task: str = "retrieval_document") -> np.ndarray:
    """Generate normalized embedding vector using Gemini"""
    res = genai.embed_content(
        model="models/gemini-embedding-001",
        content=text,
        task_type=task
    )
    vec = np.array(res["embedding"], dtype=np.float32)
    norm = np.linalg.norm(vec)
    return vec / norm if norm > 0 else vec

# 3. Embed Knowledge Base
print("--> Generating vector embeddings for documents...")
doc_vectors = np.array([get_embedding(doc, "retrieval_document") for doc in documents])

# 4. User Query
query = "What is the warranty period for the server hardware?"
print(f"--> User Query: '{query}'")

# Embed the query
query_vector = get_embedding(query, "retrieval_query")

# 5. Vector Search (Cosine Similarity = Dot product of unit vectors)
similarity_scores = np.dot(doc_vectors, query_vector)
best_doc_idx = int(np.argmax(similarity_scores))
best_doc = documents[best_doc_idx]
best_score = float(similarity_scores[best_doc_idx])

print(f"--> Retrieved Best Match (Similarity: {best_score:.4f}):\n    '{best_doc}'")

# 6. Augmented Generation: Pass retrieved document into Gemini 2.0 Flash
prompt = f"""You are a helpful AI assistant. Answer the user's question using ONLY the retrieved context below.

Context:
{best_doc}

Question:
{query}

Answer:"""

print("\n--> Sending retrieved context + question to Gemini...")
model = genai.GenerativeModel("models/gemini-2.5-flash")
response = model.generate_content(prompt)

print("\n=================== GEMINI RAG ANSWER ===================")
print(response.text.strip())
print("=========================================================")
