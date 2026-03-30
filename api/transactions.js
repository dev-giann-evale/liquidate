const membersHandler = require('../server/handlers/members')
const paymentsHandler = require('../server/handlers/payments')
const auth = require('../server/middleware/auth')

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
  // If runtime provides the full path including 'api', drop it so
  // this router can accept '/api/payments' or '/api/members'.
  if(parts[0] === 'api') parts.shift()
  try{
    // /api/members (POST -> add, DELETE -> remove)
    if(parts.length === 1 && parts[0] === 'members'){
      if(req.method === 'POST'){
        const user = await auth.parseAuth(req).catch(()=>null)
        const body = await getJsonBody(req)
        const r = await membersHandler.addMember({ body, user })
        return res.status(r.status||200).json(r.json||{})
      }
      if(req.method === 'DELETE'){
        const user = await auth.parseAuth(req).catch(()=>null)
        const body = await getJsonBody(req)
        const r = await membersHandler.removeMember({ body, user })
        return res.status(r.status||200).json(r.json||{})
      }
    }

    // /api/payments (GET -> list, POST -> record)
    if(parts.length === 1 && parts[0] === 'payments'){
      if(req.method === 'GET'){
        const r = await paymentsHandler.listPayments({ query: req.query || {} })
        return res.status(r.status||200).json(r.json||{})
      }
      if(req.method === 'POST'){
        const user = await auth.parseAuth(req).catch(()=>null)
        const body = await getJsonBody(req)
        const r = await paymentsHandler.recordPayment({ body, user })
        return res.status(r.status||200).json(r.json||{})
      }
    }

    return res.status(404).json({ error: 'transactions_not_found' })
  }catch(err){
    if(err && err.message === 'invalid_token') return res.status(401).json({ error: 'invalid_token' })
    console.error('transactions router error', err)
    return res.status(500).json({ error: 'server_error' })
  }
}
