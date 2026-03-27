const express = require('express')
const router = express.Router()
const db = require('../db')
const auth = require('../middleware/auth')

// POST /api/members - add a member to activity
router.post('/', auth, async (req, res) => {
  const { activity_id, user_id } = req.body
  if(!activity_id || !user_id) return res.status(400).json({ error: 'missing activity_id or user_id' })
  try{
  const sql = `insert into liquidate_activity_members (activity_id, user_id) values ($1, $2) returning *`
    const { rows } = await db.query(sql, [activity_id, user_id])
    res.json(rows[0])
  }catch(err){
    console.error(err)
    res.status(500).json({ error: 'server_error' })
  }
})

// DELETE /api/members - remove a member
router.delete('/', auth, async (req, res) => {
  const { activity_id, user_id } = req.body
  if(!activity_id || !user_id) return res.status(400).json({ error: 'missing activity_id or user_id' })
  try{
  const sql = `delete from liquidate_activity_members where activity_id = $1 and user_id = $2 returning *`
    const { rows } = await db.query(sql, [activity_id, user_id])
    res.json(rows[0] || null)
  }catch(err){
    console.error(err)
    res.status(500).json({ error: 'server_error' })
  }
})

module.exports = router
