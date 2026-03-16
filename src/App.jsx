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
import { useAuthStore } from './stores/useAuthStore'
import { supabase } from './lib/supabaseClient'

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

  // Rehydrate session on app load and listen for auth changes so the
  // supabase client will include the user's access token on requests.
  useEffect(()=>{
    let mounted = true;
    (async ()=>{
      try{
        const { data } = await supabase.auth.getSession()
        if(!mounted) return
        if(data?.session?.user){
          setUser({ ...data.session.user })
        } else {
          // mark auth as checked even when no session exists
          useAuthStore.getState().setAuthReady(true)
        }
      }catch(e){
        console.error('failed to get session', e)
      }
    })()

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if(session?.user){
        setUser({ ...session.user })
      }else{
        // clear user when signed out
        useAuthStore.getState().clear()
      }
    })

    return ()=>{
      mounted = false
      // unsubscribe listener (support different supabase-js shapes)
      try{
        const maybeSub = listener?.subscription ?? listener
        if(typeof maybeSub === 'function'){
          // listener is an unsubscribe function
          maybeSub()
        }else if(maybeSub && typeof maybeSub.unsubscribe === 'function'){
          maybeSub.unsubscribe()
        }
      }catch(_){ }
    }
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
        </Routes>
      </main>
    </div>
  )
}
