// lib/db.js — SQLite 连接封装（使用 Bun 内置 bun:sqlite 模块）
// 可迁移：本地 bun:sqlite / 未来 Cloudflare D1 binding
const { Database } = require('bun:sqlite')
const path = require('path')
const fs = require('fs')
const config = require('../config')

// 确保数据目录存在
const dbDir = path.dirname(config.dbPath)
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true })
}

const db = new Database(config.dbPath)
db.exec('PRAGMA journal_mode = WAL')
db.exec('PRAGMA foreign_keys = ON')

// 运行迁移
function runMigrations() {
  const sqlPath = path.join(__dirname, '..', 'migrations', '001_init.sql')
  const sql = fs.readFileSync(sqlPath, 'utf-8')
  db.exec(sql)
  console.log('[db] 迁移完成')
}

// 自动运行迁移
runMigrations()

// 安全添加列（兼容已有数据库）
try { db.exec('ALTER TABLE courses ADD COLUMN active INTEGER DEFAULT 1') } catch (e) { /* 列已存在 */ }
try { db.exec('ALTER TABLE packages ADD COLUMN course_name TEXT DEFAULT ""') } catch (e) { /* 列已存在 */ }

// JSON 列的自动序列化/反序列化
const JSON_COLUMNS = {
  users: ['capabilities'],
  students: ['tags', 'parents', 'bind_codes'],
  packages: ['consume_records'],
  weekly_patterns: ['student_ids', 'student_names'],
  lessons: ['students'],
  feedbacks: ['photos'],
}

// 反序列化行中的 JSON 列
function parseRow(table, row) {
  if (!row) return null
  const cols = JSON_COLUMNS[table] || []
  const result = { ...row }
  for (const col of cols) {
    if (typeof result[col] === 'string') {
      try { result[col] = JSON.parse(result[col]) } catch { /* 保持原值 */ }
    }
  }
  // 将 active 字段从 integer 转回 boolean（students 和 courses 表）
  if ((table === 'students' || table === 'courses') && 'active' in result) {
    result.active = !!result.active
  }
  // 统一 id 字段（SQLite 用 id，客户端期望 _id）
  if (result.id && !result._id) {
    result._id = result.id
  }
  return result
}

// 序列化数据中的 JSON 列（写入前）
function serializeRow(table, data) {
  const cols = JSON_COLUMNS[table] || []
  const result = { ...data }
  for (const col of cols) {
    if (result[col] !== undefined && typeof result[col] !== 'string') {
      result[col] = JSON.stringify(result[col])
    }
  }
  // students 和 courses 表 active 字段转 integer
  if ((table === 'students' || table === 'courses') && typeof result.active === 'boolean') {
    result.active = result.active ? 1 : 0
  }
  // _id → id
  if (result._id && !result.id) {
    result.id = result._id
    delete result._id
  }
  return result
}

// 事务封装（bun:sqlite 的 db.transaction 返回需调用的函数，这里封装为立即执行）
function transaction(fn) {
  return db.transaction(fn)()
}

module.exports = {
  // 底层 Database 实例
  raw: db,

  // 运行迁移
  runMigrations,

  // 同步查询接口
  prepare: (sql) => db.prepare(sql),
  get: (sql, ...params) => db.prepare(sql).get(...params),
  all: (sql, ...params) => db.prepare(sql).all(...params),
  run: (sql, ...params) => db.prepare(sql).run(...params),

  // 事务封装
  transaction,

  // 序列化辅助
  parseRow,
  serializeRow,

  // 生成 UUID
  uuid: () => {
    const crypto = require('crypto')
    return crypto.randomUUID()
  },
}
