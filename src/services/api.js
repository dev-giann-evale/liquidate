import { supabase } from '../lib/supabaseClient'

// Activities
export async function createActivity({ name, description, created_by }){
  const { data, error } = await supabase
    .from('activities')
    .insert({ name, description, created_by })
    .select()
    .single()
  if(error) throw error
  return data
}

export async function getUserActivities(userId){
  const { data, error } = await supabase
    .from('activity_members')
    .select('activity:activities(*)')
    .eq('user_id', userId)
  if(error) throw error
  return data.map(r => r.activity)
}

export async function addActivityMember(activity_id, user_id){
  const { data, error } = await supabase
    .from('activity_members')
    .insert({ activity_id, user_id })
    .select()
    .single()
  if(error) throw error
  return data
}

// Expenses + splitting logic
export async function createExpense({ activity_id, title, total_amount, paid_by, created_by, participants }){
  // insert expense
  const { data: expense, error: expErr } = await supabase
    .from('expenses')
    .insert({ activity_id, title, total_amount, paid_by, created_by })
    .select()
    .single()
  if(expErr) throw expErr

  // split equally among participants EXCLUDING payer
  const otherParticipants = participants.filter(p => p !== paid_by)
  const splits = []
  if(otherParticipants.length > 0){
    // equal split with rounding to 2 decimals, adjust last
    const raw = Number(total_amount) / participants.length
    const share = Math.floor(raw * 100) / 100 // truncate
    let accumulated = 0
    for(let i=0;i<otherParticipants.length;i++){
      const isLast = i === otherParticipants.length - 1
      let amount = isLast ? Number((total_amount - (accumulated)).toFixed(2)) : share
      accumulated += amount
      splits.push({ expense_id: expense.id, user_id: otherParticipants[i], owed_to: paid_by, amount, status: 'pending' })
    }

    const { error: splitErr } = await supabase
      .from('expense_splits')
      .insert(splits)
    if(splitErr) throw splitErr
  }

  return expense
}

export async function getActivityExpenses(activity_id){
  // Select expenses and join profile names for paid_by/created_by and expense_splits' user and owed_to
  const { data, error } = await supabase
    .from('expenses')
    .select(`
      *,
      paid_by:profiles!expenses_paid_by_fkey(id, first_name, last_name),
      created_by:profiles!expenses_created_by_fkey(id, first_name, last_name),
      expense_splits(
        *,
        user:profiles!expense_splits_user_id_fkey(id, first_name, last_name),
        owed_to:profiles!expense_splits_owed_to_fkey(id, first_name, last_name)
      )
    `)
    .eq('activity_id', activity_id)
    .order('created_at', { ascending: false })
  if(error) throw error
  return data
}

export async function updateExpense(expense_id, fields = {}){
  const { data, error } = await supabase
    .from('expenses')
    .update(fields)
    .eq('id', expense_id)
    .select()
    .single()
  if(error) throw error
  return data
}

export async function deleteExpenseSplitsByExpense(expense_id){
  const { data, error } = await supabase
    .from('expense_splits')
    .delete()
    .eq('expense_id', expense_id)
  if(error) throw error
  return data
}

export async function insertExpenseSplits(splits = []){
  if(!splits || splits.length === 0) return []
  const { data, error } = await supabase
    .from('expense_splits')
    .insert(splits)
  if(error) throw error
  return data
}

export async function getActivityById(activity_id){
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .eq('id', activity_id)
    .single()
  if(error) throw error
  return data
}

export async function updateActivity(activity_id, fields = {}){
  const { data, error } = await supabase
    .from('activities')
    .update(fields)
    .eq('id', activity_id)
    .select()
    .single()
  if(error) throw error
  return data
}

export async function getActivityMembers(activity_id){
  const { data, error } = await supabase
    .from('activity_members')
    .select('user:profiles(*)')
    .eq('activity_id', activity_id)
  if(error) throw error
  return data.map(r => r.user)
}

export async function getMembersForActivities(ids = []){
  if(!ids || ids.length === 0) return []
  const { data, error } = await supabase
    .from('activity_members')
    .select('activity_id, user_id')
    .in('activity_id', ids)
  if(error) throw error
  return data
}

// Dashboard totals for a user
export async function getDashboardTotals(user_id){
  // You are owed: expense_splits where owed_to = user_id and status = pending
  const { data: owedData, error: owedErr } = await supabase
    .from('expense_splits')
    .select('amount')
    .eq('owed_to', user_id)
    .eq('status', 'pending')
  if(owedErr) throw owedErr

  const { data: oweData, error: oweErr } = await supabase
    .from('expense_splits')
    .select('amount')
    .eq('user_id', user_id)
    .eq('status', 'pending')
  if(oweErr) throw oweErr

  const sum = arr => arr.reduce((s, r) => s + Number(r.amount || 0), 0)
  return { you_are_owed: sum(owedData), you_owe: sum(oweData) }
}

// Record a payment: mark split paid and insert audit record
export async function recordPayment({ activity_id, split_id, paid_by, paid_to, amount, payment_date }){
  const { error: updErr } = await supabase
    .from('expense_splits')
    .update({ status: 'paid' })
    .eq('id', split_id)
  if(updErr) throw updErr

  const { data, error: payErr } = await supabase
    .from('payments')
    .insert({ activity_id, paid_by, paid_to, amount, payment_date })
    .select()
    .single()
  if(payErr) throw payErr
  return data
}

export async function getPayments(user_id){
  // payments where user is payer or payee
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .or(`paid_by.eq.${user_id},paid_to.eq.${user_id}`)
    .order('created_at', { ascending: false })
  if(error) throw error
  return data
}

export async function getMyExpenseSplits(user_id){
  const { data, error } = await supabase
    .from('expense_splits')
    .select('*, expenses(title, activity_id)')
    .eq('user_id', user_id)
    .order('created_at', { ascending: false })
  if(error) throw error
  return data
}

export async function getProfilesByIds(ids = []){
  if(!ids || ids.length === 0) return []
  const { data, error } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, email')
    .in('id', ids)
  if(error) throw error
  return data
}

export async function getAllProfiles(){
  const { data, error } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, email')
    .order('first_name', { ascending: true })
  if(error) throw error
  return data
}

export async function removeActivityMember(activity_id, user_id){
  const { data, error } = await supabase
    .from('activity_members')
    .delete()
    .match({ activity_id, user_id })
  if(error) throw error
  return data
}

export async function getActivitiesByIds(ids = []){
  if(!ids || ids.length === 0) return []
  const { data, error } = await supabase
    .from('activities')
    .select('id, name, description')
    .in('id', ids)
  if(error) throw error
  return data
}
