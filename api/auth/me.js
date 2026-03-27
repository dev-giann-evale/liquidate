const handlers = require('../../server/handlers/auth')
const authMiddleware = require('../../server/middleware/auth')

module.exports = async (req, res) => {
  if(req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' })
  try{
    const user = await authMiddleware.parseAuth(req)
    const result = await handlers.me({ user })
    return res.status(result.status).json(result.json)
  }catch(err){
    if(err.message === 'invalid_token') return res.status(401).json({ error: 'invalid_token' })
    console.error('me func error', err)
    return res.status(500).json({ error: 'server_error' })
  }
}
