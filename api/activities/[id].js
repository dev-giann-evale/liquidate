const handlers = require('../../../server/handlers/activities')
const authMiddleware = require('../../../server/middleware/auth')

module.exports = async (req, res) => {
  const id = req.query.id
  try{
    if(req.method === 'GET'){
      const result = await handlers.getActivity({ params: { id } })
      return res.status(result.status).json(result.json)
    }
    if(req.method === 'PUT'){
      const user = await authMiddleware.parseAuth(req)
      // You may want to check membership/ownership here
      const result = await handlers.updateActivity({ params: { id }, body: req.body, user })
      return res.status(result.status).json(result.json)
    }
    return res.status(405).json({ error: 'method_not_allowed' })
  }catch(err){
    if(err.message === 'invalid_token') return res.status(401).json({ error: 'invalid_token' })
    console.error('activities [id] func error', err)
    return res.status(500).json({ error: 'server_error' })
  }
}
