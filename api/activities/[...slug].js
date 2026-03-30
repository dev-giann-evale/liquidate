const handlers = require('../../server/handlers/activities')

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
  // parts could be [] (index), [id], [id, 'expenses'] etc.
  try{
    // POST /api/activities -> createActivity
    if(req.method === 'POST' && parts.length === 0){
      const body = await getJsonBody(req)
      const r = await handlers.createActivity({ body })
      return res.status(r.status||200).json(r.json||{})
    }

    // GET /api/activities -> listActivities (supports ?ids=)
    if(req.method === 'GET' && parts.length === 0){
      const r = await handlers.listActivities({ query: req.query || {} })
      return res.status(r.status||200).json(r.json||{})
    }

    // routes with id
    const id = parts[0]
    if(parts.length === 1){
      if(req.method === 'GET'){
        const r = await handlers.getActivity({ params: { id } })
        return res.status(r.status||200).json(r.json||{})
      }
      if(req.method === 'PUT'){
        const body = await getJsonBody(req)
        const r = await handlers.updateActivity({ params: { id }, body })
        return res.status(r.status||200).json(r.json||{})
      }
    }

    // /api/activities/:id/expenses
    if(parts.length === 2 && parts[1] === 'expenses' && req.method === 'GET'){
      const r = await handlers.getActivityExpenses({ params: { id } })
      return res.status(r.status||200).json(r.json||{})
    }

    // /api/activities/:id/members
    if(parts.length === 2 && parts[1] === 'members' && req.method === 'GET'){
      const r = await handlers.listActivityMembers({ params: { id } })
      return res.status(r.status||200).json(r.json||{})
    }

    return res.status(404).json({ error: 'activitiesnot_found' })
  }catch(err){
    console.error('activities router error', err)
    return res.status(500).json({ error: 'server_error' })
  }
}
const handlers = require('../../server/handlers/activities')
const auth = require('../../server/middleware/auth')

function tailFromReq(req){
  const p = (req.url||'').split('?')[0]
  const idx = p.indexOf('/api/activities')
  if(idx === -1) return ''
  return p.slice(idx + '/api/activities'.length).replace(/^\/+|\/+$/g,'')
}

module.exports = async (req, res) => {
  console.log(req)
  try{
    const tail = tailFromReq(req)
    if(!tail){
      // /api/activities
      if(req.method === 'GET'){
        // support GET /api/activities?id=... to fetch a single activity by id
        if(req.query && req.query.id){
          const result = await handlers.getActivity({ params: { id: req.query.id } })
          return res.status(result.status).json(result.json)
        }
        const result = await handlers.listActivities({ query: req.query })
        return res.status(result.status).json(result.json)
      }
      if(req.method === 'POST'){
        const user = await auth.parseAuth(req).catch(()=>null)
        let result
        if(typeof handlers.createActivity === 'function'){
          result = await handlers.createActivity({ body: req.body, user })
        }else{
          result = { status:405, json:{ error:'not_implemented' } }
        }
        return res.status(result.status).json(result.json)
      }
      return res.status(405).json({ error: 'method_not_allowed' })
    }

    const parts = tail.split('/')
    const id = parts[0]
    const sub = parts[1]

    if(parts.length === 1){
      // /api/activities/:id
      if(req.method === 'GET'){
        const result = await handlers.getActivity({ params: { id } })
        return res.status(result.status).json(result.json)
      }
      if(req.method === 'PUT'){
        const user = await auth.parseAuth(req).catch(()=>null)
        const result = await handlers.updateActivity({ params: { id }, body: req.body, user })
        return res.status(result.status).json(result.json)
      }
      return res.status(405).json({ error: 'method_not_allowed' })
    }

    // /api/activities/:id/expenses
    if(sub === 'expenses' && req.method === 'GET'){
      const result = await handlers.getActivityExpenses({ params: { id } })
      return res.status(result.status).json(result.json)
    }

    // support GET /api/activities/expenses?id=... (query param style)
    if(parts.length === 1 && parts[0] === 'expenses' && req.method === 'GET' && req.query && req.query.id){
      const result = await handlers.getActivityExpenses({ params: { id: req.query.id } })
      return res.status(result.status).json(result.json)
    }

    // /api/activities/:id/members
    if(sub === 'members' && req.method === 'GET'){
      const result = await handlers.listActivityMembers({ params: { id } })
      return res.status(result.status).json(result.json)
    }

    // support GET /api/activities/members?id=... (query param style)
    if(parts.length === 1 && parts[0] === 'members' && req.method === 'GET' && req.query && req.query.id){
      const result = await handlers.listActivityMembers({ params: { id: req.query.id } })
      return res.status(result.status).json(result.json)
    }

    return res.status(405).json({ error: 'method_not_allowed' })
  }catch(err){
    console.error('activities catch-all error', err)
    return res.status(500).json({ error: 'server_error' })
  }
}
