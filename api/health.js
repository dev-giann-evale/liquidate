const db = require('../server/db')

module.exports = async (req, res) => {
  try{
    await db.query('select 1')
    return res.status(200).json({ ok: true })
  }catch(err){
    console.error('db health error', err)
    return res.status(500).json({ ok: false })
  }
}
