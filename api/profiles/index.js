const handlers = require('../../../server/handlers/profiles')

module.exports = async (req, res) => {
  try{
    if(req.method === 'GET'){
      const result = await handlers.listProfiles({ query: req.query })
      return res.status(result.status).json(result.json)
    }
    return res.status(405).json({ error: 'method_not_allowed' })
  }catch(err){
    console.error('profiles func error', err)
    return res.status(500).json({ error: 'server_error' })
  }
}
