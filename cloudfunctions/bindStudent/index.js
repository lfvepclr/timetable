// cloudfunctions/bindStudent/index.js - 家长绑定学生
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { code, relationship } = event

  if (!code) {
    return { code: -1, message: '缺少绑定码' }
  }

  try {
    // 查找绑定码
    const codeRes = await db.collection('bind_codes').where({
      code,
      status: 'pending'
    }).get()

    if (codeRes.data.length === 0) {
      return { code: -1, message: '绑定码无效或已被使用' }
    }

    const bindCode = codeRes.data[0]
    const now = Date.now()

    // 检查是否过期
    if (bindCode.expire_at < now) {
      await db.collection('bind_codes').doc(bindCode._id).update({
        data: { status: 'expired' }
      })
      return { code: -1, message: '绑定码已过期，请联系老师重新生成' }
    }

    const studentId = bindCode.student_id

    // 检查是否已绑定
    const existBindRes = await db.collection('bindings').where({
      student_id: studentId,
      parent_openid: OPENID,
      status: 'active'
    }).get()

    if (existBindRes.data.length > 0) {
      return { code: -1, message: '您已绑定该学生' }
    }

    // 检查绑定人数限制（每学生最多2个家长）
    const bindCountRes = await db.collection('bindings').where({
      student_id: studentId,
      status: 'active'
    }).count()

    if (bindCountRes.total >= 2) {
      return { code: -1, message: '该学生绑定家长已达上限' }
    }

    // 创建绑定
    await db.collection('bindings').add({
      data: {
        student_id: studentId,
        student_name: bindCode.student_name,
        parent_openid: OPENID,
        relationship: relationship || '家长',
        status: 'active',
        created_at: now
      }
    })

    // 更新绑定码状态
    await db.collection('bind_codes').doc(bindCode._id).update({
      data: {
        status: 'used',
        used_by: OPENID,
        used_at: now
      }
    })

    // 更新用户能力：标记具备家长能力，并同步学生ID
    const userRes = await db.collection('users').where({ openid: OPENID }).get()
    if (userRes.data.length > 0) {
      const user = userRes.data[0]
      const updateData = {
        'capabilities.parent': true,
        student_ids: _.addToSet(studentId),
        updated_at: now
      }
      // 兼容旧 role 字段
      if (user.role && user.role !== 'parent') {
        updateData.role = 'parent'
      }
      await db.collection('users').doc(user._id).update({ data: updateData })
    }

    // 获取学生信息返回
    const studentRes = await db.collection('students').doc(studentId).get()

    return {
      code: 0,
      data: {
        student_id: studentId,
        student_name: bindCode.student_name,
        student: studentRes.data
      }
    }
  } catch (err) {
    console.error('绑定失败:', err)
    return { code: -1, message: err.message || '绑定失败' }
  }
}
