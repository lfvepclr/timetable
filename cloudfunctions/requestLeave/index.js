// cloudfunctions/requestLeave/index.js - 学生请假
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { lesson_id, student_id, reason } = event

  if (!lesson_id || !student_id) {
    return { code: -1, message: '缺少必要参数' }
  }

  try {
    const lessonRes = await db.collection('lessons').doc(lesson_id).get()
    const lesson = lessonRes.data

    if (!lesson) {
      return { code: -1, message: '课程不存在' }
    }

    // 更新学生状态为请假
    const students = lesson.students.map(s => {
      if (s.student_id === student_id) {
        return {
          ...s,
          status: 'on_leave',
          leave_reason: reason || '',
          leave_time: Date.now()
        }
      }
      return s
    })

    await db.collection('lessons').doc(lesson_id).update({
      data: {
        students,
        updated_at: Date.now()
      }
    })

    // 如果是1v1课程且学生请假，整节课状态改为cancelled
    if (lesson.course_type === '1v1' && students.length === 1) {
      await db.collection('lessons').doc(lesson_id).update({
        data: {
          lesson_status: 'cancelled',
          cancel_reason: '学生请假',
          cancelled_at: Date.now()
        }
      })
    }

    return {
      code: 0,
      data: { lesson_id, student_id, status: 'on_leave' }
    }
  } catch (err) {
    console.error('请假处理失败:', err)
    return { code: -1, message: err.message || '请假处理失败' }
  }
}
