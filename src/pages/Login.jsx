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
    <div style={{ padding: 20 }}>
      <h2>Login</h2>
      <form onSubmit={onSubmit}>
        <div>
          <label>Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <p style={{ color: 'red' }}>{error}</p>}
  {info && <p style={{ color: '#007acc' }}>{info}</p>}
        <button type="submit">Login</button>
        <div style={{ marginTop: 8 }}>
          <button type="button" onClick={handleForgot} style={{ background: 'none', border: 'none', color: 'blue', textDecoration: 'underline', cursor: 'pointer' }}>
            Forgot password?
          </button>
        </div>
      </form>
      <p>
        Don't have an account? <Link to="/register">Register</Link>
      </p>
    </div>
  )
}
