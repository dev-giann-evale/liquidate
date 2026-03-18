import React, { useEffect, useMemo, useState } from 'react'
import { useAuthStore } from '../stores/useAuthStore'
import { getProfileById, updateProfile } from '../services/api'
import { supabase } from '../lib/supabaseClient'

export default function Profile(){
  const user = useAuthStore(state=>state.user)
  const setUser = useAuthStore(state=>state.setUser)
  const userId = user?.id
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [updatingPassword, setUpdatingPassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [profileMessage, setProfileMessage] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')
  const [error, setError] = useState('')

  const fullName = useMemo(() => {
    const parts = [firstName, lastName].filter(Boolean)
    return parts.length ? parts.join(' ') : 'Your account'
  }, [firstName, lastName])

  useEffect(() => {
    if(!userId) return

    let active = true

    async function loadProfile(){
      setLoadingProfile(true)
      setError('')
      setProfileMessage('')

      try{
        if(user?.profile){
          setFirstName(user.profile.first_name || '')
          setLastName(user.profile.last_name || '')
          setEmail(user.profile.email || user.email || '')
          setLoadingProfile(false)
          return
        }

        const profile = await getProfileById(userId)
        if(!active) return
        setFirstName(profile?.first_name || '')
        setLastName(profile?.last_name || '')
        setEmail(profile?.email || user.email || '')
        setUser({ ...user, profile })
      }catch(err){
        if(!active) return
        console.error(err)
        setEmail(user.email || '')
        setError(err.message || 'Could not load your account details.')
      }finally{
        if(active) setLoadingProfile(false)
      }
    }

    loadProfile()

    return () => {
      active = false
    }
  }, [userId, user?.email, user?.profile, setUser])

  async function handleProfileSubmit(e){
    e.preventDefault()
    if(!user) return

    setSavingProfile(true)
    setError('')
    setProfileMessage('')

    try{
      const profile = await updateProfile(user.id, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim() || user.email || ''
      })
      setUser({ ...user, email: profile.email || user.email, profile })
      setProfileMessage('Account details updated.')
    }catch(err){
      console.error(err)
      setError(err.message || 'Could not update your account details.')
    }finally{
      setSavingProfile(false)
    }
  }

  async function handlePasswordSubmit(e){
    e.preventDefault()
    setPasswordMessage('')
    setError('')

    if(newPassword.length < 6){
      setError('Password must be at least 6 characters long.')
      return
    }

    if(newPassword !== confirmPassword){
      setError('Passwords do not match.')
      return
    }

    setUpdatingPassword(true)

    try{
      const { error: passwordError } = await supabase.auth.updateUser({ password: newPassword })
      if(passwordError) throw passwordError
      setNewPassword('')
      setConfirmPassword('')
      setPasswordMessage('Password updated successfully.')
    }catch(err){
      console.error(err)
      setError(err.message || 'Could not update your password.')
    }finally{
      setUpdatingPassword(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Account Settings</h1>
        <p className="text-sm text-gray-400 mt-1">Review your account details, update your personal info, and change your password.</p>
      </div>

      {error && (
        <div className="card border border-red-500/40 text-red-200 bg-red-500/10">
          {error}
        </div>
      )}

      <section className="card space-y-2">
        <p className="text-xs uppercase tracking-wide text-gray-400">Current account</p>
        <h2 className="text-xl font-semibold">{loadingProfile ? 'Loading account...' : fullName}</h2>
        <p className="text-sm text-gray-400">{email || user?.email}</p>
        <p className="text-xs text-gray-500">User ID: {user?.id}</p>
      </section>

      <form onSubmit={handleProfileSubmit} className="card space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Personal information</h2>
            <p className="text-sm text-gray-400">Update the details shown across your account.</p>
          </div>
          {profileMessage && <span className="text-sm text-emerald-300">{profileMessage}</span>}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm block mb-1">First name</label>
            <input
              value={firstName}
              onChange={e=>setFirstName(e.target.value)}
              className="w-full p-2 rounded bg-gray-700"
              disabled={loadingProfile || savingProfile}
            />
          </div>

          <div>
            <label className="text-sm block mb-1">Last name</label>
            <input
              value={lastName}
              onChange={e=>setLastName(e.target.value)}
              className="w-full p-2 rounded bg-gray-700"
              disabled={loadingProfile || savingProfile}
            />
          </div>
        </div>

        <div>
          <label className="text-sm block mb-1">Email</label>
          <input
            value={email}
            className="w-full p-2 rounded bg-gray-700 text-gray-300"
            disabled
            readOnly
          />
        </div>

        <div className="flex justify-end">
          <button className="btn" disabled={loadingProfile || savingProfile}>
            {savingProfile ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </form>

      <form onSubmit={handlePasswordSubmit} className="card space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Password</h2>
            <p className="text-sm text-gray-400">Choose a new password for your account.</p>
          </div>
          {passwordMessage && <span className="text-sm text-emerald-300">{passwordMessage}</span>}
        </div>

        <div>
          <label className="text-sm block mb-1">New password</label>
          <input
            type="password"
            value={newPassword}
            onChange={e=>setNewPassword(e.target.value)}
            className="w-full p-2 rounded bg-gray-700"
            disabled={updatingPassword}
            minLength={6}
            required
          />
        </div>

        <div>
          <label className="text-sm block mb-1">Confirm new password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={e=>setConfirmPassword(e.target.value)}
            className="w-full p-2 rounded bg-gray-700"
            disabled={updatingPassword}
            minLength={6}
            required
          />
        </div>

        <div className="flex justify-end">
          <button className="btn" disabled={updatingPassword}>
            {updatingPassword ? 'Updating...' : 'Update password'}
          </button>
        </div>
      </form>
    </div>
  )
}
