// seed.js — 测试数据初始化脚本
// 用法: node seed.js
const db = require('./lib/db')

console.log('开始生成测试数据...')

const now = Date.now()

// 清空现有数据（仅开发环境）
db.run('DELETE FROM feedbacks')
db.run('DELETE FROM lessons')
db.run('DELETE FROM weekly_patterns')
db.run('DELETE FROM packages')
db.run('DELETE FROM courses')
db.run('DELETE FROM students')
db.run('DELETE FROM users')
console.log('  已清空旧数据')

// 1. 创建用户（老师）
const teacherId = db.uuid()
db.run(
  `INSERT INTO users (id, openid, capabilities, name, phone, avatar, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  teacherId, 'local-dev-openid', JSON.stringify({ teacher: true, parent: false }),
  '测试老师', '13800000000', '', now, now
)
console.log('  ✓ 创建老师用户')

// 2. 创建课程
const courseId = db.uuid()
db.run(
  `INSERT INTO courses (id, name, type, max_students, default_duration, color, active, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  courseId, '数学', '1v1', 1, 90, '#4A90D9', 1, now, now
)
console.log('  ✓ 创建课程: 数学(1v1)')

const courseId2 = db.uuid()
db.run(
  `INSERT INTO courses (id, name, type, max_students, default_duration, color, active, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  courseId2, '英语', '1v2', 2, 120, '#52C4A0', 1, now, now
)
console.log('  ✓ 创建课程: 英语(1v2)')

// 3. 创建学生
const studentId1 = db.uuid()
db.run(
  `INSERT INTO students (id, name, grade, school, notes, tags, active, parents, bind_codes, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  studentId1, '张小明', '三年级', '阳光小学', '数学基础较好', JSON.stringify(['重点']), 1,
  JSON.stringify([]), JSON.stringify([]), now, now
)
console.log('  ✓ 创建学生: 张小明')

const studentId2 = db.uuid()
db.run(
  `INSERT INTO students (id, name, grade, school, notes, tags, active, parents, bind_codes, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  studentId2, '李小红', '四年级', '阳光小学', '英语口语需加强', JSON.stringify([]), 1,
  JSON.stringify([]), JSON.stringify([]), now, now
)
console.log('  ✓ 创建学生: 李小红')

// 4. 创建课包
const packageId1 = db.uuid()
db.run(
  `INSERT INTO packages (id, student_id, course_id, total_lessons, consumed_lessons, remaining, status, purchase_date, consume_records, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  packageId1, studentId1, courseId, 20, 3, 17, 'active', now - 30 * 86400000,
  JSON.stringify([]), now, now
)
console.log('  ✓ 创建课包: 张小明-数学(20节, 已用3)')

const packageId2 = db.uuid()
db.run(
  `INSERT INTO packages (id, student_id, course_id, total_lessons, consumed_lessons, remaining, status, purchase_date, consume_records, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  packageId2, studentId2, courseId2, 10, 0, 10, 'active', now - 7 * 86400000,
  JSON.stringify([]), now, now
)
console.log('  ✓ 创建课包: 李小红-英语(10节, 已用0)')

// 5. 创建周模式
const patternId1 = db.uuid()
db.run(
  `INSERT INTO weekly_patterns (id, course_id, course_name, course_type, color, day_of_week, start_time, end_time, student_ids, student_names, valid_from, valid_until, status, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  patternId1, courseId, '数学', '1v1', '#4A90D9', 6, '09:00', '10:30',
  JSON.stringify([studentId1]), JSON.stringify(['张小明']),
  '2025-06-01', '2025-12-31', 'active', now, now
)
console.log('  ✓ 创建周模式: 数学-周六9:00')

const patternId2 = db.uuid()
db.run(
  `INSERT INTO weekly_patterns (id, course_id, course_name, course_type, color, day_of_week, start_time, end_time, student_ids, student_names, valid_from, valid_until, status, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  patternId2, courseId2, '英语', '1v2', '#52C4A0', 7, '14:00', '16:00',
  JSON.stringify([studentId1, studentId2]), JSON.stringify(['张小明', '李小红']),
  '2025-06-01', '2025-12-31', 'active', now, now
)
console.log('  ✓ 创建周模式: 英语-周日14:00')

// 6. 创建几节课（使用当前日期，方便本地演示）
const today = new Date()
const pad = n => n < 10 ? '0' + n : '' + n
const formatDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

const lessonDate = formatDate(today)
const lessonId1 = db.uuid()
db.run(
  `INSERT INTO lessons (id, date, start_ts, end_ts, course_id, course_name, course_type, color, start_time, end_time, students, lesson_status, feedback_id, pattern_id, source, note, created_at, updated_at)
   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  lessonId1, lessonDate,
  new Date(`${lessonDate} 09:00:00`).getTime(), new Date(`${lessonDate} 10:30:00`).getTime(),
  courseId, '数学', '1v1', '#4A90D9', '09:00', '10:30',
  JSON.stringify([{ student_id: studentId1, student_name: '张小明', status: 'scheduled', consume_record: null }]),
  'scheduled', null, patternId1, 'pattern', '', now, now
)
console.log('  ✓ 创建课程: 6/21 数学(待上课)')

const lessonDate2 = formatDate(new Date(today.getTime() - 7 * 86400000)) // 上周同一天
const lessonId2 = db.uuid()
db.run(
  `INSERT INTO lessons (id, date, start_ts, end_ts, course_id, course_name, course_type, color, start_time, end_time, students, lesson_status, feedback_id, pattern_id, source, note, created_at, updated_at)
   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  lessonId2, lessonDate2,
  new Date(`${lessonDate2} 09:00:00`).getTime(), new Date(`${lessonDate2} 10:30:00`).getTime(),
  courseId, '数学', '1v1', '#4A90D9', '09:00', '10:30',
  JSON.stringify([{ student_id: studentId1, student_name: '张小明', status: 'attended', consume_record: { package_id: packageId1, consumed_at: now - 7 * 86400000 } }]),
  'completed', null, patternId1, 'pattern', '', now, now
)
console.log('  ✓ 创建课程: 6/14 数学(已完成)')

console.log('\n测试数据生成完成！')
console.log(`  老师用户 openid: local-dev-openid`)
console.log(`  课程: 数学(1v1) + 英语(1v2)`)
console.log(`  学生: 张小明 + 李小红`)
console.log(`  课包: 数学20节(剩17) + 英语10节(剩10)`)
console.log(`  周模式: 周六数学 + 周日英语`)
console.log(`  课程: ${lessonDate}待上课 + ${lessonDate2}已完成`)
