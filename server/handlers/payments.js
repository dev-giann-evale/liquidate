const db = require('../db')

async function listPayments({ query }){
  const userId = query.user_id
  if(!userId) return { status: 400, json: { error: 'missing user_id' } }
  const sql = `select p.*, pb.id as paid_by_id, pt.id as paid_to_id, pt.first_name as paid_to_first, pt.last_name as paid_to_last
      from liquidate_payments p
      left join liquidate_profiles pt on p.paid_to = pt.id
      left join liquidate_profiles pb on p.paid_by = pb.id
      where p.paid_by = $1 or p.paid_to = $1
      order by p.created_at desc`;
  const { rows } = await db.query(sql, [userId])
  return { status: 200, json: rows }
}

async function recordPayment({ body }){
  const { activity_id, split_id, paid_by, paid_to, amount, payment_date } = body || {}
  if(!activity_id || !split_id || !paid_by || !paid_to || !amount) return { status: 400, json: { error: 'missing fields' } }
  const client = await db.pool.connect()
  try{
    await client.query('BEGIN')
    const upd = 'update liquidate_expense_splits set status = $1 where id = $2 returning *'
    await client.query(upd, ['paid', split_id])
    const ins = 'insert into liquidate_payments (activity_id, paid_by, paid_to, amount, payment_date) values ($1,$2,$3,$4,$5) returning *'
    const { rows } = await client.query(ins, [activity_id, paid_by, paid_to, amount, payment_date || new Date()])
    await client.query('COMMIT')
    return { status: 200, json: rows[0] }
  }catch(err){
    await client.query('ROLLBACK')
    throw err
  }finally{
    client.release()
  }
}

module.exports = { listPayments, recordPayment }
