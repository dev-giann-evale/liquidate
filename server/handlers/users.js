const db = require('../db')

async function activities({ params }){
  const { rows } = await db.query(`select a.* from liquidate_activity_members m join liquidate_activities a on m.activity_id = a.id where m.user_id = $1 order by a.created_at desc`, [params.id])
  return { status: 200, json: rows }
}

async function splits({ params }){
  const sql = `select s.*, e.title, e.activity_id from liquidate_expense_splits s left join liquidate_expenses e on s.expense_id = e.id where s.user_id = $1 order by s.created_at desc`
  const { rows } = await db.query(sql, [params.id])
  return { status: 200, json: rows }
}

async function dashboard({ params }){
  const uid = params.id
  const owedSql = `select coalesce(sum(amount),0) as total from liquidate_expense_splits where owed_to = $1 and status = 'pending'`
  const oweSql = `select coalesce(sum(amount),0) as total from liquidate_expense_splits where user_id = $1 and status = 'pending'`
  const { rows: owedRows } = await db.query(owedSql, [uid])
  const { rows: oweRows } = await db.query(oweSql, [uid])
  const paymentsSql = `select paid_by, paid_to, amount from liquidate_payments where paid_by = $1 or paid_to = $1`
  const { rows: payments } = await db.query(paymentsSql, [uid])
  const sum = r => Number(r[0]?.total || 0)
  const pendingYouAreOwed = sum(owedRows)
  const pendingYouOwe = sum(oweRows)
  const paymentsReceived = payments.filter(p => p.paid_to === uid).reduce((s,p)=>s+Number(p.amount||0),0)
  const paymentsMade = payments.filter(p => p.paid_by === uid).reduce((s,p)=>s+Number(p.amount||0),0)
  const you_are_owed = Math.max(0, pendingYouAreOwed - paymentsReceived)
  const you_owe = Math.max(0, pendingYouOwe - paymentsMade)
  return { status: 200, json: { you_are_owed, you_owe } }
}

module.exports = { activities, splits, dashboard }
