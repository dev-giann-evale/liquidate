import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getActivityExpenses, getActivityById, getActivityMembers, getAllProfiles, addActivityMember, removeActivityMember, updateActivity, updateExpense, deleteExpenseSplitsByExpense, insertExpenseSplits, buildExpenseSplits, deleteExpense, recordPayment } from '../services/api'
import Card from '../components/Card'
import Loading from '../components/Loading'
import ExpenseForm from '../components/ExpenseForm'
import { useAuthStore } from '../stores/useAuthStore'

export default function ActivityDetail(){
  const { id } = useParams()
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [activity, setActivity] = useState(null)
  const [members, setMembers] = useState([])
  const [showMembersModal, setShowMembersModal] = useState(false)
  const [allUsers, setAllUsers] = useState([])
  const [localMembers, setLocalMembers] = useState([])
  const [selectedUserToAdd, setSelectedUserToAdd] = useState('')
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [showEditExpenseModal, setShowEditExpenseModal] = useState(false)
  const [editingExpense, setEditingExpense] = useState(null)
  const [editExpenseTitle, setEditExpenseTitle] = useState('')
  const [editExpenseAmount, setEditExpenseAmount] = useState('')
  const [editExpensePaidBy, setEditExpensePaidBy] = useState(null)
  const [editExpenseParticipants, setEditExpenseParticipants] = useState([])
  const currentUser = useAuthStore(state => state.user)

  async function handleMarkPaid(split){
    if(!confirm(`Mark this split as paid? ${split.user?.first_name || split.user_id} → ${split.owed_to?.first_name || split.owed_to} $${Number(split.amount).toFixed(2)}`)) return
    try{
      await recordPayment({
        activity_id: id,
        split_id: split.id,
        paid_by: currentUser?.id,
        // paid_to should be the user who owed the amount (the debtor)
        paid_to: split.user_id,
        amount: Number(split.amount),
        payment_date: new Date().toISOString()
      })
      refresh()
    }catch(e){
      console.error('failed to record payment', e)
      alert(e.message || 'Could not record payment')
    }
  }

  async function refresh(){
    if(!id) return
    setLoading(true)
    try{
      const [exp, act, mems] = await Promise.all([
        getActivityExpenses(id),
        getActivityById(id),
        getActivityMembers(id)
      ])
      setExpenses(exp)
      setActivity(act)
      setMembers(mems)
      setLocalMembers(mems)
    }catch(err){ console.error(err) }
    setLoading(false)
  }

  useEffect(()=>{ refresh() },[id])

  if(loading) return <Loading />

  const formatActivityDate = (dt) => {
    if(!dt) return '—'
    try{
      const d = new Date(dt)
      return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    }catch(e){ return dt }
  }

  const getMemberName = (userId) => {
    const match = members.find(m => m.id === userId)
    if(!match) return userId
    return `${match.first_name || ''} ${match.last_name || ''}`.trim()
  }

  let editSplitPreview = []
  if(showEditExpenseModal && editingExpense){
    try{
      editSplitPreview = buildExpenseSplits({
        expense_id: editingExpense.id,
        total_amount: Number(editExpenseAmount || 0),
        paid_by: editExpensePaidBy,
        participants: editExpenseParticipants
      })
    }catch(_){
      editSplitPreview = []
    }
  }

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <h1 className="text-2xl font-semibold">{activity?.name || 'Activity'}</h1>
        <div className="text-sm text-gray-400">{formatActivityDate(activity?.created_at)}</div>
      </div>
      <div className="text-sm text-gray-400 mb-4">{activity?.description}</div>

      <Card className="mb-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-300">Members</div>
            <div className="mt-2 flex gap-2">
              {members.map(m => (
                <div key={m.id} className="bg-gray-700 px-3 py-1 rounded">{m.first_name}</div>
              ))}
            </div>
          </div>
          <div>
            <div className="flex gap-2">
              <button className="btn" onClick={()=>setShowForm(s => !s)}>{showForm ? 'Close' : 'Add Expense'}</button>
              <button className="btn" onClick={async ()=>{
                // open members modal and fetch users
                try{
                  const users = await getAllProfiles()
                  setAllUsers(users)
                }catch(e){ console.error(e) }
                // prepare edit form
                setEditName(activity?.name || '')
                setEditDescription(activity?.description || '')
                setSelectedUserToAdd('')
                setLocalMembers(members)
                setShowMembersModal(true)
              }}>Edit Activity</button>
            </div>
          </div>
        </div>
      </Card>

      {showMembersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black opacity-50" onClick={()=>setShowMembersModal(false)} />
          <div className="bg-white text-gray-900 rounded shadow-lg p-6 z-10 w-full max-w-xl">
            <h2 className="text-lg font-semibold mb-2">Edit Activity</h2>
            <div className="mb-3">
              <label className="block text-sm text-gray-600">Name</label>
              <input value={editName} onChange={e=>setEditName(e.target.value)} className="w-full p-2 border rounded mt-1" />
            </div>
            <div className="mb-3">
              <label className="block text-sm text-gray-600">Description</label>
              <input value={editDescription} onChange={e=>setEditDescription(e.target.value)} className="w-full p-2 border rounded mt-1" />
            </div>
            <div className="mb-3">
              <label className="block text-sm text-gray-600">Add user</label>
              <div className="flex gap-2 mt-1">
                <select value={selectedUserToAdd} onChange={e=>setSelectedUserToAdd(e.target.value)} className="flex-1 p-2 border rounded">
                  <option value="">— select user —</option>
                  {allUsers.map(u => (
                    <option key={u.id} value={u.id}>{u.first_name} {u.last_name || ''} {u.email ? `(${u.email})` : ''}</option>
                  ))}
                </select>
                <button className="btn" onClick={()=>{
                  if(!selectedUserToAdd) return
                  const exists = localMembers.find(m => m.id === selectedUserToAdd)
                  if(exists) return
                  const user = allUsers.find(u => u.id === selectedUserToAdd)
                  if(user) setLocalMembers(ls => [...ls, user])
                }}>Add</button>
              </div>
            </div>
            <div className="mb-4">
              <div className="text-sm text-gray-600 mb-2">Current members</div>
              <div className="flex flex-wrap gap-2">
                {localMembers.map(m => (
                  <div key={m.id} className="bg-gray-200 px-3 py-1 rounded flex items-center gap-2">
                    <span>{m.first_name} {m.last_name || ''}</span>
                    <button className="text-red-600" onClick={()=>setLocalMembers(ls => ls.filter(x => x.id !== m.id))}>✕</button>
                  </div>
                ))}
                {localMembers.length === 0 && <div className="text-sm text-gray-500">No members</div>}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn btn-secondary" onClick={()=>setShowMembersModal(false)}>Cancel</button>
                <button className="btn" onClick={async ()=>{
                  // update activity fields then compute member additions/removals
                  try{
                    await updateActivity(id, { name: editName, description: editDescription })
                  }catch(e){ console.error('failed to update activity', e) }
                  const origIds = members.map(m => m.id)
                  const newIds = localMembers.map(m => m.id)
                  const toAdd = newIds.filter(id => !origIds.includes(id))
                  const toRemove = origIds.filter(id => !newIds.includes(id))
                  try{
                    for(const uid of toAdd){
                      await addActivityMember(id, uid)
                    }
                    for(const uid of toRemove){
                      await removeActivityMember(id, uid)
                    }
                  }catch(e){ console.error(e) }
                  setShowMembersModal(false)
                  refresh()
                }}>Save</button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="card mb-4">
          <ExpenseForm activityId={id} onCreated={()=>{ setShowForm(false); refresh() }} />
        </div>
      )}

      <div className="space-y-3">
        {expenses.map(exp => (
          <Card key={exp.id}>
            <div className="flex justify-between items-center">
              <div>
                <div className="font-semibold">{exp.title}</div>
                <div className="text-sm text-gray-400">Total: ${Number(exp.total_amount).toFixed(2)}</div>
              </div>
              <div className="text-sm text-gray-300 flex items-center gap-3">
                <div>Paid by: {exp.paid_by?.first_name ? `${exp.paid_by.first_name} ${exp.paid_by.last_name || ''}` : exp.paid_by}</div>
                <button className="btn btn-secondary" onClick={() => {
                  // open edit modal
                  setEditingExpense(exp)
                  setEditExpenseTitle(exp.title || '')
                  setEditExpenseAmount(exp.total_amount || '')
                  setEditExpensePaidBy(exp.paid_by?.id || exp.paid_by)
                    // participants = paid_by + all split user_ids (use Set to avoid duplicates)
                    const participantsSet = new Set()
                    if(exp.paid_by && exp.paid_by.id) participantsSet.add(exp.paid_by.id)
                    ;(exp.expense_splits || []).forEach(s => { if(s.user_id) participantsSet.add(s.user_id) })
                    setEditExpenseParticipants(Array.from(participantsSet))
                  // ensure members list is loaded
                  setLocalMembers(members)
                  setAllUsers(allUsers.length ? allUsers : [])
                  setShowEditExpenseModal(true)
                }}>Edit</button>
                <button className="btn" onClick={async ()=>{
                  if(!confirm('Delete this expense? This will remove associated splits.')) return
                  try{
                    await deleteExpense(exp.id)
                    refresh()
                  }catch(err){
                    console.error('failed to delete expense', err)
                    alert(err.message || 'Could not delete expense')
                  }
                }}>Delete</button>
              </div>
            </div>
            <div className="mt-2">
              <div className="text-sm text-gray-300">Splits:</div>
              <ul className="mt-1">
                {exp.expense_splits?.map(s => (
                  <li key={s.id} className="text-sm flex items-center justify-between">
                    <div>
                      {s.user?.first_name ? `${s.user.first_name} ${s.user.last_name || ''}` : s.user_id} owes ${Number(s.amount).toFixed(2)} — {s.status}
                      {s.owed_to ? ` (to ${s.owed_to?.first_name ? `${s.owed_to.first_name} ${s.owed_to.last_name || ''}` : s.owed_to})` : ''}
                    </div>
                    {s.status !== 'paid' && currentUser && ((exp.paid_by && exp.paid_by.id) || exp.paid_by) === currentUser.id && (
                      <button className="btn btn-secondary" onClick={()=>handleMarkPaid(s)}>Paid</button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        ))}
      </div>

      {showEditExpenseModal && editingExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black opacity-50" onClick={()=>setShowEditExpenseModal(false)} />
          <div className="bg-white text-gray-900 rounded shadow-lg p-6 z-10 w-full max-w-lg">
            <h2 className="text-lg font-semibold mb-2">Edit Expense</h2>
            <div className="mb-3">
              <label className="block text-sm text-gray-600">Title</label>
              <input value={editExpenseTitle} onChange={e=>setEditExpenseTitle(e.target.value)} className="w-full p-2 border rounded mt-1" />
            </div>
            <div className="mb-3">
              <label className="block text-sm text-gray-600">Amount</label>
              <input type="number" step="0.01" value={editExpenseAmount} onChange={e=>setEditExpenseAmount(e.target.value)} className="w-full p-2 border rounded mt-1" />
            </div>
            <div className="mb-3">
              <label className="block text-sm text-gray-600">Paid by</label>
              <select value={editExpensePaidBy || ''} onChange={e=>setEditExpensePaidBy(e.target.value)} className="w-full p-2 border rounded">
                {members.map(m=> <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
              </select>
            </div>
            <div className="mb-3">
              <label className="block text-sm text-gray-600">Participants</label>
              <div className="flex flex-wrap gap-2 mt-2">
                {members.map(m => (
                  <label key={m.id} className={`px-3 py-1 rounded ${editExpenseParticipants.includes(m.id) ? 'bg-accent text-white' : 'bg-gray-200'}`}>
                    <input type="checkbox" checked={editExpenseParticipants.includes(m.id)} onChange={()=>{
                      setEditExpenseParticipants(s => s.includes(m.id) ? s.filter(x=>x!==m.id) : [...s, m.id])
                    }} className="mr-2" />
                    {m.first_name}
                  </label>
                ))}
              </div>
            </div>
            <div className="mb-4">
              <div className="text-sm text-gray-600 mb-2">Splits per person</div>
              {editSplitPreview.length === 0 ? (
                <div className="text-sm text-gray-500">No splits to show. Select participants and a valid amount.</div>
              ) : (
                <ul className="space-y-1">
                  {editSplitPreview.map((split, index) => (
                    <li key={`${split.user_id}-${index}`} className="text-sm text-gray-700">
                      {getMemberName(split.user_id)} owes ${Number(split.amount).toFixed(2)} to {getMemberName(split.owed_to)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn btn-secondary" onClick={()=>setShowEditExpenseModal(false)}>Cancel</button>
              <button className="btn" onClick={async ()=>{
                // persist changes: update expense, replace splits
                const eid = editingExpense.id
                let splits = []
                try{
                  splits = buildExpenseSplits({
                    expense_id: eid,
                    total_amount: Number(editExpenseAmount),
                    paid_by: editExpensePaidBy,
                    participants: editExpenseParticipants
                  })
                }catch(e){
                  alert(e.message || 'Please fix split inputs before saving.')
                  return
                }
                try{
                  await updateExpense(eid, { title: editExpenseTitle, total_amount: Number(editExpenseAmount), paid_by: editExpensePaidBy })
                }catch(e){
                  console.error('failed to update expense', e)
                  alert(e.message || 'Could not update expense.')
                  return
                }
                try{
                  await deleteExpenseSplitsByExpense(eid)
                  if(splits.length > 0){
                    await insertExpenseSplits(splits)
                  }
                }catch(e){
                  console.error('failed to replace splits', e)
                  alert(e.message || 'Could not save expense splits.')
                  return
                }
                setShowEditExpenseModal(false)
                refresh()
              }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
