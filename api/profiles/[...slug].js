const db = require('../../server/db')
const profilesHandler = require('../../server/handlers/profiles')

async function getJsonBody(req){
  if(req.body) return req.body
  return await new Promise((resolve) => {
    let buf = ''
    req.on('data', (c) => (buf += c))
    req.on('end', () => {
      try{ resolve(JSON.parse(buf || '{}')) }catch(e){ resolve({}) }
    })
    req.on('error', () => resolve({}))
  })
}

module.exports = async (req, res) => {
  const raw = (req.url || '').split('?')[0]
  const parts = raw.split('/').filter(Boolean)
  try{
    // GET /api/profiles -> list
    if(parts.length === 0 && req.method === 'GET'){
      // support GET /api/profiles?id=... to fetch a single profile by id
      if(req.query && req.query.id){
        const { rows } = await db.query('select id, first_name, last_name, email from liquidate_profiles where id = $1', [req.query.id])
        return res.status(200).json(rows[0] || null)
      }
      const r = await profilesHandler.listProfiles({ query: req.query || {} })
      return res.status(r.status||200).json(r.json||{})
    }

    // GET /api/profiles/:id
    const id = parts[0]
    if(parts.length === 1 && req.method === 'GET'){
      const { rows } = await db.query('select id, first_name, last_name, email from liquidate_profiles where id = $1', [id])
      return res.status(200).json(rows[0] || null)
    }

    // PUT /api/profiles/:id
    if(parts.length === 1 && req.method === 'PUT'){
      const body = await getJsonBody(req)
      const fields = []
      const vals = []
      let idx = 1
      if(body.first_name !== undefined){ fields.push(`first_name = $${idx++}`); vals.push(body.first_name) }
      if(body.last_name !== undefined){ fields.push(`last_name = $${idx++}`); vals.push(body.last_name) }
      if(body.email !== undefined){ fields.push(`email = $${idx++}`); vals.push(body.email) }
      if(fields.length === 0) return res.status(400).json({ error: 'no_fields' })
      const sql = `update liquidate_profiles set ${fields.join(', ')}, updated_at = now() where id = $${idx} returning *`
      vals.push(id)
      const { rows } = await db.query(sql, vals)
      return res.status(200).json(rows[0] || null)
    }

    return res.status(404).json({ error: 'profiles_not_found' })
  }catch(err){
    console.error('profiles router error', err)
    return res.status(500).json({ error: 'server_error' })
  }
}
