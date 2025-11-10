import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [info, setInfo] = useState(null)
  const { signIn } = useAuth()
  const navigate = useNavigate()

  const onSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    console.log('[Login] onSubmit called', { email })
    setInfo('Attempting to sign in...')
    const res = await signIn(email, password)
    console.log('[Login] signIn returned', res)
    const data = res?.data
    const error = res?.error
    if (error) {
      setError(error.message)
    } else if (data?.session?.user) {
      // successful sign-in with active session
      navigate('/dashboard')
    } else {
      // no error but also no active session (common when email confirmation is required)
      setError('ไม่มี session ที่ใช้งาน — กรุณาตรวจสอบอีเมลเพื่อยืนยันบัญชี (check your inbox)')
    }
  }

  const handleForgot = async () => {
    const e = window.prompt('Enter your email to receive a password reset link:')
    if (!e) return
    setInfo(null)
    setError(null)
    const { data, error } = await supabase.auth.resetPasswordForEmail(e)
    if (error) setError(error.message)
    else setInfo('If that email exists, a password reset link has been sent. Check your inbox.')
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
          <p className="auth-subtitle">Study smarter — create and review flashcards</p>
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
            <button className="btn-primary" type="submit">Sign in</button>
            <button type="button" onClick={handleForgot} className="btn-link">Forgot password?</button>
          </div>
        </form>

        <p className="auth-foot">
          Don't have an account? <Link to="/register">Register</Link>
        </p>
      </div>
    </div>
  )
}
