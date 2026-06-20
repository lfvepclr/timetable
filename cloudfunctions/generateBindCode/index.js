// cloudfunctions/generateBindCode/index.js - 生成绑定码+小程序码
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

// 生成6位随机码
function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // 排除易混淆字符
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { student_id } = event

  if (!student_id) {
    return { code: -1, message: '缺少学生ID' }
  }

  try {
    // 验证学生存在
    const studentRes = await db.collection('students').doc(student_id).get()
    if (!studentRes.data) {
      return { code: -1, message: '学生不存在' }
    }

    // 检查已有未使用的绑定码
    const existingRes = await db.collection('bind_codes').where({
      student_id,
      status: 'pending'
    }).get()

    // 如果有未过期的码，直接返回
    const now = Date.now()
    for (const item of existingRes.data) {
      if (item.expire_at > now) {
        return {
          code: 0,
          data: {
            bind_code: item.code,
            bind_code_id: item._id,
            student_name: studentRes.data.name,
            qr_file_id: item.qr_file_id || ''
          }
        }
      }
    }

    // 生成新码
    let code = generateCode()
    let retryCount = 0
    let isUnique = false

    while (!isUnique && retryCount < 10) {
      const checkRes = await db.collection('bind_codes').where({ code }).count()
      if (checkRes.total === 0) {
        isUnique = true
      } else {
        code = generateCode()
        retryCount++
      }
    }

    // 过期时间24小时
    const expireAt = now + 24 * 60 * 60 * 1000

    // 生成小程序码
    let qrFileId = ''
    try {
      const qrRes = await cloud.openapi.wxacode.getUnlimited({
        scene: code,
        page: 'pages/common/bind/index',
        width: 280,
        autoColor: false,
        lineColor: { r: 74, g: 144, b: 217 }
      })
      if (qrRes.buffer) {
        const uploadRes = await cloud.uploadFile({
          cloudPath: `bind_qr/${code}.png`,
          fileContent: qrRes.buffer
        })
        qrFileId = uploadRes.fileID
      }
    } catch (qrErr) {
      console.error('生成小程序码失败:', qrErr)
    }

    // 存储绑定码
    const addRes = await db.collection('bind_codes').add({
      data: {
        code,
        student_id,
        student_name: studentRes.data.name,
        status: 'pending',
        expire_at: expireAt,
        qr_file_id: qrFileId,
        created_by: OPENID,
        created_at: now
      }
    })

    return {
      code: 0,
      data: {
        bind_code: code,
        bind_code_id: addRes._id,
        student_name: studentRes.data.name,
        qr_file_id: qrFileId
      }
    }
  } catch (err) {
    console.error('生成绑定码失败:', err)
    return { code: -1, message: err.message || '生成绑定码失败' }
  }
}
