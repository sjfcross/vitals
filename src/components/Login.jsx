import { useState } from 'react'
import { supabase } from '../lib/supabase'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100dvh',
      background: '#0e0f11',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    }}>
      <div style={{ width: '100%', maxWidth: 360 }}>
        <div className="fade-up" style={{ marginBottom: 40, textAlign: 'center' }}>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, letterSpacing: '0.12em', color: '#f0eeea', fontFamily: 'DM Mono, monospace' }}>
            VITALS
          </div>
          <div style={{ color: '#6b6f73', fontSize: '0.8rem', marginTop: 6, letterSpacing: '0.04em' }}>
            Personal Health Tracker
          </div>
        </div>

        <form onSubmit={handleSubmit} className="fade-up stagger-1" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: '#9ca0a4', marginBottom: 6, letterSpacing: '0.04em' }}>
              EMAIL
            </label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: '#9ca0a4', marginBottom: 6, letterSpacing: '0.04em' }}>
              PASSWORD
            </label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </div>

          {error && (
            <div style={{ color: '#e8784a', fontSize: '0.8rem', textAlign: 'center', padding: '8px 0' }}>
              {error}
            </div>
          )}

          <button
            className="btn-primary"
            type="submit"
            disabled={loading}
            style={{ marginTop: 8, opacity: loading ? 0.6 : 1 }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <a
          className="btn-primary fade-up stagger-2"
          href="https://sjfcross.github.io/pages/vitals.html"
          target="_blank"
          rel="noopener"
          style={{
            display: 'block',
            boxSizing: 'border-box',
            marginTop: 12,
            background: 'transparent',
            color: '#9ca0a4',
            border: '1px solid #2a2d30',
            fontWeight: 500,
            textAlign: 'center',
            textDecoration: 'none',
          }}
        >
          Documentation ↗
        </a>
      </div>
    </div>
  )
}
