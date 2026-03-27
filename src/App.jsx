import React, { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Header from './components/Header'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Activities from './pages/Activities'
import ActivityDetail from './pages/ActivityDetail'
import AddExpense from './pages/AddExpense'
import Payments from './pages/Payments'
import MyExpenses from './pages/MyExpenses'
import Profile from './pages/Profile'
import Users from './pages/Users'
import { useAuthStore } from './stores/useAuthStore'
import { getProfileById } from './services/api'

function PrivateRoute({ children }){
  const user = useAuthStore(state => state.user)
  const authReady = useAuthStore(state => state.authReady)
  // While auth is being rehydrated, don't redirect — preserve location.
  if(!authReady) return null
  if(!user) return <Navigate to="/login" replace />
  return children
}

export default function App(){
  const setUser = useAuthStore(state => state.setUser)

  // Rehydrate session on app load by reading stored token and asking the server
  // for the current user. Server will validate the token and return the user
  // record (including profile) when available.
  useEffect(()=>{
    let mounted = true

    async function hydrate(){
      try{
        const token = localStorage.getItem('auth_token')
        if(!token){
          useAuthStore.getState().setAuthReady(true)
          return
        }
        const resp = await fetch('/api/auth/me', { headers: { 'Authorization': `Bearer ${token}` } })
        if(!resp.ok){
          useAuthStore.getState().setAuthReady(true)
          return
        }
        const payload = await resp.json()
        if(!mounted) return
        // payload should include a `user` object similar to login
        setUser(payload.user)
      }catch(err){
        console.error('failed to rehydrate session', err)
      }finally{
        if(mounted) useAuthStore.getState().setAuthReady(true)
      }
    }

    hydrate()

    return ()=>{ mounted = false }
  }, [setUser])

  return (
    <div className="min-h-screen bg-primary text-white">
      <Header />
      <main className="p-4 max-w-3xl mx-auto">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/activities" element={<PrivateRoute><Activities /></PrivateRoute>} />
          <Route path="/activity/:id" element={<PrivateRoute><ActivityDetail /></PrivateRoute>} />
          <Route path="/add-expense" element={<PrivateRoute><AddExpense /></PrivateRoute>} />
          <Route path="/payments" element={<PrivateRoute><Payments /></PrivateRoute>} />
          <Route path="/my-expenses" element={<PrivateRoute><MyExpenses /></PrivateRoute>} />
          <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
          <Route path="/users" element={<PrivateRoute><Users /></PrivateRoute>} />
        </Routes>
      </main>
    </div>
  )
}
