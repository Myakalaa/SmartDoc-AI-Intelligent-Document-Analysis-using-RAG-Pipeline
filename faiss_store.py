"""
faiss_store.py — Singleton FAISS index manager

Responsibilities:
  • Maintain an in-memory FAISS IndexFlatIP (inner-product / cosine) index
  • Map FAISS internal row positions → MySQL document IDs
  • Persist index + ID map to disk so embeddings survive server restarts
  • Expose: add_document(), search(), remove(), load_from_db()
"""

import os
import json
import numpy as np
import faiss

FAISS_INDEX_PATH  = "faiss_index.bin"      # persisted FAISS index file
FAISS_IDMAP_PATH  = "faiss_idmap.json"     # list mapping row → doc_id
EMBEDDING_DIM     = 3072                   # gemini-embedding-001 dimension


class FaissStore:
    _instance = None   # singleton

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self._initialized = True

        # Inner-product index (works as cosine similarity when vectors are L2-normalised)
        self.index = faiss.IndexFlatIP(EMBEDDING_DIM)

        # List where position i holds the MySQL doc_id stored at FAISS row i
        self.id_map: list[int] = []

        self._load_from_disk()

    # ── Disk persistence ──────────────────────────────────────────────────────

    def _load_from_disk(self):
        """Load index + id_map from disk if they exist."""
        if os.path.exists(FAISS_INDEX_PATH) and os.path.exists(FAISS_IDMAP_PATH):
            self.index = faiss.read_index(FAISS_INDEX_PATH)
            with open(FAISS_IDMAP_PATH, "r") as f:
                self.id_map = json.load(f)
            print(f"[FAISS] Loaded {self.index.ntotal} vectors from disk.")
        else:
            print("[FAISS] No existing index found — starting fresh.")

    def _save_to_disk(self):
        """Persist the current index + id_map to disk."""
        faiss.write_index(self.index, FAISS_INDEX_PATH)
        with open(FAISS_IDMAP_PATH, "w") as f:
            json.dump(self.id_map, f)

    # ── Public API ────────────────────────────────────────────────────────────

    def add_document(self, doc_id: int, embedding: list[float]):
        """
        Add a document embedding to the FAISS index.
        Normalises the vector so inner-product == cosine similarity.
        """
        vec = np.array(embedding, dtype=np.float32).reshape(1, -1)
        faiss.normalize_L2(vec)          # in-place L2 normalisation
        self.index.add(vec)
        self.id_map.append(doc_id)
        self._save_to_disk()
        print(f"[FAISS] Added doc_id={doc_id}. Total vectors: {self.index.ntotal}")

    def search(self, query_embedding: list[float], top_k: int = 3) -> list[dict]:
        """
        Find the top_k most similar documents to a query embedding.
        Returns: [{"doc_id": int, "score": float}, ...]
        """
        if self.index.ntotal == 0:
            return []

        vec = np.array(query_embedding, dtype=np.float32).reshape(1, -1)
        faiss.normalize_L2(vec)

        k = min(top_k, self.index.ntotal)
        scores, indices = self.index.search(vec, k)

        results = []
        for score, idx in zip(scores[0], indices[0]):
            if idx == -1:          # FAISS returns -1 for empty slots
                continue
            results.append({
                "doc_id": self.id_map[idx],
                "score": float(round(score, 4))
            })
        return results

    def remove(self, doc_id: int):
        """
        Mark a document as removed by replacing its id_map entry with -1.
        (FAISS IndexFlatIP does not support true deletion — rebuild index instead.)
        Note: For production use IndexIDMap or rebuild periodically.
        """
        for i, mid in enumerate(self.id_map):
            if mid == doc_id:
                self.id_map[i] = -1   # tombstone
        self._save_to_disk()

    def rebuild_from_db(self, doc_embeddings: list[tuple[int, list[float]]]):
        """
        Rebuild the entire FAISS index from (doc_id, embedding) pairs.
        Called on startup to sync with MySQL if needed.
        """
        self.index = faiss.IndexFlatIP(EMBEDDING_DIM)
        self.id_map = []
        for doc_id, emb in doc_embeddings:
            vec = np.array(emb, dtype=np.float32).reshape(1, -1)
            faiss.normalize_L2(vec)
            self.index.add(vec)
            self.id_map.append(doc_id)
        self._save_to_disk()
        print(f"[FAISS] Rebuilt index with {self.index.ntotal} vectors.")

    @property
    def total(self) -> int:
        return self.index.ntotal


# Global singleton instance
faiss_store = FaissStore()
