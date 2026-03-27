const db = require('./db')
const bcrypt = require('bcryptjs')

// This script creates a super-admin user if ADMIN_EMAIL and ADMIN_PASSWORD
// environment variables are provided. Run locally with:
//   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=secret node server/seed_admin.js

async function run(){
  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD
  if(!email || !password){
    console.error('Provide ADMIN_EMAIL and ADMIN_PASSWORD env vars to seed the admin account.')
    process.exit(1)
  }

  try{
    // check if user exists
    const { rows } = await db.query('select id from liquidate_users where email = $1', [email])
    if(rows && rows.length > 0){
      console.log('Admin user already exists, nothing to do.')
      process.exit(0)
    }

    const hash = await bcrypt.hash(password, 10)
    const insertUserSql = 'insert into liquidate_users (email, password_hash, role) values ($1,$2,$3) returning id'
    const { rows: inserted } = await db.query(insertUserSql, [email, hash, 'super_admin'])
    const id = inserted[0].id
    // create profile row for the user
    await db.query('insert into liquidate_profiles (id, email, first_name, last_name) values ($1,$2,$3,$4)', [id, email, 'Super', 'Admin'])
    console.log(`Created super-admin user ${email}`)
    process.exit(0)
  }catch(err){
    console.error('Failed to create admin user', err)
    process.exit(2)
  }
}

run()
