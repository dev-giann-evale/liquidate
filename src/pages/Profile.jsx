import React from 'react'
import { useAuthStore } from '../stores/useAuthStore'

export default function Profile(){
  const user = useAuthStore(state=>state.user)
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Profile</h1>
      <div className="card">
        <div className="font-semibold">{user?.profile?.first_name} {user?.profile?.last_name}</div>
        <div className="text-sm text-gray-400">{user?.email}</div>
      </div>
    </div>
  )
}
