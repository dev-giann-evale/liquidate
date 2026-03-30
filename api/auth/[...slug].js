const { login, register, me, updatePassword } = require('../../server/handlers/auth')
const { parseAuth } = require('../../server/middleware/auth')

async function getJsonBody(req){
  if(req.body) return req.body
  return await new Promise((resolve) => {
    let buf = ''
    req.on('data', (c) => (buf += c))
    req.on('end', () => {
      try { resolve(JSON.parse(buf || '{}')) } catch (e) { resolve({}) }
    })
    req.on('error', () => resolve({}))
  })
}

module.exports = async (req, res) => {
  const raw = (req.url || '').split('?')[0]
  const parts = raw.split('/').filter(Boolean) // e.g. ['login']
  const slug = parts[0] || ''

  try{
    if(req.method === 'POST' && slug === 'login'){
      const body = await getJsonBody(req)
      const result = await login({ body })
      return res.status(result.status || 200).json(result.json || {})
    }

    if(req.method === 'POST' && slug === 'register'){
      const body = await getJsonBody(req)
      const result = await register({ body })
      return res.status(result.status || 200).json(result.json || {})
    }

    if(req.method === 'GET' && slug === 'me'){
      const user = await parseAuth(req)
      const result = await me({ user })
      return res.status(result.status || 200).json(result.json || {})
    }

    if(req.method === 'POST' && slug === 'update-password'){
      const user = await parseAuth(req)
      const body = await getJsonBody(req)
      const result = await updatePassword({ user, body })
      return res.status(result.status || 200).json(result.json || {})
    }

    return res.status(404).json({ error: 'auth_not_found' })
  }catch(err){
    // handler functions may throw for parseAuth invalid_token
    if(err && err.message === 'invalid_token') return res.status(401).json({ error: 'invalid_token' })
    console.error('auth router error', err)
    return res.status(500).json({ error: 'server_error' })
  }
}
const handlers = require('../../server/handlers/auth')
const auth = require('../../server/middleware/auth')

function pathAfterBase(req, base){
  const p = (req.url || '').split('?')[0]
  if(!p) return ''
  if(!base) return p
  const idx = p.indexOf(base)
  if(idx === -1) return ''
  return p.slice(idx + base.length)
}

module.exports = async (req, res) => {
  console.log(req)
  try{
    const tail = pathAfterBase(req, '/api/auth').replace(/^\/+|\/+$/g, '')
    // route by tail or method
    if((!tail || tail === '') && req.method === 'GET'){
      // /api/auth -> not used, respond 404
      return res.status(404).json({ error: 'auth_not_found' })
    }

    if(tail === 'login' && req.method === 'POST'){
      const result = await handlers.login({ body: req.body })
      return res.status(result.status).json(result.json)
    }

    if(tail === 'register' && req.method === 'POST'){
      const result = await handlers.register({ body: req.body })
      return res.status(result.status).json(result.json)
    }

    if(tail === 'me' && req.method === 'GET'){
      try{
        const user = await auth.parseAuth(req)
        const result = await handlers.me({ user })
        return res.status(result.status).json(result.json)
      }catch(err){
        if(err.message === 'invalid_token') return res.status(401).json({ error: 'invalid_token' })
        throw err
      }
    }

    if(tail === 'update-password' && req.method === 'POST'){
      try{
        const user = await auth.parseAuth(req)
        const result = await handlers.updatePassword({ user, body: req.body })
        return res.status(result.status).json(result.json)
      }catch(err){
        if(err.message === 'invalid_token') return res.status(401).json({ error: 'invalid_token' })
        throw err
      }
    }

    return res.status(405).json({ error: 'method_not_allowed' })
  }catch(err){
    console.error('auth catch-all error', err)
    return res.status(500).json({ error: 'server_error' })
  }
}
