const handlers = require('../../server/handlers/auth')
module.exports = async (req, res) => {
  if(req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })
  try{
    const result = await handlers.login({ body: req.body })
    return res.status(result.status).json(result.json)
  }catch(err){
    console.error('login func error', err)
    return res.status(500).json({ error: 'server_error' })
  }
}
