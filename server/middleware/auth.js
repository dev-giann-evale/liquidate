const jwt = require('jsonwebtoken')

/**
 * Simple auth middleware.
 * Behavior:
 * - If Authorization: Bearer <token> header present and AUTH_JWT_SECRET is set, verify the token and set req.user = payload.
 * - If token present but AUTH_JWT_SECRET not set, decode without verification (development convenience) and set req.user.
 * - If no token present, req.user = null.
 * Note: For production, set AUTH_JWT_SECRET (or PUBLIC KEY) and don't rely on decode-only mode.
 */
function authMiddleware(req, res, next){
  const auth = req.headers.authorization
  if(!auth){
    req.user = null
    return next()
  }

  const parts = auth.split(' ')
  if(parts.length !== 2 || parts[0] !== 'Bearer'){
    req.user = null
    return next()
  }

  const token = parts[1]
  const secret = process.env.AUTH_JWT_SECRET
  if(secret){
    try{
      const payload = jwt.verify(token, secret)
      req.user = payload
      return next()
    }catch(err){
      console.error('JWT verify failed', err.message)
      return res.status(401).json({ error: 'invalid_token' })
    }
  }

  // No secret configured: decode without verifying (development only)
  try{
    const payload = jwt.decode(token)
    req.user = payload
    console.warn('AUTH_JWT_SECRET not set - decoded token without verification (dev only)')
  }catch(_){
    req.user = null
  }
  return next()
}

// Also export a helper for serverless handlers to parse auth from a request
async function parseAuth(req){
  const auth = req.headers?.authorization || req.headers?.Authorization
  if(!auth) return null
  const parts = auth.split(' ')
  if(parts.length !== 2 || parts[0] !== 'Bearer') return null
  const token = parts[1]
  const secret = process.env.AUTH_JWT_SECRET
  if(secret){
    try{
      const payload = jwt.verify(token, secret)
      return payload
    }catch(err){
      throw new Error('invalid_token')
    }
  }
  try{
    const payload = jwt.decode(token)
    return payload
  }catch(_){
    return null
  }
}

authMiddleware.parseAuth = parseAuth
module.exports = authMiddleware
