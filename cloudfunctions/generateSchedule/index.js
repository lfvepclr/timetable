// cloudfunctions/generateSchedule/index.js - 周模式批量生成排课
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// 获取星期几（1-7，周一为1）
function getDayOfWeek(dateStr) {
  const d = new Date(dateStr)
  const day = d.getDay()
  return day === 0 ? 7 : day
}

// 格式化日期 YYYY-MM-DD
function formatDate(d) {
  const pad = n => (n < 10 ? '0' + n : '' + n)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// 生成时间戳
function getTimestamp(dateStr, timeStr) {
  return new Date(`${dateStr} ${timeStr}:00`).getTime()
}

exports.main = async (event, context) => {
  const { pattern_ids, end_date, preview_only = false } = event

  if (!pattern_ids || !pattern_ids.length || !end_date) {
    return { code: -1, message: '参数缺失：需要 pattern_ids 和 end_date' }
  }

  // 1. 查询周模式模板
  const patternRes = await db.collection('weekly_patterns')
    .where({ _id: _.in(pattern_ids), status: 'active' })
    .get()

  if (patternRes.data.length === 0) {
    return { code: -1, message: '未找到有效的排课模板' }
  }

  const patterns = patternRes.data

  // 2. 查询节假日数据（覆盖整个日期范围）
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = formatDate(today)

  // 收集需要查询的年份
  const years = new Set()
  years.add(today.getFullYear())
  years.add(new Date(end_date).getFullYear())

  const holidayRes = await db.collection('holidays')
    .where({ year: _.in([...years]) })
    .limit(100)
    .get()

  const holidayMap = {}
  holidayRes.data.forEach(h => {
    holidayMap[h.date] = h
  })

  // 3. 遍历每个模板生成排课
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

      // 检查是否匹配模板的周几
      if (dow === pattern.day_of_week) {
        // 检查节假日
        const holiday = holidayMap[dateStr]

        if (holiday && holiday.is_off_day === false) {
          // 调休工作日 → 跳过（学生要上学）
          skipped.push({ date: dateStr, reason: '调休工作日', pattern: pattern.name })
          current.setDate(current.getDate() + 1)
          continue
        }
        // is_off_day=true（法定假日）→ 正常排课（学生放假有空）
        // 无记录 → 正常排课

        // 计算时间戳
        const startTs = getTimestamp(dateStr, pattern.start_time)
        const endTs = getTimestamp(dateStr, pattern.end_time)

        // 检查时段冲突
        const conflictRes = await db.collection('lessons')
          .where({
            date: dateStr,
            start_ts: _.lt(endTs),
            end_ts: _.gt(startTs),
            lesson_status: _.neq('cancelled')
          })
          .limit(5)
          .get()

        // 过滤掉所有学生都请假的课程
        const activeConflicts = conflictRes.data.filter(lesson => {
          if (!lesson.students) return true
          return lesson.students.some(s => s.status === 'scheduled')
        })

        if (activeConflicts.length > 0) {
          conflicts.push({
            date: dateStr,
            pattern: pattern.name,
            conflict_lesson: activeConflicts[0].course_name,
            start_time: activeConflicts[0].start_time
          })
          current.setDate(current.getDate() + 1)
          continue
        }

        // 构建课程实例
        const students = (pattern.student_ids || []).map((sid, idx) => ({
          student_id: sid,
          student_name: (pattern.student_names && pattern.student_names[idx]) || '',
          status: 'scheduled',
          consume_record: null,
          leave_reason: null,
          leave_at: null
        }))

        generated.push({
          pattern_id: pattern._id,
          source: 'pattern',
          course_id: pattern.course_id,
          course_name: pattern.course_name,
          course_type: pattern.course_type,
          color: pattern.color || '#4A90D9',
          date: dateStr,
          day_of_week: dow,
          start_time: pattern.start_time,
          end_time: pattern.end_time,
          start_ts: startTs,
          end_ts: endTs,
          students: students,
          lesson_status: 'scheduled',
          feedback_id: null,
          note: '',
          reschedule_from: null,
          created_at: Date.now(),
          updated_at: Date.now()
        })
      }

      current.setDate(current.getDate() + 1)
    }
  }

  // 4. 预览模式：不写入
  if (preview_only) {
    return {
      code: 0,
      data: {
        generated: generated.map(g => ({
          date: g.date,
          start_time: g.start_time,
          end_time: g.end_time,
          course_name: g.course_name,
          students: g.students.map(s => s.student_name)
        })),
        skipped,
        conflicts,
        summary: {
          total: generated.length,
          skipped: skipped.length,
          conflicts: conflicts.length
        }
      }
    }
  }

  // 5. 批量写入（分批，每批20条）
  const insertedIds = []
  for (let i = 0; i < generated.length; i += 20) {
    const batch = generated.slice(i, i + 20)
    const tasks = batch.map(lesson => db.collection('lessons').add({ data: lesson }))
    const results = await Promise.all(tasks)
    insertedIds.push(...results.map(r => r._id))
  }

  return {
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
        conflicts: conflicts.length
      }
    }
  }
}
