import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuthStore } from '../stores/useAuthStore'

export default function Login(){
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const setUser = useAuthStore(state => state.setUser)

  async function handleSubmit(e){
    e.preventDefault()
    setLoading(true)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if(error){
      alert(error.message)
      setLoading(false)
      return
    }
    // fetch profile
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).single()
    setUser({ ...data.user, profile })
    setLoading(false)
    navigate('/dashboard')
  }

  return (
    <div className="max-w-md mx-auto mt-8">
      <h2 className="text-2xl font-semibold mb-4">Login</h2>
      <form onSubmit={handleSubmit} className="space-y-3 card">
        <div>
          <label className="text-sm block mb-1">Email</label>
          <input value={email} onChange={e=>setEmail(e.target.value)} className="w-full p-2 rounded bg-gray-700" />
        </div>
        <div>
          <label className="text-sm block mb-1">Password</label>
          <input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full p-2 rounded bg-gray-700" />
        </div>
        <div>
          <button className="btn" disabled={loading}>{loading ? 'Signing in...' : 'Sign in'}</button>
        </div>
        <div className="text-sm">
          Don't have an account? <Link to="/register" className="underline">Register</Link>
        </div>
      </form>
    </div>
  )
}
