// lib/storage.js — 文件存储抽象（可迁移：本地 fs / 未来 R2 binding）
const fs = require('fs')
const path = require('path')
const config = require('../config')

// 确保上传目录存在
if (!fs.existsSync(config.uploadDir)) {
  fs.mkdirSync(config.uploadDir, { recursive: true })
}

/**
 * 保存文件
 * @param {string} key 存储路径（如 media/feedback/xxx.jpg）
 * @param {Buffer} buffer 文件内容
 * @returns {string} key
 */
async function save(key, buffer) {
  const fullPath = path.join(config.uploadDir, key)
  fs.mkdirSync(path.dirname(fullPath), { recursive: true })
  fs.writeFileSync(fullPath, buffer)
  return key
}

/**
 * 获取文件访问 URL
 * @param {string} key
 * @returns {string}
 */
function getUrl(key) {
  if (!key) return ''
  // 已经是完整 URL 直接返回
  if (key.startsWith('http://') || key.startsWith('https://')) return key
  return `http://localhost:${config.port}/uploads/${key}`
}

/**
 * 批量获取文件 URL
 * @param {string[]} keys
 * @returns {Array<{key: string, url: string}>}
 */
function getUrls(keys) {
  return (keys || []).map(key => ({ key, url: getUrl(key) }))
}

/**
 * 删除文件
 * @param {string} key
 */
async function remove(key) {
  const fullPath = path.join(config.uploadDir, key)
  try { fs.unlinkSync(fullPath) } catch { /* 忽略不存在 */ }
}

/**
 * 获取文件本地路径（供 Express static 或下载使用）
 * @param {string} key
 * @returns {string}
 */
function getLocalPath(key) {
  return path.join(config.uploadDir, key)
}

module.exports = { save, getUrl, getUrls, remove, getLocalPath }
