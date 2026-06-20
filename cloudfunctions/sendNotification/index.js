// cloudfunctions/sendNotification/index.js - 发送订阅消息通知
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const {
    type,          // feedback | schedule_change | class_reminder | leave_notice
    student_id,
    lesson_id,
    feedback_id,
    extra_data     // 额外数据
  } = event

  if (!type || !student_id) {
    return { code: -1, message: '缺少必要参数' }
  }

  try {
    // 获取绑定该学生的家长openid
    const bindRes = await db.collection('bindings').where({
      student_id,
      status: 'active'
    }).get()

    if (bindRes.data.length === 0) {
      return { code: 0, data: { sent: 0, message: '无绑定家长' } }
    }

    // 获取学生信息
    const studentRes = await db.collection('students').doc(student_id).get()
    const studentName = studentRes.data ? studentRes.data.name : ''

    // 获取课程信息
    let lesson = null
    if (lesson_id) {
      const lessonRes = await db.collection('lessons').doc(lesson_id).get()
      lesson = lessonRes.data
    }

    // 根据类型构造消息
    const messages = []
    const templateConfig = getTemplateConfig(type)

    if (!templateConfig) {
      return { code: -1, message: '不支持的通知类型' }
    }

    for (const binding of bindRes.data) {
      const parentOpenid = binding.parent_openid
      const data = buildMessageData(type, studentName, lesson, extra_data)

      messages.push(
        cloud.openapi.subscribeMessage.send({
          touser: parentOpenid,
          templateId: templateConfig.templateId,
          page: templateConfig.page(feedback_id, lesson_id, student_id),
          data
        })
      )
    }

    // 批量发送
    const results = await Promise.allSettled(messages)
    const sent = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected').length

    return {
      code: 0,
      data: { sent, failed, total: bindRes.data.length }
    }
  } catch (err) {
    console.error('发送通知失败:', err)
    return { code: -1, message: err.message || '发送通知失败' }
  }
}

// 获取模板配置
function getTemplateConfig(type) {
  const configs = {
    feedback: {
      templateId: 'tmpl_feedback_id',
      page: (fid, lid, sid) => `/pages/parent/feedback-detail/feedback-detail?id=${fid || ''}`
    },
    schedule_change: {
      templateId: 'tmpl_schedule_change_id',
      page: (fid, lid, sid) => `/pages/parent/schedule/schedule`
    },
    class_reminder: {
      templateId: 'tmpl_class_reminder_id',
      page: (fid, lid, sid) => `/pages/parent/index/index`
    },
    leave_notice: {
      templateId: 'tmpl_leave_notice_id',
      page: (fid, lid, sid) => `/pages/parent/schedule/schedule`
    }
  }
  return configs[type]
}

// 构造消息数据
function buildMessageData(type, studentName, lesson, extra) {
  const thing = (value) => ({ thing: { value: (value || '').substring(0, 20) } })
  const time = (value) => ({ time: { value: value || '' } })
  const phrase = (value) => ({ phrase: { value: value || '' } })
  const character_string = (value) => ({ character_string: { value: value || '' } })

  switch (type) {
    case 'feedback':
      return {
        thing1: thing(studentName + '的课程反馈'),
        thing2: thing(lesson ? lesson.course_name : ''),
        time3: time(lesson ? `${lesson.date} ${lesson.start_time}` : ''),
        thing4: thing((extra && extra.content) || '已提交反馈，请查看'),
        character_string5: character_string(extra && extra.feedback_id)
      }
    case 'schedule_change':
      return {
        thing1: thing(studentName),
        thing2: thing(lesson ? lesson.course_name : ''),
        time3: time(lesson ? `${lesson.date} ${lesson.start_time}` : ''),
        phrase4: phrase((extra && extra.action) || '已调整'),
        thing5: thing((extra && extra.reason) || '排课调整')
      }
    case 'class_reminder':
      return {
        thing1: thing(studentName),
        thing2: thing(lesson ? lesson.course_name : ''),
        time3: time(lesson ? `${lesson.date} ${lesson.start_time}` : ''),
        thing4: thing('请准时上课'),
        phrase5: phrase('待上课')
      }
    case 'leave_notice':
      return {
        thing1: thing(studentName),
        thing2: thing(lesson ? lesson.course_name : ''),
        time3: time(lesson ? `${lesson.date} ${lesson.start_time}` : ''),
        phrase4: phrase('已请假'),
        thing5: thing((extra && extra.reason) || '请假')
      }
    default:
      return {}
  }
}
