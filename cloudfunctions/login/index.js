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
