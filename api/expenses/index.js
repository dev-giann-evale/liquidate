const handlers = require('../../server/handlers/expenses')
const auth = require('../../server/middleware/auth')

module.exports = async (req, res) => {
  try{
    if(req.method === 'POST'){
      const user = await auth.parseAuth(req)
      // you may validate user presence here
      const result = await handlers.createExpense({ body: req.body, user })
      return res.status(result.status).json(result.json)
    }
    return res.status(405).json({ error: 'method_not_allowed' })
  }catch(err){
    if(err.message === 'invalid_token') return res.status(401).json({ error: 'invalid_token' })
    console.error('expenses index func error', err)
    return res.status(500).json({ error: 'server_error' })
  }
}
