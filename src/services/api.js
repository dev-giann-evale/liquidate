import { supabase } from '../lib/supabaseClient'

export function buildExpenseSplits({ expense_id, total_amount, paid_by, participants = [], status = 'pending' }){
  if(!paid_by) throw new Error('Select who paid this expense.')

  const normalizedParticipants = Array.from(new Set((participants || []).filter(Boolean)))
  if(normalizedParticipants.length === 0) throw new Error('Select at least one participant for this expense.')

  const totalCents = Math.round(Number(total_amount || 0) * 100)
  if(Number.isNaN(totalCents) || totalCents <= 0) throw new Error('Expense amount must be greater than 0.')

  const baseShare = Math.floor(totalCents / normalizedParticipants.length)
  const remainder = totalCents % normalizedParticipants.length

  const shareByUserId = new Map()
  normalizedParticipants.forEach((userId, index) => {
    const shareCents = baseShare + (index < remainder ? 1 : 0)
    shareByUserId.set(userId, shareCents)
  })

  return normalizedParticipants
    .map(userId => ({
      expense_id,
      user_id: userId,
      owed_to: paid_by,
      amount: Number((shareByUserId.get(userId) / 100).toFixed(2)),
      status
    }))
}

export async function getProfileById(userId){
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  if(error) throw error
  return data
}

export async function updateProfile(userId, fields = {}){
  const { data, error } = await supabase
    .from('profiles')
    .update(fields)
    .eq('id', userId)
    .select()
    .single()
  if(error) throw error
  return data
}

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
  // Validate split input before creating the expense row.
  buildExpenseSplits({
    expense_id: '__preview__',
    total_amount,
    paid_by,
    participants
  })

  // insert expense
  const { data: expense, error: expErr } = await supabase
    .from('expenses')
    .insert({ activity_id, title, total_amount, paid_by, created_by })
    .select()
    .single()
  if(expErr) throw expErr

  const splits = buildExpenseSplits({
    expense_id: expense.id,
    total_amount,
    paid_by,
    participants
  })

  // reuse insert helper so insert logic/policies are consistent with edits
  if(splits.length > 0){
    const insertedSplits = await insertExpenseSplits(splits)
    return { expense, splits: insertedSplits }
  }

  return { expense, splits: [] }
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
  // Reconcile against recorded payments: if a payment exists that matches
  // a split (same payer, payee and amount), mark that split as paid so the
  // UI (which checks `s.status === 'paid'`) hides the Paid button on reload.
  try{
    const { data: payments, error: payErr } = await supabase
      .from('payments')
      .select('paid_by, paid_to, amount')
      .eq('activity_id', activity_id)

    if(!payErr && payments && payments.length > 0){
      data.forEach(exp => {
        (exp.expense_splits || []).forEach(s => {
          if(s.status === 'paid') return
          const owedToId = s.owed_to && (s.owed_to.id || s.owed_to)
          const userId = s.user_id
          const match = payments.find(p => p.paid_by === userId && p.paid_to === owedToId && Number(p.amount) === Number(s.amount))
          if(match) s.status = 'paid'
        })
      })
    }
  }catch(_){ /* non-fatal: ignore payment reconciliation errors */ }

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

export async function deleteExpense(expense_id){
  // Prefer calling a SECURITY DEFINER RPC that deletes expense + splits
  try{
    const { data, error } = await supabase.rpc('delete_expense_and_splits', { eid: expense_id })
    if(error) throw error
    return data
  }catch(e){
    // Fallback to direct delete (may fail under RLS)
    const { data, error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', expense_id)
    if(error) throw error
    return data
  }
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

  // Also reconcile recorded payments so dashboard reflects transactions even
  // if splits weren't updated in the DB for some reason. Payments reduce the
  // outstanding totals for the payer/receiver.
  const { data: payments, error: payErr } = await supabase
    .from('payments')
    .select('paid_by, paid_to, amount')
    .or(`paid_by.eq.${user_id},paid_to.eq.${user_id}`)
  if(payErr) {
    // non-fatal: ignore payment reconciliation errors and return based on splits
    const sum = arr => arr.reduce((s, r) => s + Number(r.amount || 0), 0)
    return { you_are_owed: sum(owedData), you_owe: sum(oweData) }
  }

  const sum = arr => arr.reduce((s, r) => s + Number(r.amount || 0), 0)
  const pendingYouAreOwed = sum(owedData)
  const pendingYouOwe = sum(oweData)

  // Sum of payments received by user and payments made by user
  const paymentsReceived = payments.filter(p => p.paid_to === user_id).reduce((s, p) => s + Number(p.amount || 0), 0)
  const paymentsMade = payments.filter(p => p.paid_by === user_id).reduce((s, p) => s + Number(p.amount || 0), 0)

  // Adjust pending totals by payments; ensure we don't go negative
  const you_are_owed = Math.max(0, pendingYouAreOwed - paymentsReceived)
  const you_owe = Math.max(0, pendingYouOwe - paymentsMade)

  return { you_are_owed, you_owe }
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
