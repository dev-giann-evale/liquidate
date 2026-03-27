const db = require('../db')

async function listProfiles({ query }){
  const ids = query.ids
  if(ids){
    const arr = ids.split(',')
    const placeholders = arr.map((_, i) => `$${i+1}`).join(',')
    const sql = `select id, first_name, last_name, email from liquidate_profiles where id in (${placeholders})`
    const { rows } = await db.query(sql, arr)
    return { status: 200, json: rows }
  }
  const { rows } = await db.query('select id, first_name, last_name, email from liquidate_profiles order by first_name')
  return { status: 200, json: rows }
}

module.exports = { listProfiles }
