// cloudfunctions/login/index.js - 登录鉴权（支持老师/家长双能力）
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  if (!openid) {
    return { code: -1, message: '获取openid失败' }
  }

  // 查询用户是否已存在
  const userRes = await db.collection('users').where({ openid }).limit(1).get()

  let user
  let isNew = false

  if (userRes.data.length > 0) {
    // 已存在
    user = userRes.data[0]

    // 兼容迁移：旧 role 字段 -> capabilities
    if (!user.capabilities && user.role) {
      const hasBindings = await db.collection('bindings')
        .where({ parent_openid: openid, status: 'active' })
        .count()
      const caps = {
        teacher: user.role === 'teacher' || true, // 所有用户默认具备老师能力
        parent: user.role === 'parent' || hasBindings.total > 0
      }
      await db.collection('users').doc(user._id).update({
        data: {
          capabilities: caps,
          updated_at: Date.now()
        }
      })
      user.capabilities = caps
    }
  } else {
    // 新用户：默认具备老师能力，家长能力通过后续绑定获得
    isNew = true
    const now = Date.now()
    const addRes = await db.collection('users').add({
      data: {
        openid,
        capabilities: { teacher: true, parent: false },
        name: '',
        phone: '',
        avatar: '',
        student_ids: [],
        created_at: now,
        updated_at: now
      }
    })

    user = {
      _id: addRes._id,
      openid,
      capabilities: { teacher: true, parent: false }
    }
  }

  // 确保 capabilities 一定有值
  const capabilities = user.capabilities || { teacher: true, parent: false }

  return {
    code: 0,
    data: {
      openid,
      userId: user._id,
      userInfo: user,
      capabilities,
      isNew
    }
  }
}
// cloudfunctions/login/index.js - 登录鉴权
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  if (!openid) {
    return { code: -1, message: '获取openid失败' }
  }

  // 查询用户是否已存在
  const userRes = await db.collection('users').where({ openid }).limit(1).get()

  let user
  let isNew = false

  if (userRes.data.length > 0) {
    // 已存在
    user = userRes.data[0]
  } else {
    // 新用户：判断是否为老师
    const teacherOpenid = process.env.TEACHER_OPENID || ''
    const role = (teacherOpenid && openid === teacherOpenid) ? 'teacher' : 'parent'

    // 创建用户记录
    isNew = true
    const now = Date.now()
    const addRes = await db.collection('users').add({
      data: {
        openid,
        role,
        name: '',
        phone: '',
        avatar: '',
        student_ids: [],
        created_at: now,
        updated_at: now
      }
    })

    user = {
      _id: addRes._id,
      openid,
      role,
      name: '',
      student_ids: []
    }
  }

  return {
    code: 0,
    data: {
      openid,
      role: user.role,
      userId: user._id,
      userInfo: user,
      isNew
    }
  }
}
