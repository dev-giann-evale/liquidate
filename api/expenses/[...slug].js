const handlers = require('../../server/handlers/expenses')

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
    // POST /api/expenses -> createExpense
    if(req.method === 'POST' && parts.length === 0){
      const body = await getJsonBody(req)
      const r = await handlers.createExpense({ body })
      return res.status(r.status||200).json(r.json||{})
    }

    const id = parts[0]
    if(parts.length === 1){
      if(req.method === 'PUT'){
        const body = await getJsonBody(req)
        const r = await handlers.updateExpense({ params: { id }, body })
        return res.status(r.status||200).json(r.json||{})
      }
      if(req.method === 'DELETE'){
        const r = await handlers.deleteExpense({ params: { id } })
        return res.status(r.status||200).json(r.json||{})
      }
    }

    // /api/expenses/:id/splits
    if(parts.length === 2 && parts[1] === 'splits'){
      if(req.method === 'DELETE'){
        const r = await handlers.deleteExpenseSplits({ params: { id: parts[0] } })
        return res.status(r.status||200).json(r.json||{})
      }
      if(req.method === 'POST'){
        const body = await getJsonBody(req)
        const r = await handlers.insertExpenseSplits({ params: { id: parts[0] }, body })
        return res.status(r.status||200).json(r.json||{})
      }
    }

    return res.status(404).json({ error: 'expenses_not_found' })
  }catch(err){
    console.error('expenses router error', err)
    return res.status(500).json({ error: 'server_error' })
  }
}
const handlers = require('../../server/handlers/expenses')
const auth = require('../../server/middleware/auth')

function tailFromReq(req){
  const p = (req.url||'').split('?')[0]
  const idx = p.indexOf('/api/expenses')
  if(idx === -1) return ''
  return p.slice(idx + '/api/expenses'.length).replace(/^\/+|\/+$/g,'')
}

module.exports = async (req, res) => {
  console.log(req)
  try{
    const tail = tailFromReq(req)
    if(!tail){
      // /api/expenses
      if(req.method === 'POST'){
        const user = await auth.parseAuth(req).catch(()=>null)
        const result = await handlers.createExpense({ body: req.body, user })
        return res.status(result.status).json(result.json)
      }
      return res.status(405).json({ error: 'method_not_allowed' })
    }

    // support GET /api/expenses?id=... to fetch an expense by id
    if(!tail && req.query && req.query.id){
      const qid = req.query.id
      if(req.method === 'GET'){
        const result = await handlers.getExpense({ params: { id: qid } })
        return res.status(result.status).json(result.json)
      }
      if(req.method === 'PUT'){
        const user = await auth.parseAuth(req).catch(()=>null)
        const result = await handlers.updateExpense({ params: { id: qid }, body: req.body, user })
        return res.status(result.status).json(result.json)
      }
      if(req.method === 'DELETE'){
        const user = await auth.parseAuth(req).catch(()=>null)
        const result = await handlers.deleteExpense({ params: { id: qid }, user })
        return res.status(result.status).json(result.json)
      }
    }

    const parts = tail.split('/')
    const id = parts[0]
    const sub = parts[1]

    if(parts.length === 1){
      // /api/expenses/:id
      if(req.method === 'GET'){
        let result
        if(typeof handlers.getExpense === 'function'){
          result = await handlers.getExpense({ params: { id } })
        }else{
          result = { status:404, json:{ error:'expensesnot_found' } }
        }
        return res.status(result.status).json(result.json)
      }
      if(req.method === 'PUT'){
        const user = await auth.parseAuth(req).catch(()=>null)
        const result = await handlers.updateExpense({ params: { id }, body: req.body, user })
        return res.status(result.status).json(result.json)
      }
      if(req.method === 'DELETE'){
        const user = await auth.parseAuth(req).catch(()=>null)
        const result = await handlers.deleteExpense({ params: { id }, user })
        return res.status(result.status).json(result.json)
      }
      return res.status(405).json({ error: 'method_not_allowed' })
    }

    // /api/expenses/:id/splits
    if(sub === 'splits'){
      if(req.method === 'GET'){
        let result
        if(typeof handlers.getExpenseSplits === 'function'){
          result = await handlers.getExpenseSplits({ params: { id } })
        }else{
          result = { status:200, json:[] }
        }
        return res.status(result.status).json(result.json)
      }
      if(req.method === 'POST'){
        const user = await auth.parseAuth(req).catch(()=>null)
        const result = await handlers.insertExpenseSplits({ params: { id }, body: req.body, user })
        return res.status(result.status).json(result.json)
      }
      if(req.method === 'DELETE'){
        const user = await auth.parseAuth(req).catch(()=>null)
        const result = await handlers.deleteExpenseSplits({ params: { id }, user })
        return res.status(result.status).json(result.json)
      }
    }

    // support /api/expenses/splits?id=... (query param style)
    if(parts.length === 1 && parts[0] === 'splits' && req.query && req.query.id){
      const eid = req.query.id
      if(req.method === 'GET'){
        const result = await handlers.getExpenseSplits({ params: { id: eid } })
        return res.status(result.status).json(result.json)
      }
      if(req.method === 'POST'){
        const user = await auth.parseAuth(req).catch(()=>null)
        const result = await handlers.insertExpenseSplits({ params: { id: eid }, body: req.body, user })
        return res.status(result.status).json(result.json)
      }
      if(req.method === 'DELETE'){
        const user = await auth.parseAuth(req).catch(()=>null)
        const result = await handlers.deleteExpenseSplits({ params: { id: eid }, user })
        return res.status(result.status).json(result.json)
      }
    }

    return res.status(405).json({ error: 'method_not_allowed' })
  }catch(err){
    console.error('expenses catch-all error', err)
    return res.status(500).json({ error: 'server_error' })
  }
}
