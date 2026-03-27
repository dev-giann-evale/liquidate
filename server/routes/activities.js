const express = require('express')
const router = express.Router()
const db = require('../db')
const auth = require('../middleware/auth')

// GET /api/activities/:id - get activity
router.get('/:id', async (req, res) => {
  const id = req.params.id
  try{
    const { rows } = await db.query('select * from activities where id = $1', [id])
    if(rows.length === 0) return res.status(404).json({ error: 'not_found' })
    res.json(rows[0])
  }catch(err){
    console.error(err)
    res.status(500).json({ error: 'server_error' })
  }
})

// GET /api/activities - optional ?ids=csv to fetch multiple activities (id, name, description)
router.get('/', async (req, res) => {
  try{
    const ids = req.query.ids
    if(ids){
      const arr = ids.split(',')
      const placeholders = arr.map((_, i) => `$${i+1}`).join(',')
      const sql = `select id, name, description from activities where id in (${placeholders})`
      const { rows } = await db.query(sql, arr)
      return res.json(rows)
    }
    // otherwise list recent activities (safe default)
    const { rows } = await db.query('select id, name, description, created_at from activities order by created_at desc limit 50')
    res.json(rows)
  }catch(err){
    console.error('activities list error', err)
    res.status(500).json({ error: 'server_error' })
  }
})

// PUT /api/activities/:id - update activity (name, description)
const auth = require('../middleware/auth')
router.put('/:id', auth, async (req, res) => {
  const id = req.params.id
  const { name, description } = req.body
  try{
    const sql = 'update activities set name = $1, description = $2, updated_at = now() where id = $3 returning *'
    const { rows } = await db.query(sql, [name, description, id])
    res.json(rows[0] || null)
  }catch(err){
    console.error('update activity error', err)
    res.status(500).json({ error: 'server_error' })
  }
})

// GET /api/activities/:id/expenses - list expenses for activity with nested splits
router.get('/:id/expenses', async (req, res) => {
  const id = req.params.id
  try{
    const sql = `select e.id, e.title, e.amount, e.activity_id, e.created_at, e.updated_at,
      json_build_object('id', pb.id, 'first_name', pb.first_name, 'last_name', pb.last_name) as paid_by,
      json_build_object('id', pc.id, 'first_name', pc.first_name, 'last_name', pc.last_name) as created_by,
      (select coalesce(json_agg(row_to_json(es)), '[]'::json) from (
        select s.id, s.expense_id, s.user, s.owed_to, s.amount,
               u.id as user_id, u.first_name as user_first, u.last_name as user_last,
               ot.id as owed_to_id, ot.first_name as owed_to_first, ot.last_name as owed_to_last
        from expense_splits s
        left join profiles u on s.user = u.id
        left join profiles ot on s.owed_to = ot.id
        where s.expense_id = e.id
      ) es) as expense_splits
      from expenses e
      left join profiles pb on e.paid_by = pb.id
      left join profiles pc on e.created_by = pc.id
      where e.activity_id = $1
      order by e.created_at desc`;
    const { rows } = await db.query(sql, [id])
    res.json(rows)
  }catch(err){
    console.error(err)
    res.status(500).json({ error: 'server_error' })
  }
})

// GET /api/activities/:id/members - list member profiles for activity
router.get('/:id/members', async (req, res) => {
  const activityId = req.params.id
  try{
    const sql = `select p.id, p.first_name, p.last_name, p.email from activity_members m join profiles p on m.user_id = p.id where m.activity_id = $1 order by p.first_name`;
    const { rows } = await db.query(sql, [activityId])
    res.json(rows)
  }catch(err){
    console.error('members fetch error', err)
    res.status(500).json({ error: 'server_error' })
  }
})

module.exports = router
