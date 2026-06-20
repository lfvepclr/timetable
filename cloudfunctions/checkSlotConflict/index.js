// cloudfunctions/checkSlotConflict/index.js - 时段冲突检测
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { date, start_ts, end_ts, exclude_lesson_id } = event

  if (!date || !start_ts || !end_ts) {
    return { code: -1, message: '参数缺失' }
  }

  // 查询同一天、时间重叠、未取消的课程
  let queryChain = db.collection('lessons').where({
    date: date,
    start_ts: _.lt(end_ts),
    end_ts: _.gt(start_ts),
    lesson_status: _.neq('cancelled')
  })

  // 排除指定课程（编辑场景）
  if (exclude_lesson_id) {
    queryChain = db.collection('lessons').where({
      date: date,
      start_ts: _.lt(end_ts),
      end_ts: _.gt(start_ts),
      lesson_status: _.neq('cancelled'),
      _id: _.neq(exclude_lesson_id)
    })
  }

  const res = await queryChain.limit(10).get()

  // 过滤掉所有学生都请假的情况
  const activeConflicts = res.data.filter(lesson => {
    if (!lesson.students) return true
    return lesson.students.some(s => s.status === 'scheduled')
  })

  if (activeConflicts.length === 0) {
    return {
      code: 0,
      data: { available: true, conflict: null }
    }
  }

  // 返回第一个冲突
  const conflict = activeConflicts[0]
  return {
    code: 0,
    data: {
      available: false,
      conflict: {
        _id: conflict._id,
        course_name: conflict.course_name,
        start_time: conflict.start_time,
        end_time: conflict.end_time,
        students: conflict.students
      }
    }
  }
}
