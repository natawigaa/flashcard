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
    <div style={{ padding: 20 }}>
      <h2>Register</h2>
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
  <button type="submit">Register</button>
      </form>
      <p>
        Already have an account? <Link to="/login">Login</Link>
      </p>
    </div>
  )
}
