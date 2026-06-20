// cloudfunctions/common/notify.js - 通知发送封装
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

// 订阅消息模板ID（部署时替换为实际模板ID）
const TEMPLATES = {
  FEEDBACK: process.env.TMPL_FEEDBACK || '',
  SCHEDULE_CHANGE: process.env.TMPL_SCHEDULE_CHANGE || '',
  CLASS_REMINDER: process.env.TMPL_CLASS_REMINDER || '',
  LEAVE_NOTICE: process.env.TMPL_LEAVE_NOTICE || ''
}

/**
 * 发送订阅消息
 * @param {string} openid 接收者openid
 * @param {string} templateType 模板类型
 * @param {object} data 模板数据
 * @param {string} page 跳转页面
 */
async function sendSubscribeMessage(openid, templateType, data, page) {
  const templateId = TEMPLATES[templateType]
  if (!templateId) {
    console.warn(`模板 ${templateType} 未配置`)
    return { success: false, reason: '模板未配置' }
  }

  try {
    const result = await cloud.openapi.subscribeMessage.send({
      touser: openid,
      templateId,
      page: page || 'pages/parent/index/index',
      data: data,
      miniprogramState: 'formal'
    })
    return { success: true, result }
  } catch (err) {
    console.error(`发送订阅消息失败: ${templateType}`, err)
    return { success: false, reason: err.errMsg || err.message }
  }
}

/**
 * 批量发送订阅消息
 */
async function batchSendSubscribeMessage(openids, templateType, dataBuilder, page) {
  const results = []
  for (const openid of openids) {
    const data = typeof dataBuilder === 'function' ? dataBuilder(openid) : dataBuilder
    const result = await sendSubscribeMessage(openid, templateType, data, page)
    results.push({ openid, ...result })
  }
  return results
}

/**
 * 获取学生所有绑定家长的 openid
 */
async function getParentOpenidsByStudent(db, studentId) {
  const res = await db.collection('bindings')
    .where({ student_id: studentId, status: 'active' })
    .get()
  return res.data.map(b => b.parent_openid)
}

module.exports = {
  TEMPLATES,
  sendSubscribeMessage,
  batchSendSubscribeMessage,
  getParentOpenidsByStudent
}
