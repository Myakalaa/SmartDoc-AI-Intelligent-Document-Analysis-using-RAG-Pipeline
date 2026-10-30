import os
import json
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
MODEL_NAME = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")


# ── Document Analysis (original) ──────────────────────────────────────────────

def analyze_document(text: str) -> dict:
    """
    Sends raw document text to Gemini and returns structured data:
    {
        "summary": "...",
        "key_points": ["...", "..."],
        "entities": {"names": [...], "dates": [...], "amounts": [...]},
        "document_type": "...",
        "sentiment": "..."
    }
    """
    model = genai.GenerativeModel(MODEL_NAME)

    prompt = f"""
You are an expert document analyst. Analyze the following document text and return
ONLY a valid JSON object (no markdown, no extra text) with these exact keys:

{{
  "summary": "A concise 2-3 sentence summary of the document",
  "key_points": ["key point 1", "key point 2", "key point 3"],
  "entities": {{
    "names":   ["person or org name", ...],
    "dates":   ["date string", ...],
    "amounts": ["monetary or numeric value", ...]
  }},
  "document_type": "e.g. Invoice / Contract / Report / Letter / Resume / Other",
  "sentiment": "Positive / Negative / Neutral"
}}

Document Text:
\"\"\"
{text}
\"\"\"
"""

    response = model.generate_content(prompt)
    raw = response.text.strip()

    # Strip markdown code fences if Gemini wraps the JSON
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    return json.loads(raw)


# ── RAG Answer Generation (new) ───────────────────────────────────────────────

def rag_answer(query: str, context_docs: list[dict]) -> str:
    """
    Given a user question and a list of retrieved document dicts
    (each with 'original_text', 'summary', 'document_type', 'score'),
    ask Gemini to answer using only the provided context.

    Returns: a plain-text answer string.
    """
    model = genai.GenerativeModel(MODEL_NAME)

    # Build the context block from retrieved docs
    context_block = ""
    for i, doc in enumerate(context_docs, 1):
        context_block += f"""
--- Document {i} (type: {doc.get('document_type','?')}, similarity: {doc.get('score','?')}) ---
{doc.get('original_text', doc.get('summary', ''))}
"""

    prompt = f"""
You are a helpful assistant. Use ONLY the documents provided below to answer
the user's question. If the answer cannot be found in the documents, say
"I could not find relevant information in the uploaded documents."

=== Retrieved Documents ===
{context_block}
===========================

User Question: {query}

Answer:"""

    response = model.generate_content(prompt)
    return response.text.strip()
