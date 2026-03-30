const profilesHandler = require('../../server/handlers/profiles')
const usersHandler = require('../../server/handlers/users')
const adminHandler = require('../../server/handlers/adminUsers')
const auth = require('../../server/middleware/auth')

function parseSegments(req){
  const p = (req.url||'').split('?')[0]
  const cleaned = p.replace(/^\/+|\/+$/g,'') // remove leading/trailing slashes
  const parts = cleaned === '' ? [] : cleaned.split('/')
  // If the runtime provides the full path including 'api', drop it
  if(parts[0] === 'api') parts.shift()
  // Vercel dev sometimes invokes the function with a path relative to the
  // function root (e.g. "/<id>/dashboard"), dropping the "users" segment.
  // If the first segment looks like a user id (uuid or numeric), re-insert
  // the `users` prefix so downstream routing works the same across runtimes.
  const isLikelyId = s => typeof s === 'string' && (
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(s) ||
    /^[0-9]+$/.test(s)
  )
  if(parts.length && parts[0] !== 'users' && isLikelyId(parts[0])) parts.unshift('users')
  // Now parts can be like ['profiles'] or ['users','<id>','dashboard'] or ['admin','users',...]
  return parts
}

module.exports = async (req, res) => {
  try{
    const parts = parseSegments(req)
    // GET /profiles
    if(parts.length === 1 && parts[0] === 'profiles' && req.method === 'GET'){
      const result = await profilesHandler.listProfiles({ query: req.query })
      return res.status(result.status).json(result.json)
    }

    // Admin endpoints: /admin/users and /admin/users/:id
    if(parts[0] === 'admin' && parts[1] === 'users'){
      if(parts.length === 2 && req.method === 'GET'){
        const user = await auth.parseAuth(req).catch(()=>null)
        const result = await adminHandler.listUsers({ user })
        return res.status(result.status).json(result.json)
      }
      if(parts.length === 3 && req.method === 'PUT'){
        const user = await auth.parseAuth(req).catch(()=>null)
        const id = parts[2]
        const result = await adminHandler.updateUser({ user, params: { id }, body: req.body })
        return res.status(result.status).json(result.json)
      }
      return res.status(405).json({ error: 'method_not_allowed' })
    }

    // User routes: /users/:id and subroutes
    if(parts[0] === 'users'){
      // Support two URL shapes:
      // - /api/users/:id/dashboard
      // - /api/users/dashboard?id=:id   (vercel dev or client-side query)
      const sub = parts[2]
      // helper to read id from query if needed
      const getQueryId = () => {
        if(req.query && req.query.id) return req.query.id
        const q = (req.url||'').split('?')[1]
        if(!q) return undefined
        try{ return new URLSearchParams(q).get('id') }catch(e){ return undefined }
      }
      // case: /api/users/dashboard?id=...
      // case: /api/users/activities?id=... or /api/users/splits?id=...
      if(parts[1] === 'activities' && req.method === 'GET'){
        const qid = getQueryId()
        if(qid){
          const result = await usersHandler.activities({ params: { id: qid } })
          return res.status(result.status).json(result.json)
        }
      }
      if(parts[1] === 'splits' && req.method === 'GET'){
        const qid = getQueryId()
        if(qid){
          const result = await usersHandler.splits({ params: { id: qid } })
          return res.status(result.status).json(result.json)
        }
      }

      if(parts[1] === 'dashboard' && req.method === 'GET'){
        const id = getQueryId()
        if(!id) return res.status(400).json({ error: 'missing_user_id' })
        const result = await usersHandler.dashboard({ params: { id } })
        return res.status(result.status).json(result.json)
      }
      const id = parts[1]
      if(!id) return res.status(400).json({ error: 'missing_user_id' })

      // GET /users/:id -> return profile
      if(!sub && req.method === 'GET'){
        const result = await profilesHandler.listProfiles({ query: { ids: id } })
        const profile = Array.isArray(result.json) ? result.json[0] : null
        if(!profile) return res.status(404).json({ error: 'user_not_found' })
        return res.status(200).json(profile)
      }

      // GET /users/:id/activities
      if(sub === 'activities' && req.method === 'GET'){
        const result = await usersHandler.activities({ params: { id } })
        return res.status(result.status).json(result.json)
      }

      // GET /users/:id/splits
      if(sub === 'splits' && req.method === 'GET'){
        const result = await usersHandler.splits({ params: { id } })
        return res.status(result.status).json(result.json)
      }

      // GET /users/:id/dashboard
      if(sub === 'dashboard' && req.method === 'GET'){
        const result = await usersHandler.dashboard({ params: { id } })
        return res.status(result.status).json(result.json)
      }

      return res.status(405).json({ error: 'method_not_allowed' })
    }

    return res.status(404).json({ error: 'user_not_found' })
  }catch(err){
    console.error('users catch-all error', err)
    return res.status(500).json({ error: 'server_error' })
  }
}
