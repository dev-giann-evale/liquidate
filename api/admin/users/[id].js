const adminUsers = require('../../../../server/handlers/adminUsers')
const auth = require('../../../../server/middleware/auth')

module.exports = async function (req, res) {
  try{
    const user = await auth.parseAuth(req)
    const { id } = req.query || {}
    if(req.method === 'PUT'){
      const body = req.body || await new Promise(r => { let d=''; req.on('data',c=>d+=c); req.on('end', ()=> r(JSON.parse(d||'{}')) ) })
      const result = await adminUsers.updateUser({ user, params: { id }, body })
      return res.status(result.status).json(result.json)
    }
    return res.status(405).json({ error: 'method_not_allowed' })
  }catch(err){
    console.error('admin/users [id] error', err)
    return res.status(500).json({ error: 'server_error' })
  }
}
