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

function authHeaders(){
  const token = localStorage.getItem('auth_token')
  return token ? { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` } : { 'Content-Type': 'application/json' }
}

async function handleJsonResponse(resp){
  if(!resp.ok){
    const payload = await resp.json().catch(()=>({ error: 'server_error' }))
    throw new Error(payload.error || 'server_error')
  }
  return resp.json()
}

export async function getProfileById(userId){
  const resp = await fetch(`/api/profiles/${encodeURIComponent(userId)}`)
  return handleJsonResponse(resp)
}

export async function updateProfile(userId, fields = {}){
  const resp = await fetch(`/api/profiles/${encodeURIComponent(userId)}`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(fields) })
  return handleJsonResponse(resp)
}

// Activities
export async function createActivity({ name, description, created_by }){
  const resp = await fetch('/api/activities', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ name, description, created_by }) })
  return handleJsonResponse(resp)
}

export async function getUserActivities(userId){
  const resp = await fetch(`/api/users/${encodeURIComponent(userId)}/activities`)
  return handleJsonResponse(resp)
}

export async function addActivityMember(activity_id, user_id){
  const resp = await fetch('/api/members', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ activity_id, user_id }) })
  return handleJsonResponse(resp)
}

// Expenses + splitting logic
export async function createExpense({ activity_id, title, total_amount, paid_by, created_by, participants }){
  // Validate split input before creating the expense row.
  buildExpenseSplits({ expense_id: '__preview__', total_amount, paid_by, participants })
  const resp = await fetch('/api/expenses', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ activity_id, title, total_amount, paid_by, created_by, participants })
  })
  return handleJsonResponse(resp)
}

export async function getActivityExpenses(activity_id){
  const resp = await fetch(`/api/activities/${encodeURIComponent(activity_id)}/expenses`)
  return handleJsonResponse(resp)
}

export async function updateExpense(expense_id, fields = {}){
  const resp = await fetch(`/api/expenses/${encodeURIComponent(expense_id)}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(fields)
  })
  return handleJsonResponse(resp)
}

export async function deleteExpenseSplitsByExpense(expense_id){
  // DELETE splits for an expense (preserve expense row)
  const resp = await fetch(`/api/expenses/${encodeURIComponent(expense_id)}/splits`, { method: 'DELETE', headers: authHeaders() })
  return handleJsonResponse(resp)
}

export async function deleteExpense(expense_id){
  const resp = await fetch(`/api/expenses/${encodeURIComponent(expense_id)}`, { method: 'DELETE', headers: authHeaders() })
  return handleJsonResponse(resp)
}

export async function insertExpenseSplits(splits = []){
  if(!splits || splits.length === 0) return []
  // expect splits to be an array of objects with expense_id, user_id, owed_to, amount, status
  const expenseId = splits[0].expense_id
  const resp = await fetch(`/api/expenses/${encodeURIComponent(expenseId)}/splits`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ splits }) })
  return handleJsonResponse(resp)
}

export async function getActivityById(activity_id){
  const resp = await fetch(`/api/activities/${encodeURIComponent(activity_id)}`)
  return handleJsonResponse(resp)
}

export async function updateActivity(activity_id, fields = {}){
  const resp = await fetch(`/api/activities/${encodeURIComponent(activity_id)}`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(fields) })
  return handleJsonResponse(resp)
}

export async function getActivityMembers(activity_id){
  const resp = await fetch(`/api/activities/${encodeURIComponent(activity_id)}/members`)
  return handleJsonResponse(resp)
}

export async function getMembersForActivities(ids = []){
  if(!ids || ids.length === 0) return []
  const q = ids.join(',')
  const resp = await fetch(`/api/activities?ids=${encodeURIComponent(q)}`)
  return handleJsonResponse(resp)
}

// Dashboard totals for a user
export async function getDashboardTotals(user_id){
  const resp = await fetch(`/api/users/${encodeURIComponent(user_id)}/dashboard`)
  return handleJsonResponse(resp)
}

// Record a payment: mark split paid and insert audit record
export async function recordPayment({ activity_id, split_id, paid_by, paid_to, amount, payment_date }){
  const resp = await fetch('/api/payments', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ activity_id, split_id, paid_by, paid_to, amount, payment_date }) })
  return handleJsonResponse(resp)
}

export async function getPayments(user_id){
  const resp = await fetch(`/api/payments?user_id=${encodeURIComponent(user_id)}`)
  return handleJsonResponse(resp)
}

export async function getMyExpenseSplits(user_id){
  const resp = await fetch(`/api/users/${encodeURIComponent(user_id)}/splits`)
  return handleJsonResponse(resp)
}

export async function getProfilesByIds(ids = []){
  if(!ids || ids.length === 0) return []
  const q = ids.join(',')
  const resp = await fetch(`/api/profiles?ids=${encodeURIComponent(q)}`)
  return handleJsonResponse(resp)
}

export async function getAllProfiles(){
  const resp = await fetch('/api/profiles')
  return handleJsonResponse(resp)
}

export async function removeActivityMember(activity_id, user_id){
  const resp = await fetch('/api/members', { method: 'DELETE', headers: authHeaders(), body: JSON.stringify({ activity_id, user_id }) })
  return handleJsonResponse(resp)
}

export async function getActivitiesByIds(ids = []){
  if(!ids || ids.length === 0) return []
  const q = ids.join(',')
  const resp = await fetch(`/api/activities?ids=${encodeURIComponent(q)}`)
  return handleJsonResponse(resp)
}

