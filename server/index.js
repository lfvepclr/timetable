// index.js — Express 服务入口
const express = require('express')
const cors = require('cors')
const path = require('path')
const config = require('./config')

// 确保数据库初始化
require('./lib/db')

const app = express()

// 中间件
app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// 静态文件服务（上传的文件）
app.use('/uploads', express.static(config.uploadDir))

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ code: 0, data: { status: 'ok', time: Date.now() } })
})

// 路由挂载
const authRoutes = require('./routes/auth')
const { createCrudRouter, ALLOWED_TABLES } = require('./routes/crud')
const lessonsRoutes = require('./routes/lessons')
const scheduleRoutes = require('./routes/schedule')
const studentsRoutes = require('./routes/students')
const feedbacksRoutes = require('./routes/feedbacks')
const notificationsRoutes = require('./routes/notifications')
const uploadRoutes = require('./routes/upload')
const fnRoutes = require('./routes/fn')

// 登录（无需鉴权）
app.use('/api/auth', authRoutes)

// 通用 CRUD（每张表一组路由）
for (const table of ALLOWED_TABLES) {
  app.use(`/api/${table}`, createCrudRouter(table))
}

// 业务路由
app.use('/api/lessons', lessonsRoutes)
app.use('/api/schedule', scheduleRoutes)
app.use('/api/students', studentsRoutes)
app.use('/api/feedbacks', feedbacksRoutes)
app.use('/api/notifications', notificationsRoutes)
app.use('/api', uploadRoutes) // /api/upload + /api/files/urls

// 通用函数分发（兼容 callFn）
app.use('/api/fn', fnRoutes)

// 错误处理
app.use((err, req, res, next) => {
  console.error('[server] 未捕获错误:', err)
  res.status(500).json({ code: -1, message: err.message || '服务器内部错误' })
})

// 启动服务
app.listen(config.port, () => {
  console.log(`\n┌─────────────────────────────────────────┐`)
  console.log(`│  排课助手服务端已启动                    │`)
  console.log(`│  地址: http://localhost:${config.port}           │`)
  console.log(`│  数据库: ${path.relative(process.cwd(), config.dbPath)}              │`)
  console.log(`│  上传目录: ${path.relative(process.cwd(), config.uploadDir)}              │`)
  console.log(`└─────────────────────────────────────────┘\n`)
})
