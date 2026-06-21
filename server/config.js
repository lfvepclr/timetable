// config.js — 环境配置
const path = require('path')

module.exports = {
  wx: {
    appid: process.env.WX_APPID || 'wxa191157e072a50e9',
    secret: process.env.WX_SECRET || '',
  },
  port: parseInt(process.env.PORT || '3000', 10),
  jwtSecret: process.env.JWT_SECRET || 'local-dev-secret-change-in-production',
  dbPath: process.env.DB_PATH || path.join(__dirname, 'data', 'app.db'),
  uploadDir: process.env.UPLOAD_DIR || path.join(__dirname, 'uploads'),
}
