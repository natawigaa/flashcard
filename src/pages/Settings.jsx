import React, { useEffect, useState } from 'react'
import Chrome from '../components/Chrome'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function Settings() {
  const { user, signOut } = useAuth()
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light')
  const [changingPwd, setChangingPwd] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  async function changePassword() {
    setMessage(null)
    if (!user) return setMessage({ type: 'error', text: 'Sign in required' })
    if (!newPassword || newPassword.length < 6) return setMessage({ type: 'error', text: 'Password must be at least 6 characters' })
    if (newPassword !== confirmPassword) return setMessage({ type: 'error', text: 'Passwords do not match' })
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) {
        console.error('changePassword', error)
        setMessage({ type: 'error', text: 'Failed to change password: ' + (error.message || JSON.stringify(error)) })
      } else {
        setMessage({ type: 'success', text: 'Password updated' })
        setNewPassword('')
        setConfirmPassword('')
        setChangingPwd(false)
      }
    } finally { setLoading(false) }
  }

  // Note: deleteAccount removed — app data deletion was removed per UX decision

  return (
    <Chrome>
      <div style={{ maxWidth: 900 }}>
        <h2>Settings</h2>
        <div className="settings-section">
          <h3>Appearance</h3>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={theme === 'dark'}
                onChange={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              />
              <span>{theme === 'dark' ? 'Dark' : 'Light'}</span>
            </label>
          </div>
          <div style={{ marginTop: 12 }} className="theme-preview">Preview: <span style={{ fontWeight: 700 }}>{theme}</span></div>
        </div>

        <div className="settings-section">
          <h3>Security</h3>
          {!changingPwd ? (
            <div>
              <div style={{ color: '#bfbfbf' }}>Change your password</div>
              <div style={{ marginTop: 8 }}>
                <button onClick={() => { setChangingPwd(true); setMessage(null) }} className="small-btn">Change password</button>
              </div>
            </div>
          ) : (
            <div>
              <input placeholder="New password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              <input placeholder="Confirm password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} style={{ marginTop: 8 }} />
              {message && <div className={`settings-message ${message.type}`}>{message.text}</div>}
              <div style={{ marginTop: 8 }}>
                <button onClick={changePassword} disabled={loading}>Save</button>
                <button onClick={() => { setChangingPwd(false); setNewPassword(''); setConfirmPassword(''); setMessage(null) }} style={{ marginLeft: 8 }} className="small-btn">Cancel</button>
              </div>
            </div>
          )}
        </div>

        <div className="settings-section">
          <h3>Account</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => signOut()}>Sign out</button>
          </div>
        </div>
      </div>
    </Chrome>
  )
}
