const adminUsers = require('../../../server/handlers/adminUsers')
const auth = require('../../../server/middleware/auth')

module.exports = async function (req, res) {
  try{
    const user = await auth.parseAuth(req)
    if(req.method === 'GET'){
      const result = await adminUsers.listUsers({ user })
      return res.status(result.status).json(result.json)
    }
    return res.status(405).json({ error: 'method_not_allowed' })
  }catch(err){
    console.error('admin/users index error', err)
    return res.status(500).json({ error: 'server_error' })
  }
}
