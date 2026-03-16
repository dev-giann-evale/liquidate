import React, { useState, useEffect } from 'react'
import { createExpense, getActivityMembers } from '../services/api'

export default function ExpenseForm({ activityId, onCreated }){
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [paidBy, setPaidBy] = useState(null)
  const [members, setMembers] = useState([])
  const [selected, setSelected] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(()=>{
    if(!activityId) return
    let mounted = true;
    getActivityMembers(activityId).then(users=>{
      if(!mounted) return
      const members = users || []
      setMembers(members)
      setPaidBy(members[0]?.id || null)
      setSelected(members.map(u=>u.id))
    }).catch(err=>{
      console.error('failed to load members', err)
    })
    return ()=>{ mounted = false }
  },[activityId])

  async function handleSubmit(e){
    e.preventDefault()
    setLoading(true)
    try{
      const participants = selected
      const payload = { activity_id: activityId, title, total_amount: Number(amount), paid_by: paidBy, created_by: paidBy, participants }
      await createExpense(payload)
      onCreated && onCreated()
    }catch(err){
      console.error(err)
    }finally{ setLoading(false) }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="text-sm block mb-1">Title</label>
        <input value={title} onChange={e=>setTitle(e.target.value)} className="w-full p-2 rounded bg-gray-700" />
      </div>
      <div>
        <label className="text-sm block mb-1">Amount</label>
        <input type="number" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} className="w-full p-2 rounded bg-gray-700" />
      </div>
      <div>
        <label className="text-sm block mb-1">Paid by</label>
        <select value={paidBy || ''} onChange={e=>setPaidBy(e.target.value)} className="w-full p-2 rounded bg-gray-700">
          {members.map(m=> <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
        </select>
      </div>
      <div>
        <label className="text-sm block mb-1">Split with</label>
        <div className="flex flex-wrap gap-2">
          {members.map(m=> (
            <label key={m.id} className={`px-3 py-1 rounded ${selected.includes(m.id) ? 'bg-accent' : 'bg-gray-700'}`}>
              <input type="checkbox" checked={selected.includes(m.id)} onChange={()=>{
                setSelected(s => s.includes(m.id) ? s.filter(x=>x!==m.id) : [...s, m.id])
              }} className="mr-2" />
              {m.first_name}
            </label>
          ))}
        </div>
      </div>
      <div>
        <button type="submit" className="btn" disabled={loading}>{loading ? 'Creating...' : 'Create Expense'}</button>
      </div>
    </form>
  )
}
