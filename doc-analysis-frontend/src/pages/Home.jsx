import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'

export default function Home() {
  const navigate = useNavigate()
  const username = localStorage.getItem('username') || 'User'
  const fileInputRef = useRef(null)

  // State
  const [docContent, setDocContent] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [latestAnalysis, setLatestAnalysis] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')

  // MySQL documents state
  const [documents, setDocuments] = useState([])
  const [loadingDocs, setLoadingDocs] = useState(false)
  const [selectedDoc, setSelectedDoc] = useState(null)

  // RAG state
  const [ragQuery, setRagQuery] = useState('')
  const [ragLoading, setRagLoading] = useState(false)
  const [ragResult, setRagResult] = useState(null)
  const [ragError, setRagError] = useState('')

  // Fetch documents from MySQL
  const fetchDocuments = async () => {
    setLoadingDocs(true)
    try {
      const res = await api.get('/documents')
      setDocuments(res.data)
    } catch (err) {
      console.error('Error fetching documents:', err)
    } finally {
      setLoadingDocs(false)
    }
  }

  useEffect(() => {
    fetchDocuments()
  }, [])

  // Handle Logout
  const handleLogout = () => {
    localStorage.clear()
    navigate('/login')
  }

  // Handle File Selection
  const onFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSelectedFile(file)
    setErrorMsg('')

    // If it's a text/markdown file, read into textarea for preview
    if (file.type.startsWith('text/') || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
      const reader = new FileReader()
      reader.onload = (event) => {
        if (event.target?.result) {
          setDocContent(event.target.result)
        }
      }
      reader.readAsText(file)
    }
  }

  const clearFile = () => {
    setSelectedFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Handle Document Analysis (via file upload or text)
  const handleAnalyze = async (e) => {
    e.preventDefault()
    if (!selectedFile && !docContent.trim()) return

    setAnalyzing(true)
    setErrorMsg('')
    try {
      let res
      if (selectedFile) {
        // Multipart file upload (.pdf, .txt, .md, etc.)
        const formData = new FormData()
        formData.append('file', selectedFile)
        res = await api.post('/documents/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      } else {
        // Raw text upload
        res = await api.post('/documents', { text: docContent, content: docContent })
      }

      setLatestAnalysis(res.data)
      setDocContent('')
      clearFile()
      fetchDocuments() // Refresh MySQL document list
    } catch (err) {
      console.error(err)
      setErrorMsg(
        err.response?.data?.detail || 'Failed to analyze document. Ensure backend & Gemini API key are active.'
      )
    } finally {
      setAnalyzing(false)
    }
  }

  // Handle Delete Document
  const handleDelete = async (id) => {
    if (!window.confirm(`Delete document #${id} from MySQL and FAISS index?`)) return
    try {
      await api.delete(`/documents/${id}`)
      setDocuments(documents.filter((doc) => doc.id !== id))
      if (selectedDoc?.id === id) setSelectedDoc(null)
      if (latestAnalysis?.id === id) setLatestAnalysis(null)
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to delete document')
    }
  }

  // Handle RAG Query
  const handleRAGSearch = async (e) => {
    e.preventDefault()
    if (!ragQuery.trim()) return

    setRagLoading(true)
    setRagError('')
    setRagResult(null)

    try {
      const res = await api.post('/documents/query', { query: ragQuery, top_k: 3 })
      setRagResult(res.data)
    } catch (err) {
      console.error(err)
      setRagError(err.response?.data?.detail || 'RAG search failed. Ensure documents are indexed.')
    } finally {
      setRagLoading(false)
    }
  }

  const getSentimentBadge = (sentiment) => {
    const s = (sentiment || '').toLowerCase()
    if (s.includes('pos')) return <span className="badge badge-green">● Positive</span>
    if (s.includes('neg')) return <span className="badge badge-rose">● Negative</span>
    return <span className="badge badge-amber">● Neutral</span>
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Navbar */}
      <header
        style={{
          borderBottom: '1px solid var(--border-color)',
          background: 'rgba(10, 11, 20, 0.8)',
          backdropFilter: 'blur(12px)',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          padding: '16px 32px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '1.8rem' }}>🧠</span>
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
              DocAnalysis <span style={{ color: '#8b5cf6' }}>AI</span>
            </h1>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Document Intelligence • Structured Extraction • RAG
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(255, 255, 255, 0.05)',
              padding: '6px 14px',
              borderRadius: '9999px',
              border: '1px solid var(--border-color)',
              fontSize: '0.85rem',
            }}
          >
            <span>👤</span>
            <span style={{ fontWeight: 600 }}>{username}</span>
          </div>

          <button onClick={handleLogout} className="btn-secondary" style={{ padding: '8px 16px' }}>
            Logout
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ maxWidth: '1280px', width: '100%', margin: '0 auto', padding: '32px 24px', flex: 1 }}>
        {/* Quick Stats Grid */}
        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '16px',
            marginBottom: '32px',
          }}
        >
          <div className="glass-panel" style={{ padding: '20px' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              TOTAL DOCUMENTS
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '6px', color: '#c4b5fd' }}>
              {documents.length}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Synced with MySQL database
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '20px' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              FAISS VECTOR INDEX
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '6px', color: '#6ee7b7' }}>
              {documents.length}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Cosine similarity • 768-dim embeddings
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '20px' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              AI INFERENCE ENGINE
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '10px', color: '#93c5fd' }}>
              Gemini 2.0 Flash
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>
              Structured JSON extraction & RAG answering
            </div>
          </div>
        </section>

        {/* Two-Column Grid: Document Analyzer on Left, RAG on Right */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
          {/* Analyze Document Section */}
          <section className="glass-panel" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '6px' }}>
              📄 Analyze & Structure Document
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Upload a file (.pdf, .txt, .md) or paste text below. Gemini extracts summary, entities, sentiment, and saves embeddings into MySQL & FAISS.
            </p>

            {errorMsg && (
              <div
                style={{
                  background: 'rgba(244, 63, 94, 0.15)',
                  border: '1px solid rgba(244, 63, 94, 0.3)',
                  color: '#fda4af',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  fontSize: '0.85rem',
                  marginBottom: '16px',
                }}
              >
                ⚠️ {errorMsg}
              </div>
            )}

            <form onSubmit={handleAnalyze}>
              {/* File Upload Zone */}
              <div style={{ marginBottom: '16px' }}>
                <label
                  htmlFor="file-upload"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    padding: '16px',
                    borderRadius: '10px',
                    border: '2px dashed rgba(139, 92, 246, 0.5)',
                    background: 'rgba(139, 92, 246, 0.08)',
                    color: '#c4b5fd',
                    cursor: 'pointer',
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    transition: 'all 0.2s',
                    textAlign: 'center',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#a78bfa')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.5)')}
                >
                  <span style={{ fontSize: '1.2rem' }}>📎</span>
                  <span>{selectedFile ? `Selected: ${selectedFile.name}` : 'Click to Upload Document (.pdf, .txt, .md, .csv)'}</span>
                </label>
                <input
                  id="file-upload"
                  type="file"
                  ref={fileInputRef}
                  accept=".pdf,.txt,.md,.json,.csv"
                  style={{ display: 'none' }}
                  onChange={onFileChange}
                />
                {selectedFile && (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginTop: '8px',
                      padding: '6px 12px',
                      background: 'rgba(255, 255, 255, 0.04)',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      color: '#a78bfa',
                    }}
                  >
                    <span>📄 <strong>{selectedFile.name}</strong> ({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                    <button
                      type="button"
                      onClick={clearFile}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#fda4af',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                      }}
                    >
                      ✕ Remove
                    </button>
                  </div>
                )}
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  margin: '12px 0',
                  color: 'var(--text-muted)',
                  fontSize: '0.72rem',
                  letterSpacing: '0.05em',
                }}
              >
                <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }}></div>
                <span style={{ padding: '0 10px', textTransform: 'uppercase' }}>Or paste text directly</span>
                <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }}></div>
              </div>

              <textarea
                className="glass-input"
                rows={5}
                placeholder="Or paste contract, invoice, resume, report, or any document text here..."
                value={docContent}
                onChange={(e) => setDocContent(e.target.value)}
                style={{ resize: 'vertical', fontSize: '0.9rem', marginBottom: '16px' }}
              />

              <button
                type="submit"
                className="btn-primary"
                disabled={analyzing || (!selectedFile && !docContent.trim())}
                style={{ width: '100%', padding: '12px' }}
              >
                {analyzing
                  ? 'Extracting & Indexing...'
                  : selectedFile
                  ? `🚀 Analyze & Save ${selectedFile.name}`
                  : '✨ Analyze & Save Document'}
              </button>
            </form>
          </section>

          {/* RAG Query Section */}
          <section className="glass-panel" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '6px' }}>
              🔍 RAG Knowledge Retrieval
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Ask questions across all indexed documents. Semantic search retrieves context, and Gemini synthesizes an answer.
            </p>

            {ragError && (
              <div
                style={{
                  background: 'rgba(244, 63, 94, 0.15)',
                  border: '1px solid rgba(244, 63, 94, 0.3)',
                  color: '#fda4af',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  fontSize: '0.85rem',
                  marginBottom: '16px',
                }}
              >
                ⚠️ {ragError}
              </div>
            )}

            <form onSubmit={handleRAGSearch} style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
              <input
                type="text"
                className="glass-input"
                placeholder="e.g. What were the key terms mentioned in recent reports?"
                value={ragQuery}
                onChange={(e) => setRagQuery(e.target.value)}
                style={{ flex: 1 }}
                required
              />
              <button
                type="submit"
                className="btn-primary"
                disabled={ragLoading || !ragQuery.trim()}
                style={{ padding: '10px 20px', whiteSpace: 'nowrap' }}
              >
                {ragLoading ? 'Searching...' : 'Ask AI'}
              </button>
            </form>

            {/* RAG Answer Display */}
            {ragResult ? (
              <div
                className="animate-fade-in"
                style={{
                  background: 'rgba(15, 17, 34, 0.85)',
                  border: '1px solid rgba(139, 92, 246, 0.3)',
                  borderRadius: '12px',
                  padding: '16px',
                }}
              >
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#a78bfa', marginBottom: '8px' }}>
                  💡 SYNTHESIZED ANSWER
                </div>
                <p style={{ fontSize: '0.92rem', lineHeight: '1.5', marginBottom: '16px', color: '#f8fafc' }}>
                  {ragResult.answer}
                </p>

                {ragResult.sources && ragResult.sources.length > 0 && (
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
                      RETRIEVED CONTEXT SOURCES:
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {ragResult.sources.map((src, i) => (
                        <div
                          key={i}
                          style={{
                            background: 'rgba(255, 255, 255, 0.04)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            padding: '8px 12px',
                            fontSize: '0.78rem',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#c4b5fd', marginBottom: '4px' }}>
                            <span>Doc #{src.doc_id || src.id}</span>
                            <span>Relevance: {(src.score * 100).toFixed(1)}%</span>
                          </div>
                          <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            "{src.snippet || src.summary}"
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px dashed var(--border-color)',
                  borderRadius: '12px',
                  padding: '32px 16px',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  fontSize: '0.85rem',
                }}
              >
                Ask any question above to see retrieval augmented generation in action.
              </div>
            )}
          </section>
        </div>

        {/* Latest Analysis Results Card (When Available) */}
        {latestAnalysis && (
          <section className="glass-panel animate-fade-in" style={{ padding: '24px', marginBottom: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '1.4rem' }}>✨</span>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Structured Extraction Result</h3>
                <span className="badge badge-purple">Doc #{latestAnalysis.id}</span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <span className="badge badge-blue">{latestAnalysis.document_type || 'General'}</span>
                {getSentimentBadge(latestAnalysis.sentiment)}
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                EXECUTIVE SUMMARY
              </div>
              <p style={{ fontSize: '0.92rem', lineHeight: '1.5', color: '#f1f5f9' }}>
                {latestAnalysis.summary}
              </p>
            </div>

            {/* Key Points */}
            {latestAnalysis.key_points && latestAnalysis.key_points.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  KEY INSIGHTS & TAKEAWAYS
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {latestAnalysis.key_points.map((pt, idx) => (
                    <span
                      key={idx}
                      style={{
                        background: 'rgba(139, 92, 246, 0.1)',
                        border: '1px solid rgba(139, 92, 246, 0.25)',
                        borderRadius: '6px',
                        padding: '6px 12px',
                        fontSize: '0.82rem',
                        color: '#ddd6fe',
                      }}
                    >
                      • {pt}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Named Entities */}
            {latestAnalysis.entities && Object.keys(latestAnalysis.entities).length > 0 && (
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
                  EXTRACTED ENTITIES
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                  {Object.entries(latestAnalysis.entities).map(([category, items], i) => (
                    <div
                      key={i}
                      style={{
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        fontSize: '0.8rem',
                      }}
                    >
                      <strong style={{ color: '#93c5fd', textTransform: 'capitalize' }}>{category}: </strong>
                      <span style={{ color: '#cbd5e1' }}>
                        {Array.isArray(items) ? items.join(', ') : String(items)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* MySQL Database Documents History */}
        <section className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>🗄️ MySQL Document Database</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Persistent records fetched via FastAPI REST API from <code style={{ color: '#a78bfa' }}>document_db.documents</code>
              </p>
            </div>
            <button onClick={fetchDocuments} className="btn-secondary" disabled={loadingDocs} style={{ padding: '6px 12px' }}>
              {loadingDocs ? 'Refreshing...' : '🔄 Refresh Table'}
            </button>
          </div>

          {documents.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '40px 16px',
                color: 'var(--text-muted)',
                fontSize: '0.9rem',
              }}
            >
              No documents in MySQL database yet. Analyze a document above to see it appear here!
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '12px 16px' }}>ID</th>
                    <th style={{ padding: '12px 16px' }}>Type</th>
                    <th style={{ padding: '12px 16px' }}>Summary Preview</th>
                    <th style={{ padding: '12px 16px' }}>Sentiment</th>
                    <th style={{ padding: '12px 16px' }}>Created At</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc) => (
                    <tr
                      key={doc.id}
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                        transition: 'background 0.2s',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      onClick={() => setSelectedDoc(doc)}
                    >
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: '#c4b5fd' }}>#{doc.id}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span className="badge badge-purple">{doc.document_type || 'General'}</span>
                      </td>
                      <td
                        style={{
                          padding: '12px 16px',
                          maxWidth: '380px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          color: '#e2e8f0',
                        }}
                      >
                        {doc.summary || doc.content}
                      </td>
                      <td style={{ padding: '12px 16px' }}>{getSentimentBadge(doc.sentiment)}</td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        {new Date(doc.created_at).toLocaleString()}
                      </td>
                      <td
                        style={{ padding: '12px 16px', textAlign: 'right' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => handleDelete(doc.id)}
                          className="btn-danger"
                          title="Delete from MySQL and FAISS"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Detail Modal when a Document is clicked */}
        {selectedDoc && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.75)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px',
              zIndex: 100,
            }}
            onClick={() => setSelectedDoc(null)}
          >
            <div
              className="glass-panel animate-fade-in"
              style={{
                maxWidth: '680px',
                width: '100%',
                maxHeight: '85vh',
                overflowY: 'auto',
                padding: '32px',
                background: '#121428',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Document #{selectedDoc.id} Details</h3>
                <button
                  onClick={() => setSelectedDoc(null)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    fontSize: '1.5rem',
                    cursor: 'pointer',
                  }}
                >
                  ✕
                </button>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <span className="badge badge-purple">{selectedDoc.document_type || 'General'}</span>
                {getSentimentBadge(selectedDoc.sentiment)}
              </div>

              <div style={{ marginBottom: '16px' }}>
                <strong style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Summary:</strong>
                <p style={{ marginTop: '4px', fontSize: '0.92rem', lineHeight: '1.5' }}>{selectedDoc.summary}</p>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <strong style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Original Content:</strong>
                <pre
                  style={{
                    marginTop: '6px',
                    padding: '12px',
                    borderRadius: '8px',
                    background: 'rgba(0, 0, 0, 0.4)',
                    whiteSpace: 'pre-wrap',
                    fontSize: '0.85rem',
                    fontFamily: 'inherit',
                    color: '#cbd5e1',
                    maxHeight: '200px',
                    overflowY: 'auto',
                  }}
                >
                  {selectedDoc.original_text || selectedDoc.content}
                </pre>
              </div>

              {selectedDoc.entities && (
                <div>
                  <strong style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Entities:</strong>
                  <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {Object.entries(selectedDoc.entities).map(([k, v], i) => (
                      <span key={i} className="badge badge-blue">
                        {k}: {Array.isArray(v) ? v.join(', ') : String(v)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
