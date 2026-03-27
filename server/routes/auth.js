const express = require('express')
const router = express.Router()
const db = require('../db')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')

const JWT_SECRET = process.env.AUTH_JWT_SECRET || 'dev-secret'

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { email, password, first_name, last_name } = req.body
  if(!email || !password) return res.status(400).json({ error: 'missing email or password' })
  try{
    // create user row (id generated)
    const password_hash = await bcrypt.hash(password, 10)
    const insertUserSql = 'insert into users (email, password_hash) values ($1,$2) returning id, email'
    const { rows: userRows } = await db.query(insertUserSql, [email, password_hash])
    const user = userRows[0]

    // create profile
    await db.query('insert into profiles (id, first_name, last_name, email) values ($1,$2,$3,$4)', [user.id, first_name || null, last_name || null, email])

    const token = jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' })
    res.json({ token, user: { id: user.id, email: user.email } })
  }catch(err){
    console.error('register error', err)
    res.status(500).json({ error: 'server_error' })
  }
})

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body
  if(!email || !password) return res.status(400).json({ error: 'missing email or password' })
  try{
    const { rows } = await db.query('select id, email, password_hash from users where email = $1', [email])
    const user = rows[0]
    if(!user) return res.status(401).json({ error: 'invalid_credentials' })
    const ok = await bcrypt.compare(password, user.password_hash)
    if(!ok) return res.status(401).json({ error: 'invalid_credentials' })
    const token = jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' })
    // fetch profile
    const { rows: profiles } = await db.query('select id, first_name, last_name, email from profiles where id = $1', [user.id])
    const profile = profiles[0]
    res.json({ token, user: { id: user.id, email: user.email, profile } })
  }catch(err){
    console.error('login error', err)
    res.status(500).json({ error: 'server_error' })
  }
})

// GET /api/auth/me - return current user based on Authorization header
const auth = require('../middleware/auth')
router.get('/me', auth, async (req, res) => {
  try{
    const user = req.user
    if(!user) return res.status(401).json({ error: 'unauthorized' })
    // user.sub is expected to be the user id
    const userId = user.sub || user.id
    if(!userId) return res.status(401).json({ error: 'unauthorized' })
    const { rows: profiles } = await db.query('select id, first_name, last_name, email from profiles where id = $1', [userId])
    const profile = profiles[0]
    return res.json({ user: { id: userId, email: user.email, profile } })
  }catch(err){
    console.error('me route error', err)
    res.status(500).json({ error: 'server_error' })
  }
})

  // POST /api/auth/update-password
  const auth = require('../middleware/auth')
  router.post('/update-password', auth, async (req, res) => {
    const user = req.user
    const { password } = req.body
    if(!user) return res.status(401).json({ error: 'unauthorized' })
    if(!password || password.length < 6) return res.status(400).json({ error: 'invalid_password' })
    try{
      const hash = await bcrypt.hash(password, 10)
      await db.query('update users set password_hash = $1 where id = $2', [hash, user.sub || user.id])
      res.json({ ok: true })
    }catch(err){
      console.error('update password error', err)
      res.status(500).json({ error: 'server_error' })
    }
  })

module.exports = router

