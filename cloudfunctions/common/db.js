// cloudfunctions/common/db.js - 云函数端数据库操作封装
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

/**
 * 批量插入数据（分批，每批20条，云函数限制）
 */
async function batchInsert(collection, dataList) {
  const results = []
  const batchSize = 20

  for (let i = 0; i < dataList.length; i += batchSize) {
    const batch = dataList.slice(i, i + batchSize)
    const tasks = batch.map(data => db.collection(collection).add({ data }))
    const res = await Promise.all(tasks)
    results.push(...res.map(r => r._id))
  }

  return results
}

/**
 * 分页查询（突破100条限制）
 */
async function queryAll(collection, where = {}, orderBy) {
  const MAX_LIMIT = 100
  let chain = db.collection(collection)
  if (Object.keys(where).length > 0) {
    chain = chain.where(where)
  }
  if (orderBy) {
    chain = chain.orderBy(orderBy[0], orderBy[1])
  }

  const countRes = await chain.count()
  const total = countRes.total
  const batchTimes = Math.ceil(total / MAX_LIMIT)

  const tasks = []
  for (let i = 0; i < batchTimes; i++) {
    let c = db.collection(collection)
    if (Object.keys(where).length > 0) {
      c = c.where(where)
    }
    if (orderBy) {
      c = c.orderBy(orderBy[0], orderBy[1])
    }
    tasks.push(c.skip(i * MAX_LIMIT).limit(MAX_LIMIT).get())
  }

  const results = await Promise.all(tasks)
  return results.reduce((acc, cur) => acc.concat(cur.data), [])
}

module.exports = {
  db,
  _,
  batchInsert,
  queryAll
}
