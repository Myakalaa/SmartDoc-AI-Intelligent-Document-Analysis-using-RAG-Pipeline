import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api/axios'

export default function Login() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({ username: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true) 

    try {
      const res = await api.post('/login', formData)
      localStorage.setItem('access_token', res.data.access_token)
      if (res.data.refresh_token) {
        localStorage.setItem('refresh_token', res.data.refresh_token)
      }
      localStorage.setItem('username', formData.username)
      navigate('/')
    } catch (err) {
      console.error(err)
      setError(
        err.response?.data?.detail || 'Invalid username or password. Please try again.'
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
          maxWidth: '420px',
          padding: '40px 32px',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🧠</div>
        <h1 style={{ fontSize: '1.65rem', fontWeight: 800, marginBottom: '6px' }}>
          DocAnalysis AI
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '28px' }}>
          Sign in to analyze documents & extract structured insights
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
              Username
            </label>
            <input
              type="text"
              name="username"
              required
              className="glass-input"
              placeholder="e.g. johndoe"
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
              Password
            </label>
            <input
              type="password"
              name="password"
              required
              className="glass-input"
              placeholder="••••••••"
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
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <p style={{ marginTop: '24px', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
          Don't have an account?{' '}
          <Link
            to="/register"
            style={{ color: '#a78bfa', fontWeight: 600, textDecoration: 'none' }}
          >
            Create account
          </Link>
        </p>
      </div>
    </div>
  )
}
