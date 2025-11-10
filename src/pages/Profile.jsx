import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Chrome from '../components/Chrome'

const STORAGE_BUCKET = 'flashcard_image'

export default function Profile() {
  const { user, refreshProfile } = useAuth()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')

  useEffect(() => {
    if (!user) return
    loadProfile()
  }, [user])

  async function loadProfile() {
    setLoading(true)
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (error) {
        console.error('loadProfile', error)
      } else {
        setProfile(data)
        setFullName(data?.full_name || '')
        setUsername(data?.username || '')
        if (data?.avatar_url) {
          try {
            const { data: urlData, error: sErr } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(data.avatar_url, 60 * 60)
            const signed = urlData?.signedUrl ?? urlData?.signedURL
            if (!sErr && signed) setAvatarPreview(signed)
            else {
              const { data: pubData } = await supabase.storage.from(STORAGE_BUCKET).getPublicUrl(data.avatar_url)
              if (pubData?.publicUrl) setAvatarPreview(pubData.publicUrl)
            }
          } catch (e) { console.error('avatar signed url', e) }
        }
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function handleAvatarChange(file) {
    if (!file || !user) return
    setLoading(true)
    try {
      const filename = `avatars/${user.id}/${Date.now()}-${file.name}`
      const { data: upData, error: upErr } = await supabase.storage.from(STORAGE_BUCKET).upload(filename, file)
      if (upErr) {
        console.error('avatar upload error', upErr)
        alert('Failed to upload avatar')
        return
      }
      // update profile row to point to storage path
      const { error: updErr } = await supabase.from('profiles').update({ avatar_url: filename }).eq('id', user.id)
      if (updErr) {
        console.error('update profile avatar error', updErr)
        alert('Failed to save avatar to profile')
        return
      }
      // create signed url for preview
      try {
        const { data: urlData, error: sErr } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(filename, 60 * 60)
        const signed = urlData?.signedUrl ?? urlData?.signedURL
        if (!sErr && signed) setAvatarPreview(signed)
        else {
          const { data: pubData } = await supabase.storage.from(STORAGE_BUCKET).getPublicUrl(filename)
          if (pubData?.publicUrl) setAvatarPreview(pubData.publicUrl)
        }
      } catch (e) { console.error('signed url after upload', e) }
      // refresh profile
      await loadProfile()
    } finally {
      setLoading(false)
    }
  }

  async function saveProfile() {
    if (!user) return
    setLoading(true)
    try {
      const payload = { full_name: fullName || null, username: username || null }
      const { error } = await supabase.from('profiles').update(payload).eq('id', user.id)
      if (error) {
        console.error('saveProfile', error)
        alert('Failed to save profile')
      } else {
        alert('Profile saved')
        // refresh the global auth profile so TopBar reflects the updated username
        try { await (refreshProfile ? refreshProfile() : Promise.resolve()) } catch (e) { console.error('refreshProfile', e) }
        await loadProfile()
      }
    } finally { setLoading(false) }
  }

  if (!user) return <div style={{ padding: 20 }}>Sign in to view your profile</div>

  return (
    <Chrome>
      <div className="profile-page">
        <h2>Profile</h2>
        <div className="profile-grid">
          <div className="avatar-top">
            <div className="avatar-wrap">
              {avatarPreview ? (
                <img src={avatarPreview} alt="avatar" className="avatar-img" />
              ) : (
                <div className="avatar-placeholder">{(profile?.full_name || user.email || 'U').slice(0,1).toUpperCase()}</div>
              )}
              <div style={{ marginTop: 8 }}>
                <input id="avatar-file" type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { if (e.target.files && e.target.files[0]) handleAvatarChange(e.target.files[0]); e.target.value = '' }} />
                <button className="small-btn" onClick={() => document.getElementById('avatar-file').click()}>Change Profile Picture</button>
              </div>
            </div>
          </div>

          <div className="profile-form">
            <div className="field">
              <label>Full name</label>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>

            <div className="field">
              <label>Username</label>
              <input value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>

            <div className="field">
              <label>Email</label>
              <input value={user.email} disabled />
            </div>

            <div style={{ marginTop: 12 }}>
              <button onClick={saveProfile} disabled={loading}>Save profile</button>
            </div>
          </div>
        </div>
      </div>
    </Chrome>
  )
}
