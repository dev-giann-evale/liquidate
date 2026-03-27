import React, { useEffect, useState } from 'react'
import Modal from '../components/Modal'
import { useAuthStore } from '../stores/useAuthStore'

export default function Users(){
  const user = useAuthStore(state => state.user)
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState(null)

  useEffect(()=>{
    let mounted = true
    async function load(){
      setLoading(true)
      try{
        const resp = await fetch('/api/admin/users', { headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` } })
        if(!resp.ok){
          const e = await resp.json().catch(()=>({}))
          alert(e.error || 'Failed to load users')
          setLoading(false)
          return
        }
        const rows = await resp.json()
        if(mounted) setList(rows)
      }catch(err){
        console.error('failed to load users', err)
        alert('Failed to load users')
      }finally{ if(mounted) setLoading(false) }
    }
    if(user && user.role === 'super_admin') load()
    return ()=>{ mounted = false }
  }, [user])

  function openEdit(u){ setEditing(u); setEditOpen(true) }

  async function save(){
    if(!editing) return
    const payload = { first_name: editing.first_name, last_name: editing.last_name, email: editing.email, role: editing.role }
    if(editing.password) payload.password = editing.password
    const resp = await fetch(`/api/admin/users/${encodeURIComponent(editing.id)}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }, body: JSON.stringify(payload)
    })
    if(!resp.ok){ const e = await resp.json().catch(()=>({})); alert(e.error || 'Failed to save'); return }
    alert('Saved')
    setEditOpen(false)
    // refresh
    const r2 = await fetch('/api/admin/users', { headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` } })
    if(r2.ok){ setList(await r2.json()) }
  }

  if(!user || user.role !== 'super_admin') return <div className="card">Not authorized</div>

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4">Users</h2>
      <div className="card">
        {loading ? <div>Loading...</div> : (
          <table className="w-full text-left">
            <thead><tr><th>Email</th><th>Name</th><th>Role</th><th></th></tr></thead>
            <tbody>
              {list.map(u => (
                <tr key={u.id} className="border-t border-gray-700">
                  <td className="py-2">{u.email}</td>
                  <td className="py-2">{(u.first_name||'') + ' ' + (u.last_name||'')}</td>
                  <td className="py-2">{u.role}</td>
                  <td className="py-2"><button className="btn" onClick={()=>openEdit(u)}>Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={editOpen} onClose={()=>setEditOpen(false)} title="Edit user">
        {editing && (
          <div className="space-y-2">
            <div>
              <label className="text-sm block mb-1">Email</label>
              <input value={editing.email||''} onChange={e=>setEditing({...editing, email: e.target.value})} className="w-full p-2 rounded bg-gray-700" />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-sm block mb-1">First name</label>
                <input value={editing.first_name||''} onChange={e=>setEditing({...editing, first_name: e.target.value})} className="w-full p-2 rounded bg-gray-700" />
              </div>
              <div className="flex-1">
                <label className="text-sm block mb-1">Last name</label>
                <input value={editing.last_name||''} onChange={e=>setEditing({...editing, last_name: e.target.value})} className="w-full p-2 rounded bg-gray-700" />
              </div>
            </div>
            <div>
              <label className="text-sm block mb-1">Role</label>
              <select value={editing.role||'user'} onChange={e=>setEditing({...editing, role: e.target.value})} className="w-full p-2 rounded bg-gray-700">
                <option value="user">user</option>
                <option value="super_admin">super_admin</option>
              </select>
            </div>
            <div>
              <label className="text-sm block mb-1">New password (leave blank to keep current)</label>
              <input type="password" value={editing.password||''} onChange={e=>setEditing({...editing, password: e.target.value})} className="w-full p-2 rounded bg-gray-700" />
            </div>
            <div className="pt-2 flex justify-end">
              <button className="btn" onClick={save}>Save</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
