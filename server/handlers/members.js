const db = require('../db')

async function addMember({ body }){
  const { activity_id, user_id } = body || {}
  if(!activity_id || !user_id) return { status: 400, json: { error: 'missing activity_id or user_id' } }
  const sql = `insert into liquidate_activity_members (activity_id, user_id) values ($1, $2) returning *`
  const { rows } = await db.query(sql, [activity_id, user_id])
  return { status: 200, json: rows[0] }
}

async function removeMember({ body }){
  const { activity_id, user_id } = body || {}
  if(!activity_id || !user_id) return { status: 400, json: { error: 'missing activity_id or user_id' } }
  const sql = `delete from liquidate_activity_members where activity_id = $1 and user_id = $2 returning *`
  const { rows } = await db.query(sql, [activity_id, user_id])
  return { status: 200, json: rows[0] || null }
}

module.exports = { addMember, removeMember }
