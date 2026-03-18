import React, { useEffect, useState } from 'react'
import { useAuthStore } from '../stores/useAuthStore'
import { getMyExpenseSplits, getPayments } from '../services/api'
import { getProfileMap, getNameFromProfile, getCachedProfile } from '../lib/profileCache'
import { getActivityMap, getCachedActivity } from '../lib/activityCache'
import { formatCurrency } from '../lib/format'
import Card from '../components/Card'
import Loading from '../components/Loading'

export default function MyExpenses(){
  const user = useAuthStore(state=>state.user)
  const [splits, setSplits] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(()=>{
    if(!user) return
    setLoading(true)
    getMyExpenseSplits(user.id).then(async d=>{
      const sorted = (d || []).slice().sort((a,b) => new Date(b.created_at) - new Date(a.created_at))
      // fetch payments for reconciliation (payments where user is payer or payee)
      let payments = []
      try{
        payments = await getPayments(user.id)
      }catch(e){
        console.error('Failed to load payments for reconciliation', e)
      }

      // mark splits as paid if a matching payment exists (payer, payee, amount)
      const reconciled = (sorted || []).map(s => {
        if(s.status === 'paid') return s
        const owedToId = s.owed_to && (s.owed_to.id || s.owed_to)
        const match = (payments || []).find(p => p.paid_by === s.user_id && p.paid_to === owedToId && Number(p.amount) === Number(s.amount))
        if(match) return { ...s, status: 'paid' }
        return s
      })

      setSplits(reconciled)
      const owedToIds = Array.from(new Set((reconciled).map(s => s.owed_to).filter(Boolean)))
      const activityIds = Array.from(new Set((reconciled).map(s => s.expenses?.activity_id).filter(Boolean)))
      await Promise.all([getProfileMap(owedToIds), getActivityMap(activityIds)])
    }).catch(console.error).finally(()=>setLoading(false))
  },[user])

  if(loading) return <Loading />

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">My Expenses</h1>
      <div className="space-y-3">
        {splits.map(s=> {
          const owedTo = getNameFromProfile(getCachedProfile(s.owed_to)) || s.owed_to
          const activity = getCachedActivity(s.expenses?.activity_id)
          const activityName = activity ? activity.name : s.expenses?.activity_id
          return (
            <Card key={s.id}>
              <div className="flex justify-between">
                <div>
                  <div className="font-semibold">{s.expenses?.title || 'Expense'}</div>
                  <div className="text-sm text-gray-400">Activity: {activityName}</div>
                </div>
                <div className="text-sm text-gray-300">{formatCurrency(s.amount)} — {s.status} {s.status === 'pending' ? ` (owed to ${owedTo})` : ''}</div>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
