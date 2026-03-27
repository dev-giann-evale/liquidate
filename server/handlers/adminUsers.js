const db = require('../db')
const bcrypt = require('bcryptjs')

async function ensureSuperAdmin(userId){
  if(!userId) return false
  const { rows } = await db.query('select role from liquidate_users where id = $1', [userId])
  return rows && rows[0] && rows[0].role === 'super_admin'
}

async function listUsers({ user }){
  if(!user) return { status: 401, json: { error: 'unauthorized' } }
  const ok = await ensureSuperAdmin(user.sub || user.id)
  if(!ok) return { status: 403, json: { error: 'forbidden' } }

  const sql = `select u.id, u.email, u.role, p.first_name, p.last_name from liquidate_users u left join liquidate_profiles p on p.id = u.id order by p.email nulls last, u.email`;
  const { rows } = await db.query(sql)
  return { status: 200, json: rows }
}

async function updateUser({ user, params, body }){
  if(!user) return { status: 401, json: { error: 'unauthorized' } }
  const ok = await ensureSuperAdmin(user.sub || user.id)
  if(!ok) return { status: 403, json: { error: 'forbidden' } }

  const id = params.id
  const { email, first_name, last_name, role, password } = body || {}
  const client = db.pool
  const conn = await client.connect()
  try{
    await conn.query('BEGIN')
    if(typeof role !== 'undefined'){
      await conn.query('update liquidate_users set role = $1 where id = $2', [role, id])
    }
    if(typeof password === 'string' && password.length > 0){
      const hash = await bcrypt.hash(password, 10)
      await conn.query('update liquidate_users set password_hash = $1 where id = $2', [hash, id])
    }
    if(typeof email !== 'undefined'){
      await conn.query('update liquidate_users set email = $1 where id = $2', [email, id])
      await conn.query('update liquidate_profiles set email = $1 where id = $2', [email, id])
    }
    await conn.query('update liquidate_profiles set first_name = $1, last_name = $2 where id = $3', [first_name || null, last_name || null, id])
    await conn.query('COMMIT')
    return { status: 200, json: { ok: true } }
  }catch(err){
    await conn.query('ROLLBACK')
    console.error('admin update user failed', err)
    return { status: 500, json: { error: 'server_error' } }
  }finally{
    conn.release()
  }
}

module.exports = { listUsers, updateUser }
