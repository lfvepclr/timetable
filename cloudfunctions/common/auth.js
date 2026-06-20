// cloudfunctions/common/auth.js - 鉴权工具
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 预设的老师 openid（部署时在云函数环境变量中配置 TEACHER_OPENID）
function getTeacherOpenid() {
  return process.env.TEACHER_OPENID || ''
}

/**
 * 获取当前请求用户的 openid
 */
function getOpenid(event) {
  return cloud.getWXContext().OPENID
}

/**
 * 判断当前用户是否为老师
 */
async function isTeacher(event) {
  const openid = getOpenid(event)
  const teacherOpenid = getTeacherOpenid()

  // 优先通过环境变量判断
  if (teacherOpenid && openid === teacherOpenid) {
    return true
  }

  // 其次查数据库
  const userRes = await db.collection('users').where({ openid }).limit(1).get()
  if (userRes.data.length > 0 && userRes.data[0].role === 'teacher') {
    return true
  }

  return false
}

/**
 * 获取当前用户信息
 */
async function getCurrentUser(event) {
  const openid = getOpenid(event)
  const res = await db.collection('users').where({ openid }).limit(1).get()
  return res.data[0] || null
}

/**
 * 获取当前用户绑定的学生ID列表（家长/学生角色）
 */
async function getBoundStudentIds(event) {
  const user = await getCurrentUser(event)
  if (!user) return []

  if (user.role === 'teacher') {
    // 老师可看所有学生
    return null
  }

  // 查 bindings 表
  const bindRes = await db.collection('bindings')
    .where({ parent_openid: user.openid, status: 'active' })
    .get()

  return bindRes.data.map(b => b.student_id)
}

/**
 * 权限校验：确保当前用户是老师
 */
async function requireTeacher(event) {
  const isT = await isTeacher(event)
  if (!isT) {
    throw new Error('无权限：仅老师可执行此操作')
  }
  return true
}

module.exports = {
  getTeacherOpenid,
  getOpenid,
  isTeacher,
  getCurrentUser,
  getBoundStudentIds,
  requireTeacher
}
