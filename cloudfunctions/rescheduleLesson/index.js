// cloudfunctions/rescheduleLesson/index.js - 补课重排
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const {
    original_lesson_id,
    student_id,
    new_date,
    new_start_time,
    new_end_time,
    target_lesson_id  // 如果是加入已有课程
  } = event

  if (!student_id || (!new_date && !target_lesson_id)) {
    return { code: -1, message: '缺少必要参数' }
  }

  try {
    const now = Date.now()

    // 场景1: 加入已有课程
    if (target_lesson_id) {
      const targetRes = await db.collection('lessons').doc(target_lesson_id).get()
      const targetLesson = targetRes.data

      if (!targetLesson) {
        return { code: -1, message: '目标课程不存在' }
      }

      // 检查人数限制
      const activeStudents = targetLesson.students.filter(s => s.status === 'scheduled')
      const maxStudents = targetLesson.course_type === '1v1' ? 1 :
                         targetLesson.course_type === '1v2' ? 2 :
                         targetLesson.course_type === '1v3' ? 3 : 20

      if (activeStudents.length >= maxStudents) {
        return { code: -1, message: '该课程已满员' }
      }

      // 加入课程
      const students = [...targetLesson.students, {
        student_id,
        status: 'scheduled',
        source: 'makeup',
        original_lesson_id: original_lesson_id || ''
      }]

      await db.collection('lessons').doc(target_lesson_id).update({
        data: { students, updated_at: now }
      })

      return {
        code: 0,
        data: { lesson_id: target_lesson_id, action: 'joined' }
      }
    }

    // 场景2: 创建新补课课程
    const startTs = new Date(`${new_date} ${new_start_time}:00`).getTime()
    const endTs = new Date(`${new_date} ${new_end_time}:00`).getTime()

    // 冲突检测
    const conflictRes = await db.collection('lessons').where({
      date: new_date,
      lesson_status: _.neq('cancelled'),
      start_ts: _.lt(endTs),
      end_ts: _.gt(startTs),
      'students.student_id': student_id,
      'students.status': _.neq('on_leave')
    }).get()

    if (conflictRes.data.length > 0) {
      return { code: -1, message: '该时段有冲突' }
    }

    // 获取原课程信息
    let courseInfo = {}
    if (original_lesson_id) {
      const origRes = await db.collection('lessons').doc(original_lesson_id).get()
      if (origRes.data) {
        courseInfo = {
          course_id: origRes.data.course_id,
          course_name: origRes.data.course_name,
          course_type: origRes.data.course_type,
          course_color: origRes.data.course_color
        }
      }
    }

    // 获取学生姓名
    const studentRes = await db.collection('students').doc(student_id).get()
    const studentName = studentRes.data ? studentRes.data.name : ''

    const dayOfWeek = new Date(new_date).getDay()
    const dayOfWeekNum = dayOfWeek === 0 ? 7 : dayOfWeek

    const newLesson = {
      date: new_date,
      day_of_week: dayOfWeekNum,
      start_time: new_start_time,
      end_time: new_end_time,
      start_ts: startTs,
      end_ts: endTs,
      ...courseInfo,
      students: [{
        student_id,
        student_name: studentName,
        status: 'scheduled',
        source: 'makeup',
        original_lesson_id: original_lesson_id || ''
      }],
      lesson_status: 'scheduled',
      source: 'makeup',
      pattern_id: '',
      feedback_id: '',
      created_at: now,
      updated_at: now
    }

    const addRes = await db.collection('lessons').add({ data: newLesson })

    return {
      code: 0,
      data: { lesson_id: addRes._id, action: 'created' }
    }
  } catch (err) {
    console.error('补课重排失败:', err)
    return { code: -1, message: err.message || '补课重排失败' }
  }
}
