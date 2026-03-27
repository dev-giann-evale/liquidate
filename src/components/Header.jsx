import React, { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import logo from '../assets/logo.png'
import { useAuthStore } from '../stores/useAuthStore'

export default function Header(){
  const user = useAuthStore(state => state.user)
  const setUser = useAuthStore(state => state.setUser)
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const menuRef = useRef()

  async function handleLogout(){
    // remove stored token and clear local user state
    try{ localStorage.removeItem('auth_token') }catch(_){ }
    setUser(null)
    navigate('/login')
  }

  useEffect(() => {
    function onDocClick(e){
      if(menuRef.current && !menuRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [])

  return (
    <header className="p-4 bg-accent border-b border-gray-800">
      <div className="max-w-3xl mx-auto flex items-center justify-between">
        <Link to="/dashboard" className="flex items-center gap-2">
          <img src={logo} alt="Liquidate" className="h-10 w-auto" />
        </Link>
        <nav className="relative text-sm" ref={menuRef}>
          <button
            onClick={() => setOpen(o => !o)}
            className="p-2 rounded text-white hover:bg-white/10"
            aria-haspopup="true"
            aria-expanded={open}
            aria-label="Open menu"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {open && (
            <div className="absolute right-0 mt-2 w-44 bg-white text-gray-900 rounded shadow-lg z-50">
              <ul className="divide-y">
                {user ? (
                  <>
                    {user.role === 'super_admin' && (
                      <li>
                        <Link to="/users" className="block px-4 py-2 hover:bg-gray-100" onClick={() => setOpen(false)}>Users</Link>
                      </li>
                    )}
                    <li>
                      <Link to="/profile" className="block px-4 py-2 hover:bg-gray-100" onClick={() => setOpen(false)}>Account Settings</Link>
                    </li>
                    <li>
                      <button onClick={() => { setOpen(false); handleLogout() }} className="w-full text-left px-4 py-2 hover:bg-gray-100">Logout</button>
                    </li>
                  </>
                ) : (
                  <>
                    <li>
                      <Link to="/login" className="block px-4 py-2 hover:bg-gray-100" onClick={() => setOpen(false)}>Login</Link>
                    </li>
                    <li>
                      <Link to="/register" className="block px-4 py-2 hover:bg-gray-100" onClick={() => setOpen(false)}>Register</Link>
                    </li>
                  </>
                )}
              </ul>
            </div>
          )}
        </nav>
      </div>
    </header>
  )
}
