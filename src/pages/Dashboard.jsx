import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Card from '../components/Card'
import { useAuthStore } from '../stores/useAuthStore'
import { getDashboardTotals, getMyExpenseSplits, getPayments, getProfilesByIds } from '../services/api'
import Loading from '../components/Loading'

export default function Dashboard(){
  const user = useAuthStore(state=>state.user)
  const [totals, setTotals] = useState(null)
  const [loading, setLoading] = useState(true)
  const [myExpenses, setMyExpenses] = useState([])
  const [myPayments, setMyPayments] = useState([])
  const [listsLoading, setListsLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(()=>{
    if(!user) return
    setLoading(true)
    getDashboardTotals(user.id).then(t => setTotals(t)).catch(console.error).finally(()=>setLoading(false))
  },[user])

  useEffect(()=>{
    if(!user) return
    setListsLoading(true)
    Promise.allSettled([
      getMyExpenseSplits(user.id),
      getPayments(user.id)
    ]).then(async results=>{
      const [splitsRes, paymentsRes] = results
      if(splitsRes.status === 'fulfilled'){
        // sort most recent first (created_at)
        const list = (splitsRes.value || []).slice().sort((a,b) => new Date(b.created_at) - new Date(a.created_at))
        setMyExpenses(list)
      }else{ console.error(splitsRes.reason) }
      if(paymentsRes.status === 'fulfilled'){
        const allPayments = (paymentsRes.value || []).slice().sort((a,b) => new Date(b.payment_date || b.created_at) - new Date(a.payment_date || a.created_at))
        // show only payments made by the user
        const made = allPayments.filter(p => p.paid_by === user.id || (p.paid_by && p.paid_by === user.id))
        // fetch payee names if possible
        const payeeIds = Array.from(new Set(made.map(p => p.paid_to).filter(Boolean)))
        if(payeeIds.length > 0){
          try{
            const profiles = await getProfilesByIds(payeeIds)
            const map = Object.fromEntries((profiles||[]).map(r=>[r.id, r]))
            // attach paid_to_profile for display
            setMyPayments(made.map(p => ({ ...p, paid_to_profile: map[p.paid_to] })))
          }catch(e){
            console.error(e)
            setMyPayments(made)
          }
        }else{
          setMyPayments(made)
        }
      }else{ console.error(paymentsRes.reason) }
    }).catch(console.error).finally(()=>setListsLoading(false))
  },[user])

  if(loading) return <Loading />

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <h3 className="text-sm text-gray-300">You are owed</h3>
          <div className="text-3xl font-bold">${(totals.you_are_owed || 0).toFixed(2)}</div>
        </Card>
        <Card>
          <h3 className="text-sm text-gray-300">You owe</h3>
          <div className="text-3xl font-bold">${(totals.you_owe || 0).toFixed(2)}</div>
        </Card>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <div className="flex items-center justify-between">
            <h3 className="text-sm text-gray-300">My expenses</h3>
            <div className="flex items-center gap-3">
              <div className="text-xs text-gray-500">Most recent</div>
              <button className="text-xs text-gray-300 underline" onClick={()=>navigate('/my-expenses')}>View all</button>
            </div>
          </div>
          <div className="mt-3 space-y-2">
            {listsLoading ? <div className="text-sm text-gray-500">Loading...</div> : (
              myExpenses.length === 0 ? <div className="text-sm text-gray-500">No recent expenses</div> : (
                myExpenses.slice(0,6).map(s => (
                  <div key={s.id} className="flex justify-between items-center">
                    <div className="text-sm">{s.expenses?.title || 'Expense'}</div>
                    <div className="text-xs text-gray-400">${Number(s.amount || s.owed || 0).toFixed(2)} • {new Date(s.created_at).toLocaleDateString()}</div>
                  </div>
                ))
              )
            )}
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <h3 className="text-sm text-gray-300">My payments</h3>
            <div className="text-xs text-gray-500">Most recent</div>
          </div>
          <div className="mt-3 space-y-2">
            {listsLoading ? <div className="text-sm text-gray-500">Loading...</div> : (
              myPayments.length === 0 ? <div className="text-sm text-gray-500">No recent payments</div> : (
                myPayments.slice(0,6).map(p => (
                  <div key={p.id} className="flex justify-between items-center">
                    <div className="text-sm">Paid to: {p.paid_to_profile ? `${p.paid_to_profile.first_name} ${p.paid_to_profile.last_name || ''}` : p.paid_to}</div>
                    <div className="text-xs text-gray-400">${Number(p.amount || 0).toFixed(2)} • {new Date(p.payment_date || p.created_at).toLocaleDateString()}</div>
                  </div>
                ))
              )
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
