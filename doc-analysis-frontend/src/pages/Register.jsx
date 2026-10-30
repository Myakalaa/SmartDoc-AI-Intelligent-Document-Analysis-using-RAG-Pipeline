import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api/axios'

export default function Register() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    username: '',
    mobile_number: '',
    password: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      await api.post('/register', formData)
      setSuccess('Account created successfully! Redirecting to login...')
      setTimeout(() => {
        navigate('/login')
      }, 1500)
    } catch (err) {
      console.error(err)
      setError(
        err.response?.data?.detail || 'Failed to create account. Please check your details.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div
        className="glass-panel animate-fade-in"
        style={{
          width: '100%',
          maxWidth: '440px',
          padding: '40px 32px',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🧠</div>
        <h1 style={{ fontSize: '1.65rem', fontWeight: 800, marginBottom: '6px' }}>
          Create Account
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '28px' }}>
          Join DocAnalysis AI to extract insights from documents
        </p>

        {error && (
          <div
            style={{
              background: 'rgba(244, 63, 94, 0.15)',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              color: '#fda4af',
              borderRadius: '8px',
              padding: '10px 14px',
              fontSize: '0.85rem',
              marginBottom: '20px',
              textAlign: 'left',
            }}
          >
            ⚠️ {error}
          </div>
        )}

        {success && (
          <div
            style={{
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: '#6ee7b7',
              borderRadius: '8px',
              padding: '10px 14px',
              fontSize: '0.85rem',
              marginBottom: '20px',
              textAlign: 'left',
            }}
          >
            ✅ {success}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ textAlign: 'left' }}>
            <label
              style={{
                display: 'block',
                fontSize: '0.82rem',
                fontWeight: 600,
                color: 'var(--text-muted)',
                marginBottom: '6px',
              }}
            >
              Username <span style={{ color: '#fb7185' }}>*</span>
            </label>
            <input
              type="text"
              name="username"
              required
              className="glass-input"
              placeholder="e.g. amyak"
              value={formData.username}
              onChange={handleChange}
            />
          </div>

          <div style={{ textAlign: 'left' }}>
            <label
              style={{
                display: 'block',
                fontSize: '0.82rem',
                fontWeight: 600,
                color: 'var(--text-muted)',
                marginBottom: '6px',
              }}
            >
              Mobile Number (optional)
            </label>
            <input
              type="text"
              name="mobile_number"
              className="glass-input"
              placeholder="e.g. +91 9876543210"
              value={formData.mobile_number}
              onChange={handleChange}
            />
          </div>

          <div style={{ textAlign: 'left' }}>
            <label
              style={{
                display: 'block',
                fontSize: '0.82rem',
                fontWeight: 600,
                color: 'var(--text-muted)',
                marginBottom: '6px',
              }}
            >
              Password <span style={{ color: '#fb7185' }}>*</span>
            </label>
            <input
              type="password"
              name="password"
              required
              className="glass-input"
              placeholder="At least 6 characters"
              value={formData.password}
              onChange={handleChange}
            />
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
            style={{ marginTop: '8px', width: '100%', padding: '13px' }}
          >
            {loading ? 'Registering...' : 'Create Account'}
          </button>
        </form>

        <p style={{ marginTop: '24px', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
          Already have an account?{' '}
          <Link
            to="/login"
            style={{ color: '#a78bfa', fontWeight: 600, textDecoration: 'none' }}
          >
            Sign In
          </Link>
        </p>
      </div>
    </div>
  )
}
