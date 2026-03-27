const handlers = require('../../server/handlers/payments')
const auth = require('../../server/middleware/auth')

module.exports = async (req, res) => {
  try{
    if(req.method === 'GET'){
      const result = await handlers.listPayments({ query: req.query })
      return res.status(result.status).json(result.json)
    }
    if(req.method === 'POST'){
      const user = await auth.parseAuth(req)
      const result = await handlers.recordPayment({ body: req.body, user })
      return res.status(result.status).json(result.json)
    }
    return res.status(405).json({ error: 'method_not_allowed' })
  }catch(err){
    if(err.message === 'invalid_token') return res.status(401).json({ error: 'invalid_token' })
    console.error('payments func error', err)
    return res.status(500).json({ error: 'server_error' })
  }
}
