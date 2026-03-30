const db = require('../db')

async function getActivity({ params }){
  const id = params.id
  const { rows } = await db.query('select * from liquidate_activities where id = $1', [id])
  if(rows.length === 0) return { status: 404, json: { error: 'activities_not_found' } }
  return { status: 200, json: rows[0] }
}

async function listActivities({ query }){
  const ids = query.ids
  if(ids){
    const arr = ids.split(',')
    const placeholders = arr.map((_, i) => `$${i+1}`).join(',')
    const sql = `select id, name, description from liquidate_activities where id in (${placeholders})`
    const { rows } = await db.query(sql, arr)
    return { status: 200, json: rows }
  }
  const { rows } = await db.query('select id, name, description, created_at from liquidate_activities order by created_at desc limit 50')
  return { status: 200, json: rows }
}

async function updateActivity({ params, body }){
  const id = params.id
  const { name, description } = body || {}
  const sql = 'update liquidate_activities set name = $1, description = $2, updated_at = now() where id = $3 returning *'
  const { rows } = await db.query(sql, [name, description, id])
  return { status: 200, json: rows[0] || null }
}

async function getActivityExpenses({ params }){
  const id = params.id
  const sql = `select e.id, e.title, e.amount, e.activity_id, e.created_at, e.updated_at,
      json_build_object('id', pb.id, 'first_name', pb.first_name, 'last_name', pb.last_name) as paid_by,
      json_build_object('id', pc.id, 'first_name', pc.first_name, 'last_name', pc.last_name) as created_by,
      (select coalesce(json_agg(row_to_json(es)), '[]'::json) from (
   select s.id, s.expense_id, s.user_id, s.owed_to, s.amount,
     u.id as user_id, u.first_name as user_first, u.last_name as user_last,
     ot.id as owed_to_id, ot.first_name as owed_to_first, ot.last_name as owed_to_last
   from liquidate_expense_splits s
   left join liquidate_profiles u on s.user_id = u.id
   left join liquidate_profiles ot on s.owed_to = ot.id
        where s.expense_id = e.id
      ) es) as expense_splits
      from liquidate_expenses e
      left join liquidate_profiles pb on e.paid_by = pb.id
      left join liquidate_profiles pc on e.created_by = pc.id
      where e.activity_id = $1
      order by e.created_at desc`;
  const { rows } = await db.query(sql, [id])
  return { status: 200, json: rows }
}

async function listActivityMembers({ params }){
  const activityId = params.id
  const sql = `select p.id, p.first_name, p.last_name, p.email from liquidate_activity_members m join liquidate_profiles p on m.user_id = p.id where m.activity_id = $1 order by p.first_name`;
  const { rows } = await db.query(sql, [activityId])
  return { status: 200, json: rows }
}

async function createActivity({ body }){
  const { name, description, created_by } = body || {}
  if(!name) return { status: 400, json: { error: 'missing name' } }
  const sql = 'insert into liquidate_activities (name, description, created_by) values ($1,$2,$3) returning *'
  const { rows } = await db.query(sql, [name, description || null, created_by || null])
  return { status: 200, json: rows[0] }
}

module.exports = { getActivity, listActivities, updateActivity, getActivityExpenses, listActivityMembers, createActivity }
