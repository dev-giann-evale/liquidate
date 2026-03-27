const handlers = require('../../../server/handlers/activities')

module.exports = async (req, res) => {
  const id = req.query.id
  try{
    if(req.method === 'GET'){
      const result = await handlers.getActivityExpenses({ params: { id } })
      return res.status(result.status).json(result.json)
    }
    return res.status(405).json({ error: 'method_not_allowed' })
  }catch(err){
    console.error('activities [id]/expenses func error', err)
    return res.status(500).json({ error: 'server_error' })
  }
}
