// routes/lessons.js — 课程操作：完成/回退/请假/补课重排
const express = require('express')
const router = express.Router()
const db = require('../lib/db')
const { authMiddleware } = require('../lib/auth')

router.use(authMiddleware)

// POST /api/lessons/:id/complete — 标记下课，FIFO 消耗课时
router.post('/:id/complete', (req, res) => {
  try {
    const lessonId = req.params.id
    const { attended_student_ids = [] } = req.body

    const result = db.transaction(() => {
      const lessonRow = db.get('SELECT * FROM lessons WHERE id = ?', lessonId)
      if (!lessonRow) throw new Error('课程不存在')
      const lesson = db.parseRow('lessons', lessonRow)

      if (lesson.lesson_status === 'completed') throw new Error('该课程已完成')
      if (lesson.lesson_status === 'cancelled') throw new Error('该课程已取消')

      const students = [...lesson.students]
      const consumptions = []

      for (let i = 0; i < students.length; i++) {
        const student = students[i]

        if (attended_student_ids.includes(student.student_id)) {
          // 跳过已消耗的
          if (student.status === 'attended' && student.consume_record) {
            consumptions.push({
              student_id: student.student_id,
              student_name: student.student_name,
              package_id: student.consume_record.package_id,
              already_consumed: true,
            })
            continue
          }

          // FIFO：查最旧活跃课包
          const pkgRow = db.get(
            `SELECT * FROM packages WHERE student_id = ? AND course_id = ? AND status = 'active'
             ORDER BY purchase_date ASC LIMIT 1`,
            student.student_id, lesson.course_id
          )
          if (!pkgRow) throw new Error(`学生 ${student.student_name} 没有可用的课程包`)
          const pkg = db.parseRow('packages', pkgRow)

          const newConsumed = pkg.consumed_lessons + 1
          const newRemaining = pkg.total_lessons - newConsumed
          const newStatus = newRemaining === 0 ? 'exhausted' : 'active'

          // 更新课包
          const consumeRecords = pkg.consume_records || []
          consumeRecords.push({
            lesson_id: lessonId,
            consumed_at: Date.now(),
          })

          db.run(
            `UPDATE packages SET consumed_lessons = ?, remaining = ?, status = ?, consume_records = ?, updated_at = ? WHERE id = ?`,
            newConsumed, newRemaining, newStatus, JSON.stringify(consumeRecords), Date.now(), pkg.id
          )

          // 更新学生状态
          students[i] = {
            ...student,
            status: 'attended',
            consume_record: { package_id: pkg.id, consumed_at: Date.now() },
          }

          consumptions.push({
            student_id: student.student_id,
            student_name: student.student_name,
            package_id: pkg.id,
            remaining: newRemaining,
          })
        } else if (student.status === 'scheduled') {
          students[i] = { ...student, status: 'attended', consume_record: null }
        }
      }

      // 更新课程状态
      db.run(
        `UPDATE lessons SET lesson_status = 'completed', students = ?, updated_at = ? WHERE id = ?`,
        JSON.stringify(students), Date.now(), lessonId
      )

      return { consumptions }
    })

    res.json({ code: 0, data: result })
  } catch (err) {
    console.error('[lessons/complete] 错误:', err)
    res.json({ code: -1, message: err.message })
  }
})

// POST /api/lessons/:id/rollback — 回退课程完成
router.post('/:id/rollback', (req, res) => {
  try {
    const lessonId = req.params.id

    const result = db.transaction(() => {
      const lessonRow = db.get('SELECT * FROM lessons WHERE id = ?', lessonId)
      if (!lessonRow) throw new Error('课程不存在')
      const lesson = db.parseRow('lessons', lessonRow)

      if (lesson.lesson_status !== 'completed') throw new Error('课程未完成，无法回退')

      const students = [...lesson.students]
      for (let i = 0; i < students.length; i++) {
        const student = students[i]
        if (student.consume_record && student.consume_record.package_id) {
          const pkgRow = db.get('SELECT * FROM packages WHERE id = ?', student.consume_record.package_id)
          if (pkgRow) {
            const pkg = db.parseRow('packages', pkgRow)
            const newConsumed = Math.max(0, pkg.consumed_lessons - 1)
            const newRemaining = pkg.total_lessons - newConsumed
            const newStatus = newRemaining > 0 ? 'active' : 'exhausted'

            // 移除最后一条消耗记录
            const consumeRecords = (pkg.consume_records || []).filter(
              r => r.lesson_id !== lessonId
            )

            db.run(
              `UPDATE packages SET consumed_lessons = ?, remaining = ?, status = ?, consume_records = ?, updated_at = ? WHERE id = ?`,
              newConsumed, newRemaining, newStatus, JSON.stringify(consumeRecords), Date.now(), pkg.id
            )
          }

          students[i] = { ...student, status: 'scheduled', consume_record: null }
        }
      }

      db.run(
        `UPDATE lessons SET lesson_status = 'scheduled', students = ?, updated_at = ? WHERE id = ?`,
        JSON.stringify(students), Date.now(), lessonId
      )

      return { success: true }
    })

    res.json({ code: 0, data: result })
  } catch (err) {
    console.error('[lessons/rollback] 错误:', err)
    res.json({ code: -1, message: err.message })
  }
})

// POST /api/lessons/:id/leave — 学生请假
router.post('/:id/leave', (req, res) => {
  try {
    const lessonId = req.params.id
    const { student_id, reason } = req.body

    if (!student_id) return res.json({ code: -1, message: '缺少 student_id' })

    const lessonRow = db.get('SELECT * FROM lessons WHERE id = ?', lessonId)
    if (!lessonRow) return res.json({ code: -1, message: '课程不存在' })
    const lesson = db.parseRow('lessons', lessonRow)

    const students = lesson.students.map(s => {
      if (s.student_id === student_id) {
        return { ...s, status: 'on_leave', leave_reason: reason || '', leave_time: Date.now() }
      }
      return s
    })

    let updateSql = `UPDATE lessons SET students = ?, updated_at = ? WHERE id = ?`
    let params = [JSON.stringify(students), Date.now(), lessonId]

    // 1v1 课程且学生请假 → 整节取消
    if (lesson.course_type === '1v1' && students.length === 1) {
      updateSql = `UPDATE lessons SET students = ?, lesson_status = 'cancelled', note = '学生请假', updated_at = ? WHERE id = ?`
    }

    db.run(updateSql, ...params)

    res.json({ code: 0, data: { lesson_id: lessonId, student_id, status: 'on_leave' } })
  } catch (err) {
    console.error('[lessons/leave] 错误:', err)
    res.json({ code: -1, message: err.message })
  }
})

// POST /api/lessons/:id/reschedule — 补课重排
router.post('/:id/reschedule', (req, res) => {
  try {
    const originalLessonId = req.params.id
    const { student_id, new_date, new_start_time, new_end_time, target_lesson_id } = req.body

    if (!student_id || (!new_date && !target_lesson_id)) {
      return res.json({ code: -1, message: '缺少必要参数' })
    }

    const now = Date.now()

    // 场景1：加入已有课程
    if (target_lesson_id) {
      const targetRow = db.get('SELECT * FROM lessons WHERE id = ?', target_lesson_id)
      if (!targetRow) return res.json({ code: -1, message: '目标课程不存在' })
      const target = db.parseRow('lessons', targetRow)

      const activeStudents = target.students.filter(s => s.status === 'scheduled')
      const maxStudents = target.course_type === '1v1' ? 1 :
                         target.course_type === '1v2' ? 2 :
                         target.course_type === '1v3' ? 3 : 20

      if (activeStudents.length >= maxStudents) {
        return res.json({ code: -1, message: '该课程已满员' })
      }

      const students = [...target.students, {
        student_id, status: 'scheduled', source: 'makeup',
        original_lesson_id: originalLessonId || '',
      }]

      db.run(`UPDATE lessons SET students = ?, updated_at = ? WHERE id = ?`,
        JSON.stringify(students), now, target_lesson_id)

      return res.json({ code: 0, data: { lesson_id: target_lesson_id, action: 'joined' } })
    }

    // 场景2：创建新补课课程
    const startTs = new Date(`${new_date} ${new_start_time}:00`).getTime()
    const endTs = new Date(`${new_date} ${new_end_time}:00`).getTime()

    // 冲突检测
    const conflicts = db.all(
      `SELECT * FROM lessons WHERE date = ? AND lesson_status != 'cancelled' AND start_ts < ? AND end_ts > ?`,
      new_date, endTs, startTs
    ).map(row => db.parseRow('lessons', row))

    const hasConflict = conflicts.some(lesson => {
      return lesson.students && lesson.students.some(s =>
        s.student_id === student_id && s.status !== 'on_leave'
      )
    })

    if (hasConflict) return res.json({ code: -1, message: '该时段有冲突' })

    // 获取原课程信息
    let courseInfo = {}
    if (originalLessonId) {
      const origRow = db.get('SELECT * FROM lessons WHERE id = ?', originalLessonId)
      if (origRow) {
        const orig = db.parseRow('lessons', origRow)
        courseInfo = {
          course_id: orig.course_id,
          course_name: orig.course_name,
          course_type: orig.course_type,
          color: orig.color,
        }
      }
    }

    // 获取学生姓名
    const studentRow = db.get('SELECT * FROM students WHERE id = ?', student_id)
    const studentName = studentRow ? db.parseRow('students', studentRow).name : ''

    const dayOfWeek = new Date(new_date).getDay()
    const dayOfWeekNum = dayOfWeek === 0 ? 7 : dayOfWeek

    const newId = db.uuid()
    db.run(
      `INSERT INTO lessons (id, date, start_ts, end_ts, course_id, course_name, course_type, color,
        start_time, end_time, students, lesson_status, source, pattern_id, feedback_id, note, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      newId, new_date, startTs, endTs,
      courseInfo.course_id || null, courseInfo.course_name || null, courseInfo.course_type || null, courseInfo.color || '#4A90D9',
      new_start_time, new_end_time,
      JSON.stringify([{ student_id, student_name: studentName, status: 'scheduled', source: 'makeup', original_lesson_id: originalLessonId || '' }]),
      'scheduled', 'makeup', '', '', '', now, now
    )

    res.json({ code: 0, data: { lesson_id: newId, action: 'created' } })
  } catch (err) {
    console.error('[lessons/reschedule] 错误:', err)
    res.json({ code: -1, message: err.message })
  }
})

module.exports = router
