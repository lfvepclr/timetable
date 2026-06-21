// lib/auth.js — HMAC token 生成/验证中间件
const crypto = require('crypto')
const config = require('../config')

/**
 * 生成 HMAC token
 * @param {object} payload { openid, userId }
 * @returns {string}
 */
function generateToken(payload) {
  const data = {
    ...payload,
    iat: Date.now(),
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 天有效期
  }
  const payloadStr = Buffer.from(JSON.stringify(data)).toString('base64url')
  const signature = crypto
    .createHmac('sha256', config.jwtSecret)
    .update(payloadStr)
    .digest('base64url')
  return `${payloadStr}.${signature}`
}

/**
 * 验证 token
 * @param {string} token
 * @returns {object|null} payload
 */
function verifyToken(token) {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 2) return null

  const [payloadStr, signature] = parts
  const expectedSig = crypto
    .createHmac('sha256', config.jwtSecret)
    .update(payloadStr)
    .digest('base64url')

  if (signature !== expectedSig) return null

  try {
    const data = JSON.parse(Buffer.from(payloadStr, 'base64url').toString())
    if (data.exp && data.exp < Date.now()) return null
    return data
  } catch {
    return null
  }
}

/**
 * Express 鉴权中间件
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  const payload = verifyToken(token)

  if (!payload) {
    return res.status(401).json({ code: -1, message: '未授权或 token 已过期' })
  }

  req.auth = payload // { openid, userId, iat, exp }
  next()
}

module.exports = { generateToken, verifyToken, authMiddleware }
