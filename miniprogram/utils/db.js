// utils/db.js - 云数据库操作封装

const db = wx.cloud.database()
const _ = db.command

/**
 * 查询集合（分页）
 * @param {string} collection 集合名
 * @param {object} where 查询条件
 * @param {object} options { page, pageSize, orderBy, field }
 */
async function query(collection, where = {}, options = {}) {
  const { page = 1, pageSize = 20, orderBy, field } = options
  const skip = (page - 1) * pageSize

  let chain = db.collection(collection)
  if (Object.keys(where).length > 0) {
    chain = chain.where(where)
  }
  if (field) {
    chain = chain.field(field)
  }
  if (orderBy) {
    chain = chain.orderBy(orderBy[0], orderBy[1])
  }
  chain = chain.skip(skip).limit(pageSize)

  const res = await chain.get()
  return res.data
}

/**
 * 查询单条记录
 */
async function queryOne(collection, where = {}, options = {}) {
  const list = await query(collection, where, { ...options, page: 1, pageSize: 1 })
  return list[0] || null
}

/**
 * 按ID查询
 */
async function getById(collection, id) {
  const res = await db.collection(collection).doc(id).get()
  return res.data
}

/**
 * 查询总数
 */
async function count(collection, where = {}) {
  let chain = db.collection(collection)
  if (Object.keys(where).length > 0) {
    chain = chain.where(where)
  }
  const res = await chain.count()
  return res.total
}

/**
 * 添加记录
 */
async function add(collection, data) {
  const res = await db.collection(collection).add({ data })
  return res._id
}

/**
 * 更新记录
 */
async function update(collection, id, data) {
  const res = await db.collection(collection).doc(id).update({ data })
  return res.stats.updated
}

/**
 * 删除记录
 */
async function remove(collection, id) {
  const res = await db.collection(collection).doc(id).remove()
  return res.stats.removed
}

module.exports = {
  db,
  _,
  query,
  queryOne,
  getById,
  count,
  add,
  update,
  remove
}
