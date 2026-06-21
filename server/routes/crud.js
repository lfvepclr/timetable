// routes/crud.js — 通用 CRUD 工厂（7 张表共用）
const express = require('express')
const db = require('../lib/db')
const { buildWhere, buildOrderBy, buildLimit } = require('../lib/query')
const { authMiddleware } = require('../lib/auth')

// 允许的表名（白名单）
const ALLOWED_TABLES = ['users', 'students', 'courses', 'packages', 'weekly_patterns', 'lessons', 'feedbacks']

function createCrudRouter(table) {
  const router = express.Router()
  router.use(authMiddleware)

  // POST /:table/query — 查询（分页 + where + orderBy）
  router.post('/query', (req, res) => {
    try {
      const { where = {}, page = 1, pageSize = 20, orderBy, field } = req.body
      const { clause, params } = buildWhere(table, where)

      let sql = `SELECT * FROM ${table}`
      if (clause) sql += ` WHERE ${clause}`
      if (orderBy) sql += ` ${buildOrderBy(orderBy)}`
      sql += ` ${buildLimit(page, pageSize)}`

      const rows = db.all(sql, ...params).map(row => db.parseRow(table, row))

      res.json({ code: 0, data: rows })
    } catch (err) {
      console.error(`[crud/${table}/query] 错误:`, err)
      res.json({ code: -1, message: err.message })
    }
  })

  // GET /:table/:id — 按 ID 查询
  router.get('/:id', (req, res) => {
    try {
      const row = db.get(`SELECT * FROM ${table} WHERE id = ?`, req.params.id)
      if (!row) return res.json({ code: -1, message: '记录不存在' })
      res.json({ code: 0, data: db.parseRow(table, row) })
    } catch (err) {
      res.json({ code: -1, message: err.message })
    }
  })

  // POST /:table — 新增
  router.post('/', (req, res) => {
    try {
      const now = Date.now()
      const id = req.body._id || req.body.id || db.uuid()
      const data = { ...req.body, id, _id: id, created_at: now, updated_at: now }
      const serialized = db.serializeRow(table, data)

      const columns = Object.keys(serialized).filter(k => k !== '_id')
      const placeholders = columns.map(() => '?').join(',')
      const values = columns.map(k => serialized[k])

      db.run(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${placeholders})`, ...values)
      res.json({ code: 0, data: { _id: id, id } })
    } catch (err) {
      console.error(`[crud/${table}/add] 错误:`, err)
      res.json({ code: -1, message: err.message })
    }
  })

  // PUT /:table/:id — 更新
  router.put('/:id', (req, res) => {
    try {
      const now = Date.now()
      const data = { ...req.body, updated_at: now }
      const serialized = db.serializeRow(table, data)

      const columns = Object.keys(serialified).filter(k => k !== '_id' && k !== 'id' && k !== 'created_at')
      const setClause = columns.map(k => `${k} = ?`).join(',')
      const values = columns.map(k => serialized[k])

      const result = db.run(`UPDATE ${table} SET ${setClause} WHERE id = ?`, ...values, req.params.id)
      res.json({ code: 0, data: { updated: result.changes } })
    } catch (err) {
      console.error(`[crud/${table}/update] 错误:`, err)
      res.json({ code: -1, message: err.message })
    }
  })

  // DELETE /:table/:id — 删除
  router.delete('/:id', (req, res) => {
    try {
      const result = db.run(`DELETE FROM ${table} WHERE id = ?`, req.params.id)
      res.json({ code: 0, data: { removed: result.changes } })
    } catch (err) {
      res.json({ code: -1, message: err.message })
    }
  })

  // POST /:table/count — 计数
  router.post('/count', (req, res) => {
    try {
      const { where = {} } = req.body
      const { clause, params } = buildWhere(table, where)
      let sql = `SELECT COUNT(*) as total FROM ${table}`
      if (clause) sql += ` WHERE ${clause}`
      const row = db.get(sql, ...params)
      res.json({ code: 0, data: { total: row.total } })
    } catch (err) {
      res.json({ code: -1, message: err.message })
    }
  })

  return router
}

module.exports = { createCrudRouter, ALLOWED_TABLES }
