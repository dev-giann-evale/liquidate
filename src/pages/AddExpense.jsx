import React from 'react'
import ExpenseForm from '../components/ExpenseForm'
import { useSearchParams } from 'react-router-dom'

export default function AddExpense(){
  const [search] = useSearchParams()
  const activity = search.get('activity')

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Add Expense</h1>
      {!activity ? (
        <div className="card">Select an activity to add an expense.</div>
      ) : (
        <CardWrapper>
          <ExpenseForm activityId={activity} onCreated={()=>{ alert('Expense created (placeholder)') }} />
        </CardWrapper>
      )}
    </div>
  )
}

function CardWrapper({ children }){
  return <div className="card">{children}</div>
}
