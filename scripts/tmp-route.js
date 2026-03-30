const profilesHandler = require('../../server/handlers/profiles')
const usersHandler = {
  activities: async ({ params }) => ({ status: 200, json: [{ note: 'stub activities', id: params.id }] }),
  splits: async ({ params }) => ({ status: 200, json: [{ note: 'stub splits', id: params.id }] }),
  dashboard: async ({ params }) => ({ status: 200, json: { you_are_owed: 123, you_owe: 45, id: params.id } })
}
const adminHandler = require('../../server/handlers/adminUsers')
const auth = require('../../server/middleware/auth')

function parseSegments(req){
  const p = (req.url||'').split('?')[0]
  const cleaned = p.replace(/^\/+|\/+$/g,'') // remove leading/trailing slashes
  const parts = cleaned === '' ? [] : cleaned.split('/')
  // If the runtime provides the full path including 'api', drop it
  if(parts[0] === 'api') parts.shift()
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
      const id = parts[1]
      const sub = parts[2]
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
