const db = require('../db')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')

const JWT_SECRET = process.env.AUTH_JWT_SECRET || 'dev-secret'

async function register({ body }){
  const { email, password, first_name, last_name } = body || {}
  if(!email || !password) return { status: 400, json: { error: 'missing email or password' } }
  const password_hash = await bcrypt.hash(password, 10)
  const insertUserSql = 'insert into liquidate_users (email, password_hash) values ($1,$2) returning id, email, role'
  const { rows: userRows } = await db.query(insertUserSql, [email, password_hash])
  const user = userRows[0]
  await db.query('insert into liquidate_profiles (id, first_name, last_name, email) values ($1,$2,$3,$4)', [user.id, first_name || null, last_name || null, email])
  const token = jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' })
  return { status: 200, json: { token, user: { id: user.id, email: user.email, role: user.role } } }
}

async function login({ body }){
  const { email, password } = body || {}
  if(!email || !password) return { status: 400, json: { error: 'missing email or password' } }
  const { rows } = await db.query('select id, email, password_hash, role from liquidate_users where email = $1', [email])
  const user = rows[0]
  if(!user) return { status: 401, json: { error: 'invalid_credentials' } }
  const ok = await bcrypt.compare(password, user.password_hash)
  if(!ok) return { status: 401, json: { error: 'invalid_credentials' } }
  const token = jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' })
  const { rows: profiles } = await db.query('select id, first_name, last_name, email from liquidate_profiles where id = $1', [user.id])
  const profile = profiles[0]
  return { status: 200, json: { token, user: { id: user.id, email: user.email, profile, role: user.role } } }
}

async function me({ user }){
  if(!user) return { status: 401, json: { error: 'unauthorized' } }
  const userId = user.sub || user.id
  if(!userId) return { status: 401, json: { error: 'unauthorized' } }
  const { rows: profiles } = await db.query('select id, first_name, last_name, email from liquidate_profiles where id = $1', [userId])
  const profile = profiles[0]
  // include role from users table
  const { rows: userRows } = await db.query('select role from liquidate_users where id = $1', [userId])
  const role = userRows[0] ? userRows[0].role : null
  return { status: 200, json: { user: { id: userId, email: user.email, profile, role } } }
}

async function updatePassword({ user, body }){
  if(!user) return { status: 401, json: { error: 'unauthorized' } }
  const { password } = body || {}
  if(!password || password.length < 6) return { status: 400, json: { error: 'invalid_password' } }
  const hash = await bcrypt.hash(password, 10)
  await db.query('update liquidate_users set password_hash = $1 where id = $2', [hash, user.sub || user.id])
  return { status: 200, json: { ok: true } }
}

module.exports = { register, login, me, updatePassword }
