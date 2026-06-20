// cloudfunctions/completeLesson/index.js - 标记下课，事务消耗课时
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { lesson_id, attended_student_ids } = event

  if (!lesson_id) {
    return { code: -1, message: '参数缺失：lesson_id' }
  }

  try {
    const result = await db.runTransaction(async transaction => {
      // 1. 查询课程
      const lessonRes = await transaction.collection('lessons').doc(lesson_id).get()
      const lesson = lessonRes.data

      if (!lesson) {
        throw new Error('课程不存在')
      }

      if (lesson.lesson_status === 'completed') {
        throw new Error('该课程已完成')
      }

      if (lesson.lesson_status === 'cancelled') {
        throw new Error('该课程已取消')
      }

      // 2. 处理每个学生
      const consumptions = []
      const updatedStudents = [...lesson.students]

      for (let i = 0; i < updatedStudents.length; i++) {
        const student = updatedStudents[i]

        if (attended_student_ids && attended_student_ids.includes(student.student_id)) {
          // 出勤学生：消耗课时

          // 跳过已消耗的（回退后重新完成的情况）
          if (student.status === 'attended' && student.consume_record) {
            consumptions.push({
              student_id: student.student_id,
              student_name: student.student_name,
              package_id: student.consume_record.package_id,
              already_consumed: true
            })
            continue
          }

          // 查询该学生该课程的活跃课程包（FIFO）
          const pkgRes = await transaction.collection('packages')
            .where({
              student_id: student.student_id,
              course_id: lesson.course_id,
              status: 'active'
            })
            .orderBy('purchase_date', 'asc')
            .limit(1)
            .get()

          if (pkgRes.data.length === 0) {
            throw new Error(`学生 ${student.student_name} 没有可用的课程包`)
          }

          const pkg = pkgRes.data[0]

          // 更新课程包：消耗1次
          const newConsumed = pkg.consumed_lessons + 1
          const newRemaining = pkg.total_lessons - newConsumed
          const newStatus = newRemaining === 0 ? 'exhausted' : 'active'

          await transaction.collection('packages').doc(pkg._id).update({
            data: {
              consumed_lessons: newConsumed,
              remaining: newRemaining,
              status: newStatus,
              updated_at: Date.now()
            }
          })

          // 更新学生状态
          updatedStudents[i] = {
            ...student,
            status: 'attended',
            consume_record: {
              package_id: pkg._id,
              consumed_at: Date.now()
            }
          }

          consumptions.push({
            student_id: student.student_id,
            student_name: student.student_name,
            package_id: pkg._id,
            remaining: newRemaining
          })
        } else if (student.status === 'scheduled') {
          // 未出勤且未请假：标记为未出勤（不消耗）
          updatedStudents[i] = {
            ...student,
            status: 'attended',  // 默认标记出勤，但实际由前端控制
            consume_record: null
          }
        }
        // on_leave 的学生保持不变
      }

      // 3. 更新课程状态
      await transaction.collection('lessons').doc(lesson_id).update({
        data: {
          lesson_status: 'completed',
          students: updatedStudents,
          updated_at: Date.now()
        }
      })

      return { consumptions }
    })

    return {
      code: 0,
      data: result
    }
  } catch (err) {
    console.error('完成课程失败:', err)
    return {
      code: -1,
      message: err.message || '完成课程失败'
    }
  }
}

// 回退操作：撤销课程完成，退还课时
exports.rollback = async (event, context) => {
  const { lesson_id } = event

  if (!lesson_id) {
    return { code: -1, message: '参数缺失' }
  }

  try {
    const result = await db.runTransaction(async transaction => {
      const lessonRes = await transaction.collection('lessons').doc(lesson_id).get()
      const lesson = lessonRes.data

      if (!lesson || lesson.lesson_status !== 'completed') {
        throw new Error('课程未完成，无法回退')
      }

      // 退还已消耗的课时
      const updatedStudents = [...lesson.students]
      for (let i = 0; i < updatedStudents.length; i++) {
        const student = updatedStudents[i]
        if (student.consume_record && student.consume_record.package_id) {
          // 退还课程包
          const pkgRes = await transaction.collection('packages')
            .doc(student.consume_record.package_id)
            .get()

          if (pkgRes.data) {
            const pkg = pkgRes.data
            const newConsumed = Math.max(0, pkg.consumed_lessons - 1)
            const newRemaining = pkg.total_lessons - newConsumed
            const newStatus = newRemaining > 0 ? 'active' : 'exhausted'

            await transaction.collection('packages').doc(pkg._id).update({
              data: {
                consumed_lessons: newConsumed,
                remaining: newRemaining,
                status: newStatus,
                updated_at: Date.now()
              }
            })
          }

          // 清除消耗记录
          updatedStudents[i] = {
            ...student,
            status: 'scheduled',
            consume_record: null
          }
        }
      }

      // 恢复课程状态
      await transaction.collection('lessons').doc(lesson_id).update({
        data: {
          lesson_status: 'scheduled',
          students: updatedStudents,
          updated_at: Date.now()
        }
      })

      return { success: true }
    })

    return { code: 0, data: result }
  } catch (err) {
    console.error('回退失败:', err)
    return { code: -1, message: err.message }
  }
}
