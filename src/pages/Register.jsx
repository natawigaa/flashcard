import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Register() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [info, setInfo] = useState(null)
  const { signUp } = useAuth()
  const navigate = useNavigate()

  const onSubmit = async (e) => {
    e.preventDefault()
  setError(null)
  // show immediate instruction to check email after registering
  setInfo('โปรดยืนยันอีเมล')
    const res = await signUp(email, password)
    const data = res?.data
    const error = res?.error
    if (error) {
      setError(error.message)
    } else if (data?.session?.user) {
      // immediate active session created (no email confirm required)
      navigate('/dashboard')
    } else {
      // no error but no active session -> likely requires email confirmation
      setInfo('โปรดยืนยันอีเมล')
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card card">
        <div className="auth-brand">
          <div style={{display:'flex', alignItems:'center', gap:12}}>
            <span className="brand-mark" aria-hidden>
              <svg viewBox="0 0 24 24" width="40" height="40" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden>
                {/* match TopBar icon path exactly; use solid blue fill to avoid duplicate gradient ids */}
                <path d="M13.5 2L6 13h5l-1 9L18 11h-5l.5-9z" fill="#1e90ff" />
              </svg>
            </span>
            <h1 className="auth-title brand-text">Flash Learn</h1>
          </div>
          <p className="auth-subtitle">Create an account to start learning</p>
        </div>

        <form className="auth-form" onSubmit={onSubmit}>
          <div className="form-field">
            <label>Email</label>
            <input className="auth-input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          <div className="form-field">
            <label>Password</label>
            <input className="auth-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>

          {error && <p className="auth-error">{error}</p>}
          {info && <p className="auth-info">{info}</p>}

          <div className="auth-actions">
            <button className="btn-primary" type="submit">Create account</button>
          </div>
        </form>

        <p className="auth-foot">
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </div>
    </div>
  )
}
