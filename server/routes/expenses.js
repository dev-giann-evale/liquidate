const express = require('express')
const router = express.Router()
const db = require('../db')
const auth = require('../middleware/auth')

// POST /api/expenses - create expense and equal splits
router.post('/', auth, async (req, res) => {
  const { activity_id, title, total_amount, paid_by, created_by, participants } = req.body
  if(!activity_id || !title || !total_amount || !paid_by || !participants) return res.status(400).json({ error: 'missing fields' })

  const totalCents = Math.round(Number(total_amount) * 100)
  if(Number.isNaN(totalCents) || totalCents <= 0) return res.status(400).json({ error: 'invalid amount' })

  const normalized = Array.from(new Set(participants.filter(Boolean)))
  if(normalized.length === 0) return res.status(400).json({ error: 'no participants' })

  const baseShare = Math.floor(totalCents / normalized.length)
  const remainder = totalCents % normalized.length

  const client = await db.pool.connect()
  try{
    await client.query('BEGIN')
    const insertExpense = 'insert into expenses (activity_id, title, amount, total_amount, paid_by, created_by) values ($1,$2,$3,$4,$5,$6) returning *'
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
    const insertSplitsSql = `insert into expense_splits (expense_id, "user", owed_to, amount, status) values ${valuesSql} returning *`
    const { rows: splitRows } = await client.query(insertSplitsSql, flat)

    await client.query('COMMIT')
    res.json({ expense, splits: splitRows })
  }catch(err){
    await client.query('ROLLBACK')
    console.error('create expense error', err)
    res.status(500).json({ error: 'server_error' })
  }finally{
    client.release()
  }
})

// PUT /api/expenses/:id - update expense and optionally replace splits
router.put('/:id', auth, async (req, res) => {
  const expenseId = req.params.id
  const { title, total_amount, paid_by, participants } = req.body
  const client = await db.pool.connect()
  try{
    await client.query('BEGIN')
    // update expense fields if provided
    const updFields = []
    const vals = []
    let idx = 1
    if(title !== undefined){ updFields.push(`title = $${idx++}`); vals.push(title) }
    if(total_amount !== undefined){ updFields.push(`total_amount = $${idx++}`); vals.push(total_amount); updFields.push(`amount = $${idx++}`); vals.push(total_amount) }
    if(paid_by !== undefined){ updFields.push(`paid_by = $${idx++}`); vals.push(paid_by) }
    if(updFields.length > 0){
      const sql = `update expenses set ${updFields.join(', ')}, updated_at = now() where id = $${idx} returning *`
      vals.push(expenseId)
      const { rows } = await client.query(sql, vals)
      // eslint-disable-next-line prefer-destructuring
      var expense = rows[0]
    }else{
      const { rows } = await client.query('select * from expenses where id = $1', [expenseId])
      var expense = rows[0]
    }

    let splitRows = []
    if(Array.isArray(participants)){
      // delete existing splits
      await client.query('delete from expense_splits where expense_id = $1', [expenseId])

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
        const insertSplitsSql = `insert into expense_splits (expense_id, "user", owed_to, amount, status) values ${valuesSql} returning *`
        const resSplits = await client.query(insertSplitsSql, flat)
        splitRows = resSplits.rows
      }
    }else{
      const { rows } = await client.query('select * from expense_splits where expense_id = $1', [expenseId])
      splitRows = rows
    }

    await client.query('COMMIT')
    res.json({ expense, splits: splitRows })
  }catch(err){
    await client.query('ROLLBACK')
    console.error('update expense error', err)
    res.status(500).json({ error: 'server_error' })
  }finally{
    client.release()
  }
})

// DELETE /api/expenses/:id - delete expense and splits
router.delete('/:id', auth, async (req, res) => {
  const expenseId = req.params.id
  const client = await db.pool.connect()
  try{
    await client.query('BEGIN')
    await client.query('delete from expense_splits where expense_id = $1', [expenseId])
    const { rows } = await client.query('delete from expenses where id = $1 returning *', [expenseId])
    await client.query('COMMIT')
    res.json(rows[0] || null)
  }catch(err){
    await client.query('ROLLBACK')
    console.error('delete expense error', err)
    res.status(500).json({ error: 'server_error' })
  }finally{
    client.release()
  }
})

// DELETE /api/expenses/:id/splits - delete splits for an expense (preserve expense row)
router.delete('/:id/splits', auth, async (req, res) => {
  const expenseId = req.params.id
  try{
    const { rows } = await db.query('delete from expense_splits where expense_id = $1 returning *', [expenseId])
    res.json(rows || [])
  }catch(err){
    console.error('delete splits error', err)
    res.status(500).json({ error: 'server_error' })
  }
})

// POST /api/expenses/:id/splits - insert multiple splits for an expense
router.post('/:id/splits', auth, async (req, res) => {
  const expenseId = req.params.id
  const { splits } = req.body
  if(!Array.isArray(splits)) return res.status(400).json({ error: 'invalid_splits' })
  // each split should have: user_id, owed_to, amount, status (optional)
  const values = []
  const placeholders = splits.map((s, i) => {
    const idx = i*5
    values.push(expenseId, s.user_id, s.owed_to, s.amount, s.status || 'pending')
    return `($${idx+1},$${idx+2},$${idx+3},$${idx+4},$${idx+5})`
  }).join(',')
  if(values.length === 0) return res.json([])
  const sql = `insert into expense_splits (expense_id, "user", owed_to, amount, status) values ${placeholders} returning *`
  try{
    const { rows } = await db.query(sql, values)
    res.json(rows)
  }catch(err){
    console.error('insert splits error', err)
    res.status(500).json({ error: 'server_error' })
  }
})

module.exports = router


