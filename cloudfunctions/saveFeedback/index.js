// cloudfunctions/saveFeedback/index.js - 保存课后反馈
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const {
    lesson_id,
    student_id,
    content,        // 上课内容
    performance,    // 课堂表现
    homework,       // 课后作业
    teacher_comment,// 老师评语
    photos          // 照片fileID数组
  } = event

  if (!lesson_id || !student_id) {
    return { code: -1, message: '缺少必要参数' }
  }

  try {
    // 获取课程信息
    const lessonRes = await db.collection('lessons').doc(lesson_id).get()
    const lesson = lessonRes.data

    if (!lesson) {
      return { code: -1, message: '课程不存在' }
    }

    // 检查是否已有反馈
    const existingRes = await db.collection('feedbacks').where({
      lesson_id,
      student_id
    }).get()

    const now = Date.now()
    const feedbackData = {
      lesson_id,
      student_id,
      course_id: lesson.course_id,
      course_name: lesson.course_name,
      lesson_date: lesson.date,
      content: content || '',
      performance: performance || '',
      homework: homework || '',
      teacher_comment: teacher_comment || '',
      photos: photos || [],
      card_image_url: '',
      teacher_openid: OPENID,
      created_at: existingRes.data.length > 0 ? undefined : now,
      updated_at: now
    }

    let feedbackId
    if (existingRes.data.length > 0) {
      // 更新已有反馈
      feedbackId = existingRes.data[0]._id
      const updateData = { ...feedbackData }
      delete updateData.created_at
      delete updateData.lesson_id
      delete updateData.student_id
      delete updateData.course_id
      delete updateData.course_name
      delete updateData.lesson_date
      delete updateData.teacher_openid
      await db.collection('feedbacks').doc(feedbackId).update({ data: updateData })
    } else {
      // 创建新反馈
      const addRes = await db.collection('feedbacks').add({ data: feedbackData })
      feedbackId = addRes._id

      // 更新课程中的 feedback_id
      await db.collection('lessons').doc(lesson_id).update({
        data: {
          feedback_id: feedbackId,
          updated_at: now
        }
      })
    }

    return {
      code: 0,
      data: { feedback_id: feedbackId }
    }
  } catch (err) {
    console.error('保存反馈失败:', err)
    return { code: -1, message: err.message || '保存反馈失败' }
  }
}
