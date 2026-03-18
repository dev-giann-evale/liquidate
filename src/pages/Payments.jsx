import React, { useEffect, useState } from 'react'
import { useAuthStore } from '../stores/useAuthStore'
import { getPayments } from '../services/api'
import { getProfileMap, getNameFromProfile, getCachedProfile } from '../lib/profileCache'
import { formatCurrency } from '../lib/format'
import Card from '../components/Card'
import Loading from '../components/Loading'

export default function Payments(){
  const user = useAuthStore(state=>state.user)
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(()=>{
    if(!user) return
    setLoading(true)
    getPayments(user.id).then(async d=>{
      const sorted = (d || []).slice().sort((a,b) => new Date(b.payment_date || b.created_at) - new Date(a.payment_date || a.created_at))
      setPayments(sorted)
      // preload profile names
      const ids = Array.from(new Set(sorted.flatMap(p => [p.paid_by, p.paid_to].filter(Boolean))))
      await getProfileMap(ids)
    }).catch(console.error).finally(()=>setLoading(false))
  },[user])

  if(loading) return <Loading />

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Payments</h1>
      <div className="space-y-3">
        {payments.map(p => {
          const payer = getNameFromProfile(getCachedProfile(p.paid_by)) || p.paid_by
          const payee = getNameFromProfile(getCachedProfile(p.paid_to)) || p.paid_to
          return (
            <Card key={p.id}>
              <div className="flex justify-between">
                <div>
                  <div className="font-semibold">{formatCurrency(p.amount)}</div>
                  <div className="text-sm text-gray-400">{new Date(p.payment_date).toLocaleString()}</div>
                </div>
                <div className="text-sm text-gray-300">{payer} → {payee}</div>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
