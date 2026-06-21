// routes/notifications.js — 发送订阅消息
const express = require('express')
const router = express.Router()
const db = require('../lib/db')
const { authMiddleware } = require('../lib/auth')
const wxapi = require('../lib/wxapi')

router.use(authMiddleware)

// 模板配置
const TEMPLATE_CONFIGS = {
  feedback: {
    templateId: 'tmpl_feedback_id',
    page: (fid) => `/pages/parent/feedback-detail/feedback-detail?id=${fid || ''}`,
  },
  schedule_change: {
    templateId: 'tmpl_schedule_change_id',
    page: () => `/pages/parent/schedule/schedule`,
  },
  class_reminder: {
    templateId: 'tmpl_class_reminder_id',
    page: () => `/pages/parent/index/index`,
  },
  leave_notice: {
    templateId: 'tmpl_leave_notice_id',
    page: () => `/pages/parent/schedule/schedule`,
  },
}

function buildMessageData(type, studentName, lesson, extra) {
  const thing = (v) => ({ thing: { value: (v || '').substring(0, 20) } })
  const time = (v) => ({ time: { value: v || '' } })
  const phrase = (v) => ({ phrase: { value: v || '' } })
  const character_string = (v) => ({ character_string: { value: v || '' } })

  switch (type) {
    case 'feedback':
      return {
        thing1: thing(studentName + '的课程反馈'),
        thing2: thing(lesson ? lesson.course_name : ''),
        time3: time(lesson ? `${lesson.date} ${lesson.start_time}` : ''),
        thing4: thing((extra && extra.content) || '已提交反馈，请查看'),
        character_string5: character_string(extra && extra.feedback_id),
      }
    case 'schedule_change':
      return {
        thing1: thing(studentName),
        thing2: thing(lesson ? lesson.course_name : ''),
        time3: time(lesson ? `${lesson.date} ${lesson.start_time}` : ''),
        phrase4: phrase((extra && extra.action) || '已调整'),
        thing5: thing((extra && extra.reason) || '排课调整'),
      }
    case 'class_reminder':
      return {
        thing1: thing(studentName),
        thing2: thing(lesson ? lesson.course_name : ''),
        time3: time(lesson ? `${lesson.date} ${lesson.start_time}` : ''),
        thing4: thing('请准时上课'),
        phrase5: phrase('待上课'),
      }
    case 'leave_notice':
      return {
        thing1: thing(studentName),
        thing2: thing(lesson ? lesson.course_name : ''),
        time3: time(lesson ? `${lesson.date} ${lesson.start_time}` : ''),
        phrase4: phrase('已请假'),
        thing5: thing((extra && extra.reason) || '请假'),
      }
    default:
      return {}
  }
}

// POST /api/notifications/send
router.post('/send', async (req, res) => {
  try {
    const { type, student_id, lesson_id, feedback_id, extra_data } = req.body

    if (!type || !student_id) {
      return res.json({ code: -1, message: '缺少必要参数' })
    }

    const templateConfig = TEMPLATE_CONFIGS[type]
    if (!templateConfig) {
      return res.json({ code: -1, message: '不支持的通知类型' })
    }

    // 获取学生及其绑定的家长
    const studentRow = db.get('SELECT * FROM students WHERE id = ?', student_id)
    if (!studentRow) return res.json({ code: 0, data: { sent: 0, message: '学生不存在' } })
    const student = db.parseRow('students', studentRow)

    const parents = (student.parents || []).filter(p => p.status === 'active')
    if (parents.length === 0) {
      return res.json({ code: 0, data: { sent: 0, message: '无绑定家长' } })
    }

    // 获取课程信息
    let lesson = null
    if (lesson_id) {
      const lessonRow = db.get('SELECT * FROM lessons WHERE id = ?', lesson_id)
      if (lessonRow) lesson = db.parseRow('lessons', lessonRow)
    }

    // 构造消息数据
    const messageData = buildMessageData(type, student.name, lesson, extra_data)
    const page = templateConfig.page(feedback_id, lesson_id, student_id)

    // 发送订阅消息
    const results = await Promise.allSettled(
      parents.map(p => wxapi.sendSubscribeMessage(p.openid, templateConfig.templateId, page, messageData))
    )

    const sent = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected').length

    res.json({ code: 0, data: { sent, failed, total: parents.length } })
  } catch (err) {
    console.error('[notifications/send] 错误:', err)
    res.json({ code: -1, message: err.message })
  }
})

module.exports = router
