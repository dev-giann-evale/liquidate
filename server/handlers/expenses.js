const db = require('../db')

async function createExpense({ body }){
  const { activity_id, title, total_amount, paid_by, created_by, participants } = body || {}
  if(!activity_id || !title || !total_amount || !paid_by || !participants) return { status: 400, json: { error: 'missing fields' } }
  const totalCents = Math.round(Number(total_amount) * 100)
  if(Number.isNaN(totalCents) || totalCents <= 0) return { status: 400, json: { error: 'invalid amount' } }
  const normalized = Array.from(new Set(participants.filter(Boolean)))
  if(normalized.length === 0) return { status: 400, json: { error: 'no participants' } }
  const baseShare = Math.floor(totalCents / normalized.length)
  const remainder = totalCents % normalized.length
  const client = await db.pool.connect()
  try{
    await client.query('BEGIN')
    const insertExpense = 'insert into liquidate_expenses (activity_id, title, amount, total_amount, paid_by, created_by) values ($1,$2,$3,$4,$5,$6) returning *'
    const { rows: expRows } = await client.query(insertExpense, [activity_id, title, total_amount, total_amount, paid_by, created_by])
    const expense = expRows[0]
    const splits = []
    for(let i=0;i<normalized.length;i++){
      const userId = normalized[i]
      const cents = baseShare + (i < remainder ? 1 : 0)
      splits.push([expense.id, userId, paid_by, (cents/100).toFixed(2), 'pending'])
    }
    const valuesSql = splits.map((_, idx) => `($${idx*5+1},$${idx*5+2},$${idx*5+3},$${idx*5+4},$${idx*5+5})`).join(',')
    const flat = splits.flat()
    const insertSplitsSql = `insert into liquidate_expense_splits (expense_id, user_id, owed_to, amount, status) values ${valuesSql} returning *`
    const { rows: splitRows } = await client.query(insertSplitsSql, flat)
    await client.query('COMMIT')
    return { status: 200, json: { expense, splits: splitRows } }
  }catch(err){
    await client.query('ROLLBACK')
    throw err
  }finally{
    client.release()
  }
}

async function updateExpense({ params, body }){
  const expenseId = params.id
  const { title, total_amount, paid_by, participants } = body || {}
  const client = await db.pool.connect()
  try{
    await client.query('BEGIN')
    const updFields = []
    const vals = []
    let idx = 1
    if(title !== undefined){ updFields.push(`title = $${idx++}`); vals.push(title) }
    if(total_amount !== undefined){ updFields.push(`total_amount = $${idx++}`); vals.push(total_amount); updFields.push(`amount = $${idx++}`); vals.push(total_amount) }
    if(paid_by !== undefined){ updFields.push(`paid_by = $${idx++}`); vals.push(paid_by) }
    let expense
    if(updFields.length > 0){
      const sql = `update liquidate_expenses set ${updFields.join(', ')}, updated_at = now() where id = $${idx} returning *`
      vals.push(expenseId)
      const { rows } = await client.query(sql, vals)
      expense = rows[0]
    }else{
      const { rows } = await client.query('select * from liquidate_expenses where id = $1', [expenseId])
      expense = rows[0]
    }
    let splitRows = []
    if(Array.isArray(participants)){
      await client.query('delete from liquidate_expense_splits where expense_id = $1', [expenseId])
      const totalCents = Math.round(Number(total_amount || expense.total_amount) * 100)
      const normalized = Array.from(new Set(participants.filter(Boolean)))
      const baseShare = Math.floor(totalCents / normalized.length)
      const remainder = totalCents % normalized.length
      const splits = []
      for(let i=0;i<normalized.length;i++){
        const userId = normalized[i]
        const cents = baseShare + (i < remainder ? 1 : 0)
        splits.push([expenseId, userId, paid_by || expense.paid_by, (cents/100).toFixed(2), 'pending'])
      }
      if(splits.length > 0){
        const valuesSql = splits.map((_, idx) => `($${idx*5+1},$${idx*5+2},$${idx*5+3},$${idx*5+4},$${idx*5+5})`).join(',')
        const flat = splits.flat()
        const insertSplitsSql = `insert into liquidate_expense_splits (expense_id, user_id, owed_to, amount, status) values ${valuesSql} returning *`
        const resSplits = await client.query(insertSplitsSql, flat)
        splitRows = resSplits.rows
      }
    }else{
      const { rows } = await client.query('select * from liquidate_expense_splits where expense_id = $1', [expenseId])
      splitRows = rows
    }
    await client.query('COMMIT')
    return { status: 200, json: { expense, splits: splitRows } }
  }catch(err){
    await client.query('ROLLBACK')
    throw err
  }finally{
    client.release()
  }
}

async function deleteExpense({ params }){
  const expenseId = params.id
  const client = await db.pool.connect()
  try{
    await client.query('BEGIN')
    await client.query('delete from liquidate_expense_splits where expense_id = $1', [expenseId])
    const { rows } = await client.query('delete from liquidate_expenses where id = $1 returning *', [expenseId])
    await client.query('COMMIT')
    return { status: 200, json: rows[0] || null }
  }catch(err){
    await client.query('ROLLBACK')
    throw err
  }finally{
    client.release()
  }
}

async function deleteExpenseSplits({ params }){
  const expenseId = params.id
  const { rows } = await db.query('delete from liquidate_expense_splits where expense_id = $1 returning *', [expenseId])
  return { status: 200, json: rows || [] }
}

async function insertExpenseSplits({ params, body }){
  const expenseId = params.id
  const { splits } = body || {}
  if(!Array.isArray(splits)) return { status: 400, json: { error: 'invalid_splits' } }
  const values = []
  const placeholders = splits.map((s, i) => {
    const idx = i*5
    values.push(expenseId, s.user_id, s.owed_to, s.amount, s.status || 'pending')
    return `($${idx+1},$${idx+2},$${idx+3},$${idx+4},$${idx+5})`
  }).join(',')
  if(values.length === 0) return { status: 200, json: [] }
  const sql = `insert into liquidate_expense_splits (expense_id, user_id, owed_to, amount, status) values ${placeholders} returning *`
  const { rows } = await db.query(sql, values)
  return { status: 200, json: rows }
}

module.exports = { createExpense, updateExpense, deleteExpense, deleteExpenseSplits, insertExpenseSplits }
