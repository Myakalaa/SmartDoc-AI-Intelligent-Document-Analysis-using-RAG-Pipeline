SmartDoc AI is a Retrieval-Augmented Generation (RAG) based document 
analysis system. Users can upload PDF or text documents, which are 
automatically chunked and stored as vector embeddings using FAISS. 
When a user asks a question, the system retrieves the most relevant 
document sections and generates an accurate answer using a Large 
Language Model (Gemini). The backend is built with FastAPI and the 
frontend uses React with Vite. Authentication is handled via JWT tokens.
