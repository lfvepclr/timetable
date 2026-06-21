// routes/fn.js — 通用函数分发（兼容客户端 callFn('functionName', data) 调用）
const express = require('express')
const router = express.Router()
const db = require('../lib/db')
const { authMiddleware } = require('../lib/auth')

// 引入业务处理函数
const lessonsRoute = require('./lessons')
const scheduleRoute = require('./schedule')
const studentsRoute = require('./students')
const feedbacksRoute = require('./feedbacks')
const notificationsRoute = require('./notifications')

router.use(authMiddleware)

// 通用函数分发：POST /api/fn/:name
router.post('/:name', async (req, res) => {
  const { name } = req.params
  const data = req.body
  const openid = req.auth.openid

  try {
    let result

    switch (name) {
      case 'login':
        // login 在 auth.js 中处理，这里不应到达
        return res.json({ code: -1, message: '请使用 /api/auth/login' })

      case 'generateSchedule':
        result = handleGenerateSchedule(data)
        break

      case 'checkSlotConflict':
        result = handleCheckConflict(data)
        break

      case 'completeLesson':
        result = handleCompleteLesson(data)
        break

      case 'requestLeave':
        result = handleRequestLeave(openid, data)
        break

      case 'rescheduleLesson':
        result = handleReschedule(openid, data)
        break

      case 'saveFeedback':
        result = handleSaveFeedback(openid, data)
        break

      case 'generateBindCode':
        result = await handleGenerateBindCode(openid, data)
        break

      case 'bindStudent':
        result = handleBindStudent(openid, data)
        break

      case 'sendNotification':
        result = await handleSendNotification(data)
        break

      case 'syncHolidays':
        // 节假日已静态化，无需同步
        result = { success: true, message: '节假日数据已内置，无需同步' }
        break

      default:
        return res.json({ code: -1, message: `未知函数: ${name}` })
    }

    res.json({ code: 0, data: result })
  } catch (err) {
    console.error(`[fn/${name}] 错误:`, err)
    res.json({ code: -1, message: err.message })
  }
})

// ============ 业务处理函数 ============

function handleGenerateSchedule(data) {
  const { pattern_ids, end_date, preview_only = false } = data
  if (!pattern_ids || !pattern_ids.length || !end_date) {
    throw new Error('参数缺失：需要 pattern_ids 和 end_date')
  }
  // 委托给 schedule 模块的逻辑（通过内部调用）
  // 这里直接复用 routes/schedule.js 的逻辑
  return _generateSchedule(pattern_ids, end_date, preview_only)
}

function _generateSchedule(pattern_ids, end_date, preview_only) {
  const path = require('path')
  const fs = require('fs')

  let holidayMap = {}
  try {
    const holidaysPath = path.join(__dirname, '..', 'data', 'holidays.json')
    const holidays = JSON.parse(fs.readFileSync(holidaysPath, 'utf-8'))
    holidays.forEach(h => { holidayMap[h.date] = h })
  } catch (e) { /* 忽略 */ }

  const placeholders = pattern_ids.map(() => '?').join(',')
  const patterns = db.all(
    `SELECT * FROM weekly_patterns WHERE id IN (${placeholders}) AND status = 'active'`,
    ...pattern_ids
  ).map(row => db.parseRow('weekly_patterns', row))

  if (patterns.length === 0) throw new Error('未找到有效的排课模板')

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const pad = n => (n < 10 ? '0' + n : '' + n)
  const formatDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

  const generated = [], skipped = [], conflicts = []

  for (const pattern of patterns) {
    const startDate = new Date(Math.max(
      new Date(pattern.valid_from || formatDate(today)).getTime(),
      today.getTime()
    ))
    const endDate = new Date(end_date)
    endDate.setHours(23, 59, 59, 999)
    const current = new Date(startDate)
    current.setHours(0, 0, 0, 0)

    while (current <= endDate) {
      const dateStr = formatDate(current)
      const dow = new Date(dateStr).getDay()
      const dayOfWeek = dow === 0 ? 7 : dow

      if (dayOfWeek === pattern.day_of_week) {
        const holiday = holidayMap[dateStr]
        if (holiday && holiday.is_off_day === false) {
          skipped.push({ date: dateStr, reason: '调休工作日', pattern: pattern.course_name })
          current.setDate(current.getDate() + 1)
          continue
        }

        const startTs = new Date(`${dateStr} ${pattern.start_time}:00`).getTime()
        const endTs = new Date(`${dateStr} ${pattern.end_time}:00`).getTime()

        const conflictRows = db.all(
          `SELECT * FROM lessons WHERE date = ? AND start_ts < ? AND end_ts > ? AND lesson_status != 'cancelled' LIMIT 5`,
          dateStr, endTs, startTs
        ).map(row => db.parseRow('lessons', row))

        const activeConflicts = conflictRows.filter(lesson =>
          !lesson.students || lesson.students.some(s => s.status === 'scheduled')
        )

        if (activeConflicts.length > 0) {
          conflicts.push({
            date: dateStr, pattern: pattern.course_name,
            conflict_lesson: activeConflicts[0].course_name,
            start_time: activeConflicts[0].start_time,
          })
          current.setDate(current.getDate() + 1)
          continue
        }

        const students = (pattern.student_ids || []).map((sid, idx) => ({
          student_id: sid,
          student_name: (pattern.student_names && pattern.student_names[idx]) || '',
          status: 'scheduled', consume_record: null, leave_reason: null, leave_at: null,
        }))

        generated.push({
          pattern_id: pattern.id, source: 'pattern',
          course_id: pattern.course_id, course_name: pattern.course_name,
          course_type: pattern.course_type, color: pattern.color || '#4A90D9',
          date: dateStr, start_time: pattern.start_time, end_time: pattern.end_time,
          start_ts: startTs, end_ts: endTs, students,
          lesson_status: 'scheduled', feedback_id: null, note: '',
          created_at: Date.now(), updated_at: Date.now(),
        })
      }
      current.setDate(current.getDate() + 1)
    }
  }

  if (preview_only) {
    return {
      generated: generated.map(g => ({
        date: g.date, start_time: g.start_time, end_time: g.end_time,
        course_name: g.course_name, students: g.students.map(s => s.student_name),
      })),
      skipped, conflicts,
      summary: { total: generated.length, skipped: skipped.length, conflicts: conflicts.length },
    }
  }

  const insertedIds = []
  const insertStmt = db.prepare(
    `INSERT INTO lessons (id, date, start_ts, end_ts, course_id, course_name, course_type, color,
      start_time, end_time, students, lesson_status, feedback_id, pattern_id, source, note, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  )
  db.transaction(() => {
    for (const lesson of generated) {
      const id = db.uuid()
      insertStmt.run(id, lesson.date, lesson.start_ts, lesson.end_ts,
        lesson.course_id, lesson.course_name, lesson.course_type, lesson.color,
        lesson.start_time, lesson.end_time, JSON.stringify(lesson.students),
        lesson.lesson_status, null, lesson.pattern_id, lesson.source, lesson.note,
        lesson.created_at, lesson.updated_at)
      insertedIds.push(id)
    }
  })

  return {
    inserted: insertedIds.length, skipped: skipped.length, conflicts: conflicts.length,
    skipped_detail: skipped, conflicts_detail: conflicts,
    summary: { total: generated.length, inserted: insertedIds.length, skipped: skipped.length, conflicts: conflicts.length },
  }
}

function handleCheckConflict(data) {
  const { date, start_ts, end_ts, exclude_lesson_id } = data
  if (!date || !start_ts || !end_ts) throw new Error('参数缺失')

  let sql = `SELECT * FROM lessons WHERE date = ? AND start_ts < ? AND end_ts > ? AND lesson_status != 'cancelled'`
  let params = [date, end_ts, start_ts]
  if (exclude_lesson_id) { sql += ` AND id != ?`; params.push(exclude_lesson_id) }
  sql += ` LIMIT 10`

  const rows = db.all(sql, ...params).map(row => db.parseRow('lessons', row))
  const activeConflicts = rows.filter(lesson =>
    !lesson.students || lesson.students.some(s => s.status === 'scheduled')
  )

  if (activeConflicts.length === 0) return { available: true, conflict: null }
  const conflict = activeConflicts[0]
  return {
    available: false,
    conflict: {
      _id: conflict.id, course_name: conflict.course_name,
      start_time: conflict.start_time, end_time: conflict.end_time, students: conflict.students,
    },
  }
}

function handleCompleteLesson(data) {
  const { lesson_id, attended_student_ids = [] } = data

  return db.transaction(() => {
    const lessonRow = db.get('SELECT * FROM lessons WHERE id = ?', lesson_id)
    if (!lessonRow) throw new Error('课程不存在')
    const lesson = db.parseRow('lessons', lessonRow)
    if (lesson.lesson_status === 'completed') throw new Error('该课程已完成')
    if (lesson.lesson_status === 'cancelled') throw new Error('该课程已取消')

    const students = [...lesson.students]
    const consumptions = []

    for (let i = 0; i < students.length; i++) {
      const student = students[i]
      if (attended_student_ids.includes(student.student_id)) {
        if (student.status === 'attended' && student.consume_record) {
          consumptions.push({
            student_id: student.student_id, student_name: student.student_name,
            package_id: student.consume_record.package_id, already_consumed: true,
          })
          continue
        }

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
        const consumeRecords = [...(pkg.consume_records || []), { lesson_id, consumed_at: Date.now() }]

        db.run(
          `UPDATE packages SET consumed_lessons = ?, remaining = ?, status = ?, consume_records = ?, updated_at = ? WHERE id = ?`,
          newConsumed, newRemaining, newStatus, JSON.stringify(consumeRecords), Date.now(), pkg.id
        )

        students[i] = { ...student, status: 'attended', consume_record: { package_id: pkg.id, consumed_at: Date.now() } }
        consumptions.push({
          student_id: student.student_id, student_name: student.student_name,
          package_id: pkg.id, remaining: newRemaining,
        })
      } else if (student.status === 'scheduled') {
        students[i] = { ...student, status: 'attended', consume_record: null }
      }
    }

    db.run(`UPDATE lessons SET lesson_status = 'completed', students = ?, updated_at = ? WHERE id = ?`,
      JSON.stringify(students), Date.now(), lesson_id)

    return { consumptions }
  })
}

function handleRequestLeave(openid, data) {
  const { lesson_id, student_id, reason } = data
  if (!lesson_id || !student_id) throw new Error('缺少必要参数')

  const lessonRow = db.get('SELECT * FROM lessons WHERE id = ?', lesson_id)
  if (!lessonRow) throw new Error('课程不存在')
  const lesson = db.parseRow('lessons', lessonRow)

  const students = lesson.students.map(s => {
    if (s.student_id === student_id) {
      return { ...s, status: 'on_leave', leave_reason: reason || '', leave_time: Date.now() }
    }
    return s
  })

  let sql = `UPDATE lessons SET students = ?, updated_at = ? WHERE id = ?`
  let params = [JSON.stringify(students), Date.now(), lesson_id]
  if (lesson.course_type === '1v1' && students.length === 1) {
    sql = `UPDATE lessons SET students = ?, lesson_status = 'cancelled', note = '学生请假', updated_at = ? WHERE id = ?`
  }
  db.run(sql, ...params)
  return { lesson_id, student_id, status: 'on_leave' }
}

function handleReschedule(openid, data) {
  const { original_lesson_id, student_id, new_date, new_start_time, new_end_time, target_lesson_id } = data
  if (!student_id || (!new_date && !target_lesson_id)) throw new Error('缺少必要参数')

  const now = Date.now()

  if (target_lesson_id) {
    const targetRow = db.get('SELECT * FROM lessons WHERE id = ?', target_lesson_id)
    if (!targetRow) throw new Error('目标课程不存在')
    const target = db.parseRow('lessons', targetRow)
    const activeStudents = target.students.filter(s => s.status === 'scheduled')
    const maxStudents = target.course_type === '1v1' ? 1 : target.course_type === '1v2' ? 2 : target.course_type === '1v3' ? 3 : 20
    if (activeStudents.length >= maxStudents) throw new Error('该课程已满员')

    const students = [...target.students, { student_id, status: 'scheduled', source: 'makeup', original_lesson_id: original_lesson_id || '' }]
    db.run(`UPDATE lessons SET students = ?, updated_at = ? WHERE id = ?`, JSON.stringify(students), now, target_lesson_id)
    return { lesson_id: target_lesson_id, action: 'joined' }
  }

  const startTs = new Date(`${new_date} ${new_start_time}:00`).getTime()
  const endTs = new Date(`${new_date} ${new_end_time}:00`).getTime()

  const conflicts = db.all(
    `SELECT * FROM lessons WHERE date = ? AND lesson_status != 'cancelled' AND start_ts < ? AND end_ts > ?`,
    new_date, endTs, startTs
  ).map(row => db.parseRow('lessons', row))

  if (conflicts.some(l => l.students && l.students.some(s => s.student_id === student_id && s.status !== 'on_leave'))) {
    throw new Error('该时段有冲突')
  }

  let courseInfo = {}
  if (original_lesson_id) {
    const origRow = db.get('SELECT * FROM lessons WHERE id = ?', original_lesson_id)
    if (origRow) {
      const orig = db.parseRow('lessons', origRow)
      courseInfo = { course_id: orig.course_id, course_name: orig.course_name, course_type: orig.course_type, color: orig.color }
    }
  }

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
    JSON.stringify([{ student_id, student_name: studentName, status: 'scheduled', source: 'makeup', original_lesson_id: original_lesson_id || '' }]),
    'scheduled', 'makeup', '', '', '', now, now
  )

  return { lesson_id: newId, action: 'created' }
}

function handleSaveFeedback(openid, data) {
  const { lesson_id, student_id, content, performance, homework, teacher_comment, photos } = data
  if (!lesson_id || !student_id) throw new Error('缺少必要参数')

  const lessonRow = db.get('SELECT * FROM lessons WHERE id = ?', lesson_id)
  if (!lessonRow) throw new Error('课程不存在')
  const lesson = db.parseRow('lessons', lessonRow)
  const now = Date.now()

  const existingRow = db.get('SELECT * FROM feedbacks WHERE lesson_id = ? AND student_id = ?', lesson_id, student_id)

  let feedbackId
  if (existingRow) {
    feedbackId = db.parseRow('feedbacks', existingRow).id
    db.run(
      `UPDATE feedbacks SET content = ?, performance = ?, homework = ?, teacher_comment = ?, photos = ?, updated_at = ? WHERE id = ?`,
      content || '', performance || '', homework || '', teacher_comment || '', JSON.stringify(photos || []), now, feedbackId
    )
  } else {
    feedbackId = db.uuid()
    db.run(
      `INSERT INTO feedbacks (id, lesson_id, student_id, course_id, course_name, lesson_date,
        content, performance, homework, teacher_comment, photos, card_image_url, teacher_openid, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      feedbackId, lesson_id, student_id, lesson.course_id || null, lesson.course_name || null, lesson.date,
      content || '', performance || '', homework || '', teacher_comment || '',
      JSON.stringify(photos || []), '', openid, now, now
    )
    db.run(`UPDATE lessons SET feedback_id = ?, updated_at = ? WHERE id = ?`, feedbackId, now, lesson_id)
  }

  return { feedback_id: feedbackId }
}

async function handleGenerateBindCode(openid, data) {
  const { student_id } = data
  if (!student_id) throw new Error('缺少学生ID')

  const studentRow = db.get('SELECT * FROM students WHERE id = ?', student_id)
  if (!studentRow) throw new Error('学生不存在')
  const student = db.parseRow('students', studentRow)

  const now = Date.now()
  const existingCodes = (student.bind_codes || []).filter(c => c.status === 'pending' && c.expire_at > now)
  if (existingCodes.length > 0) {
    const existing = existingCodes[0]
    return { bind_code: existing.code, bind_code_id: existing.id || '', student_name: student.name, qr_url: existing.qr_url || '' }
  }

  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]

  const expireAt = now + 24 * 60 * 60 * 1000
  const codeId = db.uuid()

  let qrUrl = ''
  try {
    const wxapi = require('../lib/wxapi')
    const storage = require('../lib/storage')
    const qrBuffer = await wxapi.generateWxaCode(code, 'pages/common/bind/index', 280)
    const qrKey = `bind_qr/${code}.png`
    await storage.save(qrKey, qrBuffer)
    qrUrl = storage.getUrl(qrKey)
  } catch (e) {
    console.warn('[fn/generateBindCode] 小程序码生成失败:', e.message)
  }

  const bindCodes = [...(student.bind_codes || []), { id: codeId, code, status: 'pending', expire_at: expireAt, qr_url: qrUrl, created_by: openid, created_at: now }]
  db.run(`UPDATE students SET bind_codes = ?, updated_at = ? WHERE id = ?`, JSON.stringify(bindCodes), now, student_id)

  return { bind_code: code, bind_code_id: codeId, student_name: student.name, qr_url: qrUrl }
}

function handleBindStudent(openid, data) {
  const { code, relationship } = data
  if (!code) throw new Error('缺少绑定码')

  const now = Date.now()
  const students = db.all('SELECT * FROM students').map(row => db.parseRow('students', row))

  let targetStudent = null, targetBindCode = null
  for (const student of students) {
    const found = (student.bind_codes || []).find(c => c.code === code && c.status === 'pending')
    if (found) { targetStudent = student; targetBindCode = found; break }
  }

  if (!targetStudent) throw new Error('绑定码无效或已被使用')
  if (targetBindCode.expire_at < now) {
    const codes = targetStudent.bind_codes.map(c => c.code === code ? { ...c, status: 'expired' } : c)
    db.run(`UPDATE students SET bind_codes = ?, updated_at = ? WHERE id = ?`, JSON.stringify(codes), now, targetStudent.id)
    throw new Error('绑定码已过期，请联系老师重新生成')
  }

  const parents = targetStudent.parents || []
  if (parents.some(p => p.openid === openid && p.status === 'active')) throw new Error('您已绑定该学生')
  if (parents.filter(p => p.status === 'active').length >= 2) throw new Error('该学生绑定家长已达上限')

  parents.push({ openid, relationship: relationship || '家长', status: 'active', bound_at: now })
  const updatedCodes = targetStudent.bind_codes.map(c => c.code === code ? { ...c, status: 'used', used_by: openid, used_at: now } : c)
  db.run(`UPDATE students SET parents = ?, bind_codes = ?, updated_at = ? WHERE id = ?`, JSON.stringify(parents), JSON.stringify(updatedCodes), now, targetStudent.id)

  const userRow = db.get('SELECT * FROM users WHERE openid = ?', openid)
  if (userRow) {
    const user = db.parseRow('users', userRow)
    const caps = user.capabilities || { teacher: true, parent: false }
    caps.parent = true
    db.run(`UPDATE users SET capabilities = ?, updated_at = ? WHERE id = ?`, JSON.stringify(caps), now, user.id || user._id)
  }

  return { student_id: targetStudent.id, student_name: targetStudent.name, student: targetStudent }
}

async function handleSendNotification(data) {
  const { type, student_id, lesson_id, feedback_id, extra_data } = data
  if (!type || !student_id) throw new Error('缺少必要参数')

  const notificationsRoute = require('./notifications')
  // 直接调用通知逻辑
  const studentRow = db.get('SELECT * FROM students WHERE id = ?', student_id)
  if (!studentRow) return { sent: 0, message: '学生不存在' }
  const student = db.parseRow('students', studentRow)
  const parents = (student.parents || []).filter(p => p.status === 'active')
  if (parents.length === 0) return { sent: 0, message: '无绑定家长' }

  const wxapi = require('../lib/wxapi')
  const TEMPLATE_CONFIGS = {
    feedback: { templateId: 'tmpl_feedback_id', page: () => `/pages/parent/feedback-detail/feedback-detail?id=${feedback_id || ''}` },
    schedule_change: { templateId: 'tmpl_schedule_change_id', page: () => `/pages/parent/schedule/schedule` },
    class_reminder: { templateId: 'tmpl_class_reminder_id', page: () => `/pages/parent/index/index` },
    leave_notice: { templateId: 'tmpl_leave_notice_id', page: () => `/pages/parent/schedule/schedule` },
  }
  const config = TEMPLATE_CONFIGS[type]
  if (!config) throw new Error('不支持的通知类型')

  let lesson = null
  if (lesson_id) {
    const lessonRow = db.get('SELECT * FROM lessons WHERE id = ?', lesson_id)
    if (lessonRow) lesson = db.parseRow('lessons', lessonRow)
  }

  const thing = v => ({ thing: { value: (v || '').substring(0, 20) } })
  const time = v => ({ time: { value: v || '' } })
  const phrase = v => ({ phrase: { value: v || '' } })

  let messageData = {}
  if (type === 'feedback') {
    messageData = { thing1: thing(student.name + '的课程反馈'), thing2: thing(lesson ? lesson.course_name : ''), time3: time(lesson ? `${lesson.date} ${lesson.start_time}` : ''), thing4: thing((extra_data && extra_data.content) || '已提交反馈，请查看') }
  } else if (type === 'class_reminder') {
    messageData = { thing1: thing(student.name), thing2: thing(lesson ? lesson.course_name : ''), time3: time(lesson ? `${lesson.date} ${lesson.start_time}` : ''), thing4: thing('请准时上课'), phrase5: phrase('待上课') }
  } else if (type === 'leave_notice') {
    messageData = { thing1: thing(student.name), thing2: thing(lesson ? lesson.course_name : ''), time3: time(lesson ? `${lesson.date} ${lesson.start_time}` : ''), phrase4: phrase('已请假'), thing5: thing((extra_data && extra_data.reason) || '请假') }
  } else if (type === 'schedule_change') {
    messageData = { thing1: thing(student.name), thing2: thing(lesson ? lesson.course_name : ''), time3: time(lesson ? `${lesson.date} ${lesson.start_time}` : ''), phrase4: phrase((extra_data && extra_data.action) || '已调整'), thing5: thing((extra_data && extra_data.reason) || '排课调整') }
  }

  const page = config.page()
  const results = await Promise.allSettled(parents.map(p => wxapi.sendSubscribeMessage(p.openid, config.templateId, page, messageData)))
  const sent = results.filter(r => r.status === 'fulfilled').length
  const failed = results.filter(r => r.status === 'rejected').length
  return { sent, failed, total: parents.length }
}

module.exports = router
