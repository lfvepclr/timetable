// routes/auth.js — 登录鉴权路由
const express = require('express')
const router = express.Router()
const db = require('../lib/db')
const config = require('../config')
const { generateToken } = require('../lib/auth')
const wxapi = require('../lib/wxapi')

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { code } = req.body
    let openid

    if (code && config.wx.secret) {
      // 正式模式：用 wx.login 的 code 换取 openid
      const session = await wxapi.code2session(code)
      openid = session.openid
    } else {
      // 本地开发模式：无 code 或未配置 WX_SECRET 时使用测试 openid
      openid = 'local-dev-openid'
    }

    if (!openid) {
      return res.json({ code: -1, message: '获取 openid 失败' })
    }

    // 查询用户
    let user = db.get('SELECT * FROM users WHERE openid = ?', openid)
    let isNew = false

    if (user) {
      user = db.parseRow('users', user)
    } else {
      // 新用户：默认具备老师能力
      isNew = true
      const now = Date.now()
      const id = db.uuid()
      db.run(
        `INSERT INTO users (id, openid, capabilities, name, phone, avatar, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        id, openid, JSON.stringify({ teacher: true, parent: false }), '', '', '', now, now
      )
      user = { _id: id, id, openid, capabilities: { teacher: true, parent: false } }
    }

    const capabilities = user.capabilities || { teacher: true, parent: false }
    const token = generateToken({ openid, userId: user.id || user._id })

    res.json({
      code: 0,
      data: {
        openid,
        userId: user.id || user._id,
        userInfo: user,
        capabilities,
        isNew,
        token,
      },
    })
  } catch (err) {
    console.error('[auth/login] 错误:', err)
    res.json({ code: -1, message: err.message || '登录失败' })
  }
})

module.exports = router
