// routes/students.js — 学生绑定相关：生成绑定码 + 家长绑定
const express = require('express')
const router = express.Router()
const db = require('../lib/db')
const { authMiddleware } = require('../lib/auth')
const storage = require('../lib/storage')
const wxapi = require('../lib/wxapi')

router.use(authMiddleware)

// 生成6位随机码（排除易混淆字符）
function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

// POST /api/students/:id/bind-codes — 生成绑定码 + 小程序码
router.post('/:id/bind-codes', async (req, res) => {
  try {
    const studentId = req.params.id
    const openid = req.auth.openid

    const studentRow = db.get('SELECT * FROM students WHERE id = ?', studentId)
    if (!studentRow) return res.json({ code: -1, message: '学生不存在' })
    const student = db.parseRow('students', studentRow)

    const now = Date.now()

    // 检查已有未使用且未过期的绑定码
    const existingCodes = (student.bind_codes || []).filter(
      c => c.status === 'pending' && c.expire_at > now
    )
    if (existingCodes.length > 0) {
      const existing = existingCodes[0]
      return res.json({
        code: 0,
        data: {
          bind_code: existing.code,
          bind_code_id: existing.id || '',
          student_name: student.name,
          qr_url: existing.qr_url || '',
        },
      })
    }

    // 生成唯一码
    let code = generateCode()
    let retryCount = 0
    while (retryCount < 10) {
      // 检查所有学生中是否有相同的 pending 码
      const allStudents = db.all(`SELECT bind_codes FROM students WHERE bind_codes LIKE ?`, `%"code":"${code}"%`)
      const hasDuplicate = allStudents.some(s => {
        const codes = JSON.parse(s.bind_codes || '[]')
        return codes.some(c => c.code === code && c.status === 'pending')
      })
      if (!hasDuplicate) break
      code = generateCode()
      retryCount++
    }

    const expireAt = now + 24 * 60 * 60 * 1000
    const codeId = db.uuid()

    // 尝试生成小程序码
    let qrUrl = ''
    try {
      const qrBuffer = await wxapi.generateWxaCode(code, 'pages/common/bind/index', 280)
      const qrKey = `bind_qr/${code}.png`
      await storage.save(qrKey, qrBuffer)
      qrUrl = storage.getUrl(qrKey)
    } catch (qrErr) {
      console.warn('[students/bind-codes] 小程序码生成失败（本地开发正常）:', qrErr.message)
    }

    // 将绑定码存入学生的 bind_codes JSON 列
    const bindCodes = student.bind_codes || []
    bindCodes.push({
      id: codeId,
      code,
      status: 'pending',
      expire_at: expireAt,
      qr_url: qrUrl,
      created_by: openid,
      created_at: now,
    })

    db.run(
      `UPDATE students SET bind_codes = ?, updated_at = ? WHERE id = ?`,
      JSON.stringify(bindCodes), now, studentId
    )

    res.json({
      code: 0,
      data: {
        bind_code: code,
        bind_code_id: codeId,
        student_name: student.name,
        qr_url: qrUrl,
      },
    })
  } catch (err) {
    console.error('[students/bind-codes] 错误:', err)
    res.json({ code: -1, message: err.message })
  }
})

// POST /api/students/bind — 家长绑定学生
router.post('/bind', (req, res) => {
  try {
    const openid = req.auth.openid
    const { code, relationship } = req.body

    if (!code) return res.json({ code: -1, message: '缺少绑定码' })

    const now = Date.now()

    // 在所有学生中查找匹配的绑定码
    const students = db.all('SELECT * FROM students').map(row => db.parseRow('students', row))

    let targetStudent = null
    let targetBindCode = null

    for (const student of students) {
      const codes = student.bind_codes || []
      const found = codes.find(c => c.code === code && c.status === 'pending')
      if (found) {
        targetStudent = student
        targetBindCode = found
        break
      }
    }

    if (!targetStudent) {
      return res.json({ code: -1, message: '绑定码无效或已被使用' })
    }

    // 检查过期
    if (targetBindCode.expire_at < now) {
      // 更新绑定码状态为过期
      const codes = targetStudent.bind_codes.map(c =>
        c.code === code ? { ...c, status: 'expired' } : c
      )
      db.run(`UPDATE students SET bind_codes = ?, updated_at = ? WHERE id = ?`,
        JSON.stringify(codes), now, targetStudent.id)
      return res.json({ code: -1, message: '绑定码已过期，请联系老师重新生成' })
    }

    // 检查是否已绑定
    const parents = targetStudent.parents || []
    const alreadyBound = parents.some(p => p.openid === openid && p.status === 'active')
    if (alreadyBound) return res.json({ code: -1, message: '您已绑定该学生' })

    // 检查绑定人数限制
    const activeCount = parents.filter(p => p.status === 'active').length
    if (activeCount >= 2) return res.json({ code: -1, message: '该学生绑定家长已达上限' })

    // 创建绑定
    parents.push({
      openid,
      relationship: relationship || '家长',
      status: 'active',
      bound_at: now,
    })

    // 更新绑定码状态
    const updatedCodes = targetStudent.bind_codes.map(c =>
      c.code === code ? { ...c, status: 'used', used_by: openid, used_at: now } : c
    )

    db.run(
      `UPDATE students SET parents = ?, bind_codes = ?, updated_at = ? WHERE id = ?`,
      JSON.stringify(parents), JSON.stringify(updatedCodes), now, targetStudent.id
    )

    // 更新用户能力：标记 parent = true
    const userRow = db.get('SELECT * FROM users WHERE openid = ?', openid)
    if (userRow) {
      const user = db.parseRow('users', userRow)
      const caps = user.capabilities || { teacher: true, parent: false }
      caps.parent = true
      db.run(
        `UPDATE users SET capabilities = ?, updated_at = ? WHERE id = ?`,
        JSON.stringify(caps), now, user.id || user._id
      )
    }

    res.json({
      code: 0,
      data: {
        student_id: targetStudent.id,
        student_name: targetStudent.name,
        student: targetStudent,
      },
    })
  } catch (err) {
    console.error('[students/bind] 错误:', err)
    res.json({ code: -1, message: err.message })
  }
})

module.exports = router
