// routes/schedule.js — 排课生成 + 冲突检测
const express = require('express')
const router = express.Router()
const db = require('../lib/db')
const { authMiddleware } = require('../lib/auth')
const path = require('path')
const fs = require('fs')

router.use(authMiddleware)

// 加载节假日数据
let holidayMap = {}
try {
  const holidaysPath = path.join(__dirname, '..', 'data', 'holidays.json')
  const holidays = JSON.parse(fs.readFileSync(holidaysPath, 'utf-8'))
  holidays.forEach(h => { holidayMap[h.date] = h })
} catch (e) {
  console.warn('[schedule] 节假日数据未加载:', e.message)
}

function formatDate(d) {
  const pad = n => (n < 10 ? '0' + n : '' + n)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function getDayOfWeek(dateStr) {
  const day = new Date(dateStr).getDay()
  return day === 0 ? 7 : day
}

function getTimestamp(dateStr, timeStr) {
  return new Date(`${dateStr} ${timeStr}:00`).getTime()
}

// POST /api/schedule/generate — 周模式批量生成排课
router.post('/generate', (req, res) => {
  try {
    const { pattern_ids, end_date, preview_only = false } = req.body

    if (!pattern_ids || !pattern_ids.length || !end_date) {
      return res.json({ code: -1, message: '参数缺失：需要 pattern_ids 和 end_date' })
    }

    // 查询周模式
    const placeholders = pattern_ids.map(() => '?').join(',')
    const patterns = db.all(
      `SELECT * FROM weekly_patterns WHERE id IN (${placeholders}) AND status = 'active'`,
      ...pattern_ids
    ).map(row => db.parseRow('weekly_patterns', row))

    if (patterns.length === 0) {
      return res.json({ code: -1, message: '未找到有效的排课模板' })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = formatDate(today)

    const generated = []
    const skipped = []
    const conflicts = []

    for (const pattern of patterns) {
      const startDate = new Date(Math.max(
        new Date(pattern.valid_from || todayStr).getTime(),
        today.getTime()
      ))
      const endDate = new Date(end_date)
      endDate.setHours(23, 59, 59, 999)

      const current = new Date(startDate)
      current.setHours(0, 0, 0, 0)

      while (current <= endDate) {
        const dateStr = formatDate(current)
        const dow = getDayOfWeek(dateStr)

        if (dow === pattern.day_of_week) {
          const holiday = holidayMap[dateStr]

          if (holiday && holiday.is_off_day === false) {
            skipped.push({ date: dateStr, reason: '调休工作日', pattern: pattern.course_name })
            current.setDate(current.getDate() + 1)
            continue
          }

          const startTs = getTimestamp(dateStr, pattern.start_time)
          const endTs = getTimestamp(dateStr, pattern.end_time)

          // 冲突检测
          const conflictRows = db.all(
            `SELECT * FROM lessons WHERE date = ? AND start_ts < ? AND end_ts > ? AND lesson_status != 'cancelled' LIMIT 5`,
            dateStr, endTs, startTs
          ).map(row => db.parseRow('lessons', row))

          const activeConflicts = conflictRows.filter(lesson => {
            if (!lesson.students) return true
            return lesson.students.some(s => s.status === 'scheduled')
          })

          if (activeConflicts.length > 0) {
            conflicts.push({
              date: dateStr,
              pattern: pattern.course_name,
              conflict_lesson: activeConflicts[0].course_name,
              start_time: activeConflicts[0].start_time,
            })
            current.setDate(current.getDate() + 1)
            continue
          }

          const students = (pattern.student_ids || []).map((sid, idx) => ({
            student_id: sid,
            student_name: (pattern.student_names && pattern.student_names[idx]) || '',
            status: 'scheduled',
            consume_record: null,
            leave_reason: null,
            leave_at: null,
          }))

          generated.push({
            pattern_id: pattern.id,
            source: 'pattern',
            course_id: pattern.course_id,
            course_name: pattern.course_name,
            course_type: pattern.course_type,
            color: pattern.color || '#4A90D9',
            date: dateStr,
            start_time: pattern.start_time,
            end_time: pattern.end_time,
            start_ts: startTs,
            end_ts: endTs,
            students,
            lesson_status: 'scheduled',
            feedback_id: null,
            note: '',
            created_at: Date.now(),
            updated_at: Date.now(),
          })
        }

        current.setDate(current.getDate() + 1)
      }
    }

    // 预览模式
    if (preview_only) {
      return res.json({
        code: 0,
        data: {
          generated: generated.map(g => ({
            date: g.date,
            start_time: g.start_time,
            end_time: g.end_time,
            course_name: g.course_name,
            students: g.students.map(s => s.student_name),
          })),
          skipped,
          conflicts,
          summary: {
            total: generated.length,
            skipped: skipped.length,
            conflicts: conflicts.length,
          },
        },
      })
    }

    // 批量写入
    const insertedIds = []
    const insertStmt = db.prepare(
      `INSERT INTO lessons (id, date, start_ts, end_ts, course_id, course_name, course_type, color,
        start_time, end_time, students, lesson_status, feedback_id, pattern_id, source, note, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    )

    db.transaction(() => {
      for (const lesson of generated) {
        const id = db.uuid()
        insertStmt.run(
          id, lesson.date, lesson.start_ts, lesson.end_ts,
          lesson.course_id, lesson.course_name, lesson.course_type, lesson.color,
          lesson.start_time, lesson.end_time, JSON.stringify(lesson.students),
          lesson.lesson_status, null, lesson.pattern_id, lesson.source, lesson.note,
          lesson.created_at, lesson.updated_at
        )
        insertedIds.push(id)
      }
    })

    res.json({
      code: 0,
      data: {
        inserted: insertedIds.length,
        skipped: skipped.length,
        conflicts: conflicts.length,
        skipped_detail: skipped,
        conflicts_detail: conflicts,
        summary: {
          total: generated.length,
          inserted: insertedIds.length,
          skipped: skipped.length,
          conflicts: conflicts.length,
        },
      },
    })
  } catch (err) {
    console.error('[schedule/generate] 错误:', err)
    res.json({ code: -1, message: err.message })
  }
})

// POST /api/schedule/check-conflict — 时段冲突检测
router.post('/check-conflict', (req, res) => {
  try {
    const { date, start_ts, end_ts, exclude_lesson_id } = req.body

    if (!date || !start_ts || !end_ts) {
      return res.json({ code: -1, message: '参数缺失' })
    }

    let sql = `SELECT * FROM lessons WHERE date = ? AND start_ts < ? AND end_ts > ? AND lesson_status != 'cancelled'`
    let params = [date, end_ts, start_ts]

    if (exclude_lesson_id) {
      sql += ` AND id != ?`
      params.push(exclude_lesson_id)
    }

    sql += ` LIMIT 10`
    const rows = db.all(sql, ...params).map(row => db.parseRow('lessons', row))

    const activeConflicts = rows.filter(lesson => {
      if (!lesson.students) return true
      return lesson.students.some(s => s.status === 'scheduled')
    })

    if (activeConflicts.length === 0) {
      return res.json({ code: 0, data: { available: true, conflict: null } })
    }

    const conflict = activeConflicts[0]
    res.json({
      code: 0,
      data: {
        available: false,
        conflict: {
          _id: conflict.id,
          course_name: conflict.course_name,
          start_time: conflict.start_time,
          end_time: conflict.end_time,
          students: conflict.students,
        },
      },
    })
  } catch (err) {
    console.error('[schedule/check-conflict] 错误:', err)
    res.json({ code: -1, message: err.message })
  }
})

module.exports = router
