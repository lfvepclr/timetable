// utils/api.js — 数据接口封装（本地文件数据库模式）
// 所有数据操作通过 local-db.js 在本地完成，无需服务端

const localDb = require('./local-db')

// ============ Token 管理（保留接口兼容，实际无操作）============

function getToken() { return '' }
function setToken() {}
function clearToken() {}

// ============ 通用请求（保留接口兼容，已废弃）============

const BASE_URL = ''

function request() {
  return Promise.reject(new Error('本地模式不支持 HTTP 请求'))
}

// ============ 数据库操作 ============

async function query(collection, where = {}, options = {}) {
  return localDb.query(collection, where, options)
}

async function queryOne(collection, where = {}, options = {}) {
  const list = await query(collection, where, { ...options, page: 1, pageSize: 1 })
  return list[0] || null
}

async function getById(collection, id) {
  return localDb.getById(collection, id)
}

async function count(collection, where = {}) {
  return localDb.count(collection, where)
}

async function add(collection, data) {
  const result = localDb.add(collection, data)
  return result._id || result.id
}

async function update(collection, id, data) {
  const result = localDb.update(collection, id, data)
  return result.updated
}

async function remove(collection, id) {
  const result = localDb.remove(collection, id)
  return result.removed
}

// ============ 业务函数 ============

function callFn(name, data = {}) {
  try {
    return Promise.resolve(localDb.callFn(name, data))
  } catch (err) {
    return Promise.reject(err)
  }
}

// ============ 文件操作（本地存储）============

function uploadFile(filePath, key) {
  return new Promise((resolve, reject) => {
    const storageKey = key || `uploads/${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const destPath = `${wx.env.USER_DATA_PATH}/${storageKey}`
    try {
      const fs = wx.getFileSystemManager()
      // 确保目录存在
      const dir = destPath.substring(0, destPath.lastIndexOf('/'))
      try { fs.mkdirSync(dir, true) } catch (e) { /* 目录已存在 */ }
      fs.copyFile(filePath, destPath, () => {
        resolve(storageKey)
      }, (err) => {
        console.error('[api] uploadFile 失败:', err)
        reject(err)
      })
    } catch (e) {
      // copyFile 不支持时，直接使用原路径
      resolve(filePath)
    }
  })
}

async function getTempFileURLs(keys) {
  return keys.map(k => getFileUrl(k))
}

function getFileUrl(key) {
  if (!key) return ''
  if (key.startsWith('http://') || key.startsWith('https://')) return key
  if (key.startsWith('wxfile://') || key.startsWith('/')) return key
  return `${wx.env.USER_DATA_PATH}/${key}`
}

// ============ 查询操作符构建器 ============

function makeOp(obj) {
  obj.and = function(other) {
    const a = { ...this }
    delete a.and
    const b = { ...other }
    delete b.and
    return makeOp({ ...a, ...b })
  }
  return obj
}

const _ = {
  gte: (v) => makeOp({ $gte: v }),
  lte: (v) => makeOp({ $lte: v }),
  gt: (v) => makeOp({ $gt: v }),
  lt: (v) => makeOp({ $lt: v }),
  neq: (v) => makeOp({ $ne: v }),
  in: (arr) => makeOp({ $in: arr }),
  regex: (pattern, options) => makeOp({ $regex: pattern, $options: options || '' }),
  and: (arr) => ({ $and: arr }),
  or: (arr) => ({ $or: arr }),
}

function RegExp(opts) {
  return _.regex(opts.regexp, opts.options)
}

module.exports = {
  request,
  BASE_URL,
  getToken,
  setToken,
  clearToken,
  query,
  queryOne,
  getById,
  count,
  add,
  update,
  remove,
  callFn,
  uploadFile,
  getTempFileURLs,
  getFileUrl,
  _,
  RegExp,
  db: { command: _ },
}
