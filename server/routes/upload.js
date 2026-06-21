// routes/upload.js — 文件上传 + 获取 URL
const express = require('express')
const router = express.Router()
const multer = require('multer')
const path = require('path')
const db = require('../lib/db')
const { authMiddleware } = require('../lib/auth')
const storage = require('../lib/storage')
const config = require('../config')

// multer 配置：保存到 uploads 目录
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, config.uploadDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || '.jpg'
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`
      cb(null, filename)
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
})

router.use(authMiddleware)

// POST /api/upload — 上传文件
router.post('/', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.json({ code: -1, message: '未收到文件' })

    // 如果指定了 key（子路径），则移动文件
    let key = req.file.filename
    if (req.body.key) {
      const targetPath = path.join(config.uploadDir, req.body.key)
      const fs = require('fs')
      fs.mkdirSync(path.dirname(targetPath), { recursive: true })
      fs.renameSync(req.file.path, targetPath)
      key = req.body.key
    }

    const url = storage.getUrl(key)
    res.json({ code: 0, data: { key, url } })
  } catch (err) {
    console.error('[upload] 错误:', err)
    res.json({ code: -1, message: err.message })
  }
})

// POST /api/files/urls — 批量获取文件 URL
router.post('/files/urls', (req, res) => {
  try {
    const { keys = [] } = req.body
    const results = storage.getUrls(keys)
    res.json({ code: 0, data: { urls: results } })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

module.exports = router
