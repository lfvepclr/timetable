// utils/schedule.js - 排课辅助逻辑（冲突检测、时间折叠）

const dateUtil = require('./date')

/**
 * 时间折叠算法：将课程列表按时间排序，间隔>30分钟的插入折叠条
 * @param {Array} lessons 课程列表（需含 start_ts, end_ts）
 * @returns {Array} segments [{ type: 'lesson'|'fold'|'gap', ... }]
 */
function buildFoldedSchedule(lessons) {
  if (!lessons || lessons.length === 0) return []

  // 按 start_ts 排序
  const sorted = [...lessons].sort((a, b) => a.start_ts - b.start_ts)

  const segments = []
  for (let i = 0; i < sorted.length; i++) {
    // 添加课程段
    segments.push({ type: 'lesson', lesson: sorted[i] })

    // 计算与下一节课的间隔
    if (i < sorted.length - 1) {
      const gapMs = sorted[i + 1].start_ts - sorted[i].end_ts
      const gapMinutes = Math.round(gapMs / 60000)

      if (gapMinutes > 30) {
        segments.push({
          type: 'fold',
          duration: gapMinutes,
          label: formatGapLabel(gapMinutes)
        })
      } else if (gapMinutes > 0) {
        segments.push({
          type: 'gap',
          duration: gapMinutes
        })
      }
    }
  }
  return segments
}

/**
 * 格式化间隔时间标签
 */
function formatGapLabel(minutes) {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours > 0 && mins > 0) {
    return `${hours}小时${mins}分钟空闲`
  } else if (hours > 0) {
    return `${hours}小时空闲`
  } else {
    return `${mins}分钟空闲`
  }
}

/**
 * 检测两个时间段是否重叠
 * @param {number} start1
 * @param {number} end1
 * @param {number} start2
 * @param {number} end2
 * @returns {boolean}
 */
function isTimeOverlap(start1, end1, start2, end2) {
  return start1 < end2 && end1 > start2
}

/**
 * 按日期分组课程
 * @param {Array} lessons
 * @returns {object} { 'YYYY-MM-DD': [lesson, ...] }
 */
function groupByDate(lessons) {
  const groups = {}
  lessons.forEach(lesson => {
    const date = lesson.date
    if (!groups[date]) {
      groups[date] = []
    }
    groups[date].push(lesson)
  })

  // 每组内按时间排序
  Object.keys(groups).forEach(date => {
    groups[date].sort((a, b) => a.start_ts - b.start_ts)
  })

  return groups
}

/**
 * 获取本周课程（按日分组+折叠）
 * @param {Array} lessons 一周内的课程
 * @returns {Array} [{ date, weekday, segments, hasLesson }]
 */
function buildWeekSchedule(lessons) {
  const { getWeekRange } = dateUtil
  const week = getWeekRange()
  const grouped = groupByDate(lessons)

  return week.dates.map((date, index) => {
    const dayLessons = grouped[date] || []
    return {
      date,
      weekday: index + 1,
      weekdayLabel: dateUtil.getWeekdayLabel(index + 1),
      isToday: dateUtil.isToday(date),
      hasLesson: dayLessons.length > 0,
      lessons: dayLessons,
      segments: buildFoldedSchedule(dayLessons)
    }
  })
}

/**
 * 计算课程包剩余进度百分比
 */
function calcProgress(consumed, total) {
  if (!total || total === 0) return 0
  return Math.round((consumed / total) * 100)
}

/**
 * 获取学生在一节课中的状态
 */
function getStudentStatusInLesson(lesson, studentId) {
  if (!lesson || !lesson.students) return null
  const s = lesson.students.find(item => item.student_id === studentId)
  return s ? s.status : null
}

module.exports = {
  buildFoldedSchedule,
  formatGapLabel,
  isTimeOverlap,
  groupByDate,
  buildWeekSchedule,
  calcProgress,
  getStudentStatusInLesson
}
