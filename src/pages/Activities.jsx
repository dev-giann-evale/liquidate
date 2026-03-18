import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Card from '../components/Card'
import { useAuthStore } from '../stores/useAuthStore'
import { getUserActivities, createActivity, addActivityMember, getActivityMembers, getMembersForActivities } from '../services/api'
import { getProfileMap, getCachedProfile, getNameFromProfile } from '../lib/profileCache'
import Modal from '../components/Modal'

function formatActivityDate(dt){
  if(!dt) return '—'
  try{
    const d = new Date(dt)
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  }catch(e){ return dt }
}

function NewActivityForm({ onCreated, onClose, currentUser }){
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e){
    e.preventDefault()
    setLoading(true)
    try{
      const activity = await createActivity({ name, description, created_by: currentUser.id })
      // auto-join creator
      await addActivityMember(activity.id, currentUser.id)
      onCreated && onCreated(activity)
      onClose && onClose()
    }catch(err){
      console.error(err)
      alert(err.message || 'Could not create activity')
    }finally{ setLoading(false) }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="text-sm block mb-1">Name</label>
        <input value={name} onChange={e=>setName(e.target.value)} className="w-full p-2 rounded bg-gray-700" required />
      </div>
      <div>
        <label className="text-sm block mb-1">Description</label>
        <input value={description} onChange={e=>setDescription(e.target.value)} className="w-full p-2 rounded bg-gray-700" />
      </div>
      <div className="flex justify-end">
        <button className="btn" disabled={loading}>{loading ? 'Creating...' : 'Create'}</button>
      </div>
    </form>
  )
}

export default function Activities(){
  const user = useAuthStore(state=>state.user)
  const [activities, setActivities] = useState([])
  const [membersInfo, setMembersInfo] = useState({})
  const [showNew, setShowNew] = useState(false)

  function refresh(){
    if(!user) return
    getUserActivities(user.id).then(async acts=>{
      setActivities(acts)
      const creatorIds = Array.from(new Set(acts.map(a => a.created_by).filter(Boolean)))
      await getProfileMap(creatorIds)
      try{
        const ids = acts.map(a => a.id)
        const rows = await getMembersForActivities(ids)
        const infos = {}
        // initialize
        ids.forEach(id => infos[id] = { count: 0, isMember: false })
        for(const r of rows){
          infos[r.activity_id].count = (infos[r.activity_id].count || 0) + 1
          if(r.user_id === user.id) infos[r.activity_id].isMember = true
        }
        setMembersInfo(infos)
      }catch(e){ console.error(e) }
    }).catch(console.error)
  }


  useEffect(()=>{ refresh() },[user])

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-semibold">Activities</h1>
        <div />
        <button className="btn font-semibold font-2xl" onClick={()=>setShowNew(true)}>+ New Activity</button>
      </div>
      <div className="space-y-3">
        {activities.map(a=> (
          <Card key={a.id} className="flex justify-between items-center">
            <div>
              <div className="font-semibold text-xl">{a.name}</div>
              <div className="text-sm text-gray-400">{a.description}</div>
              <div className="text-xs text-gray-500">Activity date: {formatActivityDate(a.created_at)}</div>
              <div className="text-xs text-gray-500">Created by: {getNameFromProfile(getCachedProfile(a.created_by)) || a.created_by}</div>
                <div className="text-xs text-gray-500">
                  Members: {membersInfo[a.id]?.count ?? '—'} {membersInfo[a.id]?.isMember ? <span className="ml-2 text-emerald-400">(you)</span> : null}
                </div>
            </div>
            <Link to={`/activity/${a.id}`} className="btn">Details</Link>
          </Card>
        ))}
      </div>

      <Modal open={showNew} onClose={()=>setShowNew(false)} title="Create activity">
        <NewActivityForm currentUser={user} onCreated={(a)=>{ refresh() }} onClose={()=>setShowNew(false)} />
      </Modal>
    </div>
  )
}
