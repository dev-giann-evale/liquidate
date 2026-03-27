const express = require('express')
const router = express.Router()
const db = require('../db')

// GET /api/profiles - list profiles; optional ?ids=csv
router.get('/', async (req, res) => {
  try{
    const ids = req.query.ids
    if(ids){
      const arr = ids.split(',')
      const placeholders = arr.map((_, i) => `$${i+1}`).join(',')
      const sql = `select id, first_name, last_name, email from profiles where id in (${placeholders})`;
      const { rows } = await db.query(sql, arr)
      return res.json(rows)
    }
    const { rows } = await db.query('select id, first_name, last_name, email from profiles order by first_name')
    res.json(rows)
  }catch(err){
    console.error('profiles error', err)
    res.status(500).json({ error: 'server_error' })
  }
})

module.exports = router
