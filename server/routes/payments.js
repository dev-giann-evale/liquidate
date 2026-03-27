const express = require('express')
const router = express.Router()
const db = require('../db')
const auth = require('../middleware/auth')

// GET /api/payments?user_id=<id> - list payments for user
router.get('/', async (req, res) => {
  const userId = req.query.user_id
  if(!userId) return res.status(400).json({ error: 'missing user_id' })
  try{
    const sql = `select p.*, pb.id as paid_by_id, pt.id as paid_to_id, pt.first_name as paid_to_first, pt.last_name as paid_to_last
      from payments p
      left join profiles pt on p.paid_to = pt.id
      left join profiles pb on p.paid_by = pb.id
      where p.paid_by = $1 or p.paid_to = $1
      order by p.created_at desc`;
    const { rows } = await db.query(sql, [userId])
    res.json(rows)
  }catch(err){
    console.error(err)
    res.status(500).json({ error: 'server_error' })
  }
})

// POST /api/payments - record a payment and mark split paid
router.post('/', auth, async (req, res) => {
  const { activity_id, split_id, paid_by, paid_to, amount, payment_date } = req.body
  if(!activity_id || !split_id || !paid_by || !paid_to || !amount) return res.status(400).json({ error: 'missing fields' })
  const client = await db.pool.connect()
  try{
    await client.query('BEGIN')
    const upd = 'update expense_splits set status = $1 where id = $2 returning *'
    await client.query(upd, ['paid', split_id])
    const ins = 'insert into payments (activity_id, paid_by, paid_to, amount, payment_date) values ($1,$2,$3,$4,$5) returning *'
    const { rows } = await client.query(ins, [activity_id, paid_by, paid_to, amount, payment_date || new Date()])
    await client.query('COMMIT')
    res.json(rows[0])
  }catch(err){
    await client.query('ROLLBACK')
    console.error('record payment error', err)
    res.status(500).json({ error: 'server_error' })
  }finally{
    client.release()
  }
})

module.exports = router
