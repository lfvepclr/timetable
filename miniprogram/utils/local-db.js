// utils/local-db.js — 本地分层存储数据库
// 小数据用 wx.setStorageSync（多 key），反馈数据用文件系统

const { getHoliday } = require('./holidays')

// ============ 常量 ============

const TABLES = ['users', 'students', 'courses', 'packages', 'weekly_patterns', 'lessons', 'feedbacks']

const JSON_COLUMNS = {
  users: ['capabilities'],
  students: ['tags', 'parents', 'bind_codes'],
  packages: ['consume_records'],
  weekly_patterns: ['student_ids', 'student_names'],
  lessons: ['students'],
  feedbacks: ['photos'],
}

// 存储映射：table → { type, key, field? }
const STORAGE_MAP = {
  users:           { type: 'storage', key: 'tt_user' },
  students:        { type: 'storage', key: 'tt_students' },
  courses:         { type: 'storage', key: 'tt_config', field: 'courses' },
  packages:        { type: 'storage', key: 'tt_packages' },
  weekly_patterns: { type: 'storage', key: 'tt_patterns' },
  lessons:         { type: 'storage', key: 'tt_lessons' },
  feedbacks:       { type: 'file', path: `${wx.env.USER_DATA_PATH}/feedbacks.json` },
}

// ============ 内存数据 ============

let db = null
let saveTimer = null
const dirtyTables = new Set()

// ============ 初始化与持久化 ============

function init() {
  if (db) return db
  db = {}
  return db
}

// 懒加载单个表（首次访问时才从存储/文件读取）
function ensureTable(table) {
  if (db[table]) return
  const cfg = STORAGE_MAP[table]
  if (!cfg) { db[table] = []; return }
  try {
    if (cfg.type === 'storage') {
      const raw = wx.getStorageSync(cfg.key)
      if (cfg.field) {
        db[table] = (raw && raw[cfg.field]) || []
      } else {
        db[table] = raw || []
      }
    } else if (cfg.type === 'file') {
      const fs = wx.getFileSystemManager()
      const content = fs.readFileSync(cfg.path, 'utf-8')
      db[table] = JSON.parse(content)
    }
  } catch (e) {
    db[table] = []
  }
  if (!Array.isArray(db[table])) db[table] = []
}

// 保存单个表到对应存储目标
function saveTable(table) {
  const cfg = STORAGE_MAP[table]
  if (!cfg) return
  try {
    if (cfg.type === 'storage') {
      if (cfg.field) {
        const config = wx.getStorageSync(cfg.key) || {}
        config[cfg.field] = db[table]
        wx.setStorageSync(cfg.key, config)
      } else {
        wx.setStorageSync(cfg.key, db[table])
      }
    } else if (cfg.type === 'file') {
      const fs = wx.getFileSystemManager()
      fs.writeFileSync(cfg.path, JSON.stringify(db[table]), 'utf-8')
    }
  } catch (e) {
    console.error(`[local-db] 保存 ${table} 失败:`, e)
  }
}

// 标记表为脏，触发防抖保存
function markDirty(table) {
  dirtyTables.add(table)
  save()
}

function save() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    dirtyTables.forEach(t => saveTable(t))
    dirtyTables.clear()
    saveTimer = null
  }, 500)
}

function flush() {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  dirtyTables.forEach(t => saveTable(t))
  dirtyTables.clear()
}

// ============ 工具函数 ============

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

function pad(n) { return n < 10 ? '0' + n : '' + n }
function formatDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function getTimestamp(dateStr, timeStr) {
  return new Date(`${dateStr} ${timeStr}:00`).getTime()
}
function getDayOfWeek(dateStr) {
  const day = new Date(dateStr).getDay()
  return day === 0 ? 7 : day
}

// ============ 查询引擎 ============

function matchValue(recordVal, condition) {
  if (condition === null || condition === undefined) {
    return recordVal === null || recordVal === undefined
  }
  if (typeof condition === 'object' && !Array.isArray(condition)) {
    if (condition.$gte !== undefined && !(recordVal >= condition.$gte)) return false
    if (condition.$lte !== undefined && !(recordVal <= condition.$lte)) return false
    if (condition.$gt !== undefined && !(recordVal > condition.$gt)) return false
    if (condition.$lt !== undefined && !(recordVal < condition.$lt)) return false
    if (condition.$ne !== undefined && recordVal === condition.$ne) return false
    if (condition.$in !== undefined && !condition.$in.includes(recordVal)) return false
    if (condition.$regex !== undefined) {
      if (!recordVal) return false
      const regex = new RegExp(condition.$regex, condition.$options || '')
      if (!regex.test(String(recordVal))) return false
    }
    return true
  }
  return recordVal === condition
}

function matchWhere(record, where) {
  if (!where || Object.keys(where).length === 0) return true

  for (const [field, value] of Object.entries(where)) {
    if (field === '$and') {
      if (!value.every(v => matchWhere(record, v))) return false
      continue
    }
    if (field === '$or') {
      if (!value.some(v => matchWhere(record, v))) return false
      continue
    }

    // 点号路径：JSON 列内查询（如 parents.openid）
    if (field.includes('.')) {
      const [col, ...pathParts] = field.split('.')
      const arr = record[col]
      if (!Array.isArray(arr)) return false
      const found = arr.some(item => {
        let val = item
        for (const p of pathParts) val = val && val[p]
        return matchValue(val, value)
      })
      if (!found) return false
      continue
    }

    const col = field === '_id' ? 'id' : field
    if (!matchValue(record[col], value)) return false
  }
  return true
}

// ============ 行规范化 ============

function normalizeRow(table, row) {
  if (!row) return null
  const result = { ...row }
  if (result.id && !result._id) result._id = result.id
  const cols = JSON_COLUMNS[table] || []
  for (const col of cols) {
    if (typeof result[col] === 'string') {
      try { result[col] = JSON.parse(result[col]) } catch { /* keep */ }
    }
  }
  if ((table === 'students' || table === 'courses') && 'active' in result) {
    result.active = !!result.active
  }
  return result
}

// ============ CRUD 接口 ============

function query(table, where = {}, options = {}) {
  init(); ensureTable(table)
  const { page = 1, pageSize = 20, orderBy } = options
  let rows = (db[table] || []).filter(r => matchWhere(r, where))

  if (orderBy && Array.isArray(orderBy)) {
    const [col, dir] = orderBy
    const key = col === '_id' ? 'id' : col
    rows.sort((a, b) => {
      const av = a[key], bv = b[key]
      if (av === bv) return 0
      const cmp = av > bv ? 1 : -1
      return dir === 'desc' ? -cmp : cmp
    })
  }

  const offset = (page - 1) * pageSize
  rows = rows.slice(offset, offset + pageSize)
  return rows.map(r => normalizeRow(table, r))
}

function getById(table, id) {
  init(); ensureTable(table)
  const row = (db[table] || []).find(r => r.id === id || r._id === id)
  return row ? normalizeRow(table, row) : null
}

function add(table, data) {
  init(); ensureTable(table)
  const now = Date.now()
  const id = data._id || data.id || uuid()
  const record = { ...data, id, _id: id, created_at: now, updated_at: now }
  db[table] = db[table] || []
  db[table].push(record)
  markDirty(table)
  return { _id: id, id }
}

function update(table, id, data) {
  init(); ensureTable(table)
  const arr = db[table] || []
  const idx = arr.findIndex(r => r.id === id || r._id === id)
  if (idx === -1) return { updated: 0 }
  arr[idx] = { ...arr[idx], ...data, updated_at: Date.now() }
  markDirty(table)
  return { updated: 1 }
}

function remove(table, id) {
  init(); ensureTable(table)
  const before = (db[table] || []).length
  db[table] = (db[table] || []).filter(r => r.id !== id && r._id !== id)
  const after = db[table].length
  markDirty(table)
  return { removed: before - after }
}

function count(table, where = {}) {
  init(); ensureTable(table)
  return (db[table] || []).filter(r => matchWhere(r, where)).length
}

// ============ 导出/导入 ============

function getRawData() {
  init()
  TABLES.forEach(t => ensureTable(t))
  return JSON.parse(JSON.stringify(db))
}

function replaceData(newData) {
  db = {}
  TABLES.forEach(t => { db[t] = newData[t] || [] })
  // 写入所有存储目标
  TABLES.forEach(t => dirtyTables.add(t))
  flush()
}

// ============ callFn 业务逻辑 ============

function callFn(name, data = {}) {
  init()
  switch (name) {
    case 'generateSchedule': return generateSchedule(data)
    case 'checkSlotConflict': return checkSlotConflict(data)
    case 'completeLesson': return completeLesson(data)
    case 'requestLeave': return requestLeave(data)
    case 'rescheduleLesson': return rescheduleLesson(data)
    case 'saveFeedback': return saveFeedback(data)
    case 'generateBindCode': return generateBindCode(data)
    case 'bindStudent': return bindStudent(data)
    case 'sendNotification': return { sent: 0, message: '本地模式不支持通知推送' }
    default: throw new Error(`未知函数: ${name}`)
  }
}

// --- 排课生成 ---
function generateSchedule(data) {
  const { pattern_ids, end_date, preview_only = false } = data
  ensureTable('weekly_patterns'); ensureTable('lessons')
  if (!pattern_ids || !pattern_ids.length || !end_date) {
    throw new Error('参数缺失：需要 pattern_ids 和 end_date')
  }

  const patterns = db.weekly_patterns.filter(
    p => pattern_ids.includes(p.id) && p.status === 'active'
  ).map(p => normalizeRow('weekly_patterns', p))

  if (patterns.length === 0) throw new Error('未找到有效的排课模板')

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = formatDate(today)

  const generated = [], skipped = [], conflicts = []

  for (const pattern of patterns) {
    const cycleType = pattern.cycle_type || 'weekly'
    const startDate = new Date(Math.max(
      new Date(pattern.valid_from || todayStr).getTime(),
      today.getTime()
    ))
    const endDate = new Date(pattern.valid_until || end_date)
    endDate.setHours(23, 59, 59, 999)
    const finalEndDate = new Date(end_date)
    finalEndDate.setHours(23, 59, 59, 999)
    const actualEndDate = finalEndDate < endDate ? finalEndDate : endDate
    const current = new Date(startDate)
    current.setHours(0, 0, 0, 0)

    while (current <= actualEndDate) {
      const dateStr = formatDate(current)
      const dow = getDayOfWeek(dateStr)

      const shouldGenerate = cycleType === 'daily' ? true : (dow === pattern.day_of_week)
      if (shouldGenerate) {
        const holiday = getHoliday(dateStr)
        if (holiday && holiday.is_off_day === false) {
          skipped.push({ date: dateStr, reason: '调休工作日', pattern: pattern.course_name })
          current.setDate(current.getDate() + 1)
          continue
        }

        const startTs = getTimestamp(dateStr, pattern.start_time)
        const endTs = getTimestamp(dateStr, pattern.end_time)

        // 冲突检测
        const conflictLessons = db.lessons.filter(l =>
          l.date === dateStr && l.lesson_status !== 'cancelled' &&
          l.start_ts < endTs && l.end_ts > startTs
        ).map(l => normalizeRow('lessons', l))

        const activeConflicts = conflictLessons.filter(l =>
          !l.students || l.students.some(s => s.status === 'scheduled')
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

  const now = Date.now()
  const insertedIds = []
  for (const lesson of generated) {
    const id = uuid()
    db.lessons.push({ ...lesson, id, _id: id, created_at: now, updated_at: now })
    insertedIds.push(id)
  }
  markDirty('lessons')

  return {
    inserted: insertedIds.length, skipped: skipped.length, conflicts: conflicts.length,
    skipped_detail: skipped, conflicts_detail: conflicts,
    summary: { total: generated.length, inserted: insertedIds.length, skipped: skipped.length, conflicts: conflicts.length },
  }
}

// --- 冲突检测 ---
function checkSlotConflict(data) {
  const { date, start_ts, end_ts, exclude_lesson_id } = data
  ensureTable('lessons')
  if (!date || !start_ts || !end_ts) throw new Error('参数缺失')

  let rows = db.lessons.filter(l =>
    l.date === date && l.lesson_status !== 'cancelled' &&
    l.start_ts < end_ts && l.end_ts > start_ts
  )
  if (exclude_lesson_id) {
    rows = rows.filter(l => l.id !== exclude_lesson_id)
  }
  rows = rows.map(l => normalizeRow('lessons', l))

  const activeConflicts = rows.filter(l =>
    !l.students || l.students.some(s => s.status === 'scheduled')
  )

  if (activeConflicts.length === 0) return { available: true, conflict: null }
  const c = activeConflicts[0]
  return {
    available: false,
    conflict: { _id: c.id, course_name: c.course_name, start_time: c.start_time, end_time: c.end_time, students: c.students },
  }
}

// --- 完成课程 + FIFO 消耗课时 ---
function completeLesson(data) {
  const { lesson_id, attended_student_ids = [] } = data

  ensureTable('lessons'); ensureTable('packages')

  const lessonRow = db.lessons.find(l => l.id === lesson_id)
  if (!lessonRow) throw new Error('课程不存在')
  const lesson = normalizeRow('lessons', lessonRow)
  if (lesson.lesson_status === 'completed') throw new Error('该课程已完成')
  if (lesson.lesson_status === 'pending_feedback') throw new Error('该课程已消课')
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

      // FIFO：查最旧活跃课包
      const pkgRow = db.packages
        .filter(p => p.student_id === student.student_id && p.course_id === lesson.course_id && p.status === 'active')
        .sort((a, b) => (a.purchase_date || 0) - (b.purchase_date || 0))[0]
      if (!pkgRow) throw new Error(`学生 ${student.student_name} 没有可用的课程包`)
      const pkg = normalizeRow('packages', pkgRow)

      const newConsumed = pkg.consumed_lessons + 1
      const newRemaining = pkg.total_lessons - newConsumed
      const newStatus = newRemaining === 0 ? 'exhausted' : 'active'
      const consumeRecords = [...(pkg.consume_records || []), { lesson_id, consumed_at: Date.now() }]

      update('packages', pkg.id, {
        consumed_lessons: newConsumed, remaining: newRemaining,
        status: newStatus, consume_records: consumeRecords,
      })

      students[i] = { ...student, status: 'attended', consume_record: { package_id: pkg.id, consumed_at: Date.now() } }
      consumptions.push({
        student_id: student.student_id, student_name: student.student_name,
        package_id: pkg.id, remaining: newRemaining,
      })
    } else if (student.status === 'scheduled') {
      students[i] = { ...student, status: 'attended', consume_record: null }
    }
  }

  update('lessons', lesson_id, { lesson_status: 'pending_feedback', students })
  return { consumptions }
}

// --- 学生请假 ---
function requestLeave(data) {
  const { lesson_id, student_id, reason } = data
  ensureTable('lessons')
  if (!lesson_id || !student_id) throw new Error('缺少必要参数')

  const lessonRow = db.lessons.find(l => l.id === lesson_id)
  if (!lessonRow) throw new Error('课程不存在')
  const lesson = normalizeRow('lessons', lessonRow)

  const students = lesson.students.map(s => {
    if (s.student_id === student_id) {
      return { ...s, status: 'on_leave', leave_reason: reason || '', leave_time: Date.now() }
    }
    return s
  })

  const updateData = { students }
  if (lesson.course_type === '1v1' && students.length === 1) {
    updateData.lesson_status = 'cancelled'
    updateData.note = '学生请假'
  }
  update('lessons', lesson_id, updateData)
  return { lesson_id, student_id, status: 'on_leave' }
}

// --- 补课重排 ---
function rescheduleLesson(data) {
  const { original_lesson_id, student_id, new_date, new_start_time, new_end_time, target_lesson_id } = data
  ensureTable('lessons'); ensureTable('students')
  if (!student_id || (!new_date && !target_lesson_id)) throw new Error('缺少必要参数')

  const now = Date.now()

  // 场景1：加入已有课程
  if (target_lesson_id) {
    const targetRow = db.lessons.find(l => l.id === target_lesson_id)
    if (!targetRow) throw new Error('目标课程不存在')
    const target = normalizeRow('lessons', targetRow)
    const activeStudents = target.students.filter(s => s.status === 'scheduled')
    const maxStudents = target.course_type === '1v1' ? 1 : target.course_type === '1v2' ? 2 : target.course_type === '1v3' ? 3 : 20
    if (activeStudents.length >= maxStudents) throw new Error('该课程已满员')

    const students = [...target.students, { student_id, status: 'scheduled', source: 'makeup', original_lesson_id: original_lesson_id || '' }]
    update('lessons', target_lesson_id, { students })
    return { lesson_id: target_lesson_id, action: 'joined' }
  }

  // 场景2：创建新补课课程
  const startTs = getTimestamp(new_date, new_start_time)
  const endTs = getTimestamp(new_date, new_end_time)

  const conflicts = db.lessons
    .filter(l => l.date === new_date && l.lesson_status !== 'cancelled' && l.start_ts < endTs && l.end_ts > startTs)
    .map(l => normalizeRow('lessons', l))
  if (conflicts.some(l => l.students && l.students.some(s => s.student_id === student_id && s.status !== 'on_leave'))) {
    throw new Error('该时段有冲突')
  }

  let courseInfo = {}
  if (original_lesson_id) {
    const origRow = db.lessons.find(l => l.id === original_lesson_id)
    if (origRow) {
      const orig = normalizeRow('lessons', origRow)
      courseInfo = { course_id: orig.course_id, course_name: orig.course_name, course_type: orig.course_type, color: orig.color }
    }
  }

  const studentRow = db.students.find(s => s.id === student_id)
  const studentName = studentRow ? studentRow.name : ''

  const newId = uuid()
  db.lessons.push({
    id: newId, _id: newId, date: new_date, start_ts: startTs, end_ts: endTs,
    course_id: courseInfo.course_id || null, course_name: courseInfo.course_name || null,
    course_type: courseInfo.course_type || null, color: courseInfo.color || '#4A90D9',
    start_time: new_start_time, end_time: new_end_time,
    students: [{ student_id, student_name: studentName, status: 'scheduled', source: 'makeup', original_lesson_id: original_lesson_id || '' }],
    lesson_status: 'scheduled', source: 'makeup', pattern_id: '', feedback_id: '', note: '',
    created_at: now, updated_at: now,
  })
  markDirty('lessons')
  return { lesson_id: newId, action: 'created' }
}

// --- 保存反馈 ---
function saveFeedback(data) {
  const { lesson_id, student_id, content, performance, homework, teacher_comment, photos } = data
  ensureTable('lessons'); ensureTable('feedbacks')
  if (!lesson_id || !student_id) throw new Error('缺少必要参数')

  const lessonRow = db.lessons.find(l => l.id === lesson_id)
  if (!lessonRow) throw new Error('课程不存在')
  const lesson = normalizeRow('lessons', lessonRow)
  const now = Date.now()

  const existing = db.feedbacks.find(f => f.lesson_id === lesson_id && f.student_id === student_id)

  let feedbackId
  if (existing) {
    feedbackId = existing.id
    update('feedbacks', feedbackId, {
      content: content || '', performance: performance || '',
      homework: homework || '', teacher_comment: teacher_comment || '',
      photos: photos || [],
    })
  } else {
    feedbackId = uuid()
    db.feedbacks.push({
      id: feedbackId, _id: feedbackId, lesson_id, student_id,
      course_id: lesson.course_id || null, course_name: lesson.course_name || null,
      lesson_date: lesson.date, content: content || '', performance: performance || '',
      homework: homework || '', teacher_comment: teacher_comment || '',
      photos: photos || [], card_image_url: '', teacher_openid: 'local',
      created_at: now, updated_at: now,
    })
    markDirty('feedbacks')
    update('lessons', lesson_id, { feedback_id: feedbackId })
  }
  return { feedback_id: feedbackId }
}

// --- 生成绑定码 ---
function generateBindCode(data) {
  const { student_id } = data
  ensureTable('students')
  if (!student_id) throw new Error('缺少学生ID')

  const studentRow = db.students.find(s => s.id === student_id)
  if (!studentRow) throw new Error('学生不存在')
  const student = normalizeRow('students', studentRow)

  const now = Date.now()
  const existingCodes = (student.bind_codes || []).filter(c => c.status === 'pending' && c.expire_at > now)
  if (existingCodes.length > 0) {
    const existing = existingCodes[0]
    return { bind_code: existing.code, bind_code_id: existing.id || '', student_name: student.name, qr_url: '' }
  }

  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]

  const expireAt = now + 24 * 60 * 60 * 1000
  const codeId = uuid()
  const bindCodes = [...(student.bind_codes || []), { id: codeId, code, status: 'pending', expire_at: expireAt, qr_url: '', created_by: 'local', created_at: now }]
  update('students', student_id, { bind_codes })

  return { bind_code: code, bind_code_id: codeId, student_name: student.name, qr_url: '' }
}

// --- 家长绑定 ---
function bindStudent(data) {
  const { code, relationship } = data
  ensureTable('students')
  if (!code) throw new Error('缺少绑定码')

  const now = Date.now()

  let targetStudent = null, targetBindCode = null
  for (const student of db.students) {
    const s = normalizeRow('students', student)
    const found = (s.bind_codes || []).find(c => c.code === code && c.status === 'pending')
    if (found) { targetStudent = s; targetBindCode = found; break }
  }

  if (!targetStudent) throw new Error('绑定码无效或已被使用')
  if (targetBindCode.expire_at < now) {
    const codes = targetStudent.bind_codes.map(c => c.code === code ? { ...c, status: 'expired' } : c)
    update('students', targetStudent.id, { bind_codes: codes })
    throw new Error('绑定码已过期，请联系老师重新生成')
  }

  const parents = targetStudent.parents || []
  if (parents.some(p => p.status === 'active')) throw new Error('您已绑定该学生')
  if (parents.filter(p => p.status === 'active').length >= 2) throw new Error('该学生绑定家长已达上限')

  parents.push({ openid: 'local_parent', relationship: relationship || '家长', status: 'active', bound_at: now })
  const updatedCodes = targetStudent.bind_codes.map(c => c.code === code ? { ...c, status: 'used', used_by: 'local_parent', used_at: now } : c)
  update('students', targetStudent.id, { parents, bind_codes: updatedCodes })

  return { student_id: targetStudent.id, student_name: targetStudent.name, student: targetStudent }
}

module.exports = {
  init, save, flush,
  query, getById, add, update, remove, count,
  callFn, uuid,
  getRawData, replaceData,
}
