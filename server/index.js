const express = require('express')
const cors = require('cors')
const activities = require('./routes/activities')
const payments = require('./routes/payments')
const members = require('./routes/members')
const expenses = require('./routes/expenses')
const profiles = require('./routes/profiles')
const auth = require('./routes/auth')
const users = require('./routes/users')
const db = require('./db')

const app = express()
app.use(cors())
app.use(express.json())

app.get('/ping', (req, res) => res.json({ ok: true }))

app.use('/api/activities', activities)
app.use('/api/payments', payments)
app.use('/api/members', members)
app.use('/api/expenses', expenses)
app.use('/api/profiles', profiles)
app.use('/api/auth', auth)
app.use('/api/users', users)

// basic health check for DB
app.get('/health', async (req, res) => {
  try{
    await db.query('select 1')
    res.json({ ok: true })
  }catch(err){
    console.error('db health error', err)
    res.status(500).json({ ok: false })
  }
})

const port = process.env.PORT || 4000
app.listen(port, ()=> console.log(`API server listening on ${port}`))
