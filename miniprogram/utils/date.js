// utils/date.js - 日期处理工具

/**
 * 补零
 */
function pad(n) {
  return n < 10 ? '0' + n : '' + n
}

/**
 * 格式化日期为 YYYY-MM-DD
 * @param {Date|string|number} date
 * @returns {string}
 */
function formatDate(date) {
  const d = new Date(date)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * 格式化时间为 HH:mm
 */
function formatTime(date) {
  const d = new Date(date)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * 格式化日期时间 YYYY-MM-DD HH:mm
 */
function formatDateTime(date) {
  return `${formatDate(date)} ${formatTime(date)}`
}

/**
 * 获取星期几（1-7，周一为1）
 */
function getDayOfWeek(date) {
  const d = new Date(date)
  const day = d.getDay()
  return day === 0 ? 7 : day
}

/**
 * 获取周几中文
 */
function getWeekdayLabel(dayOfWeek) {
  const map = { 1: '周一', 2: '周二', 3: '周三', 4: '周四', 5: '周五', 6: '周六', 7: '周日' }
  return map[dayOfWeek] || ''
}

/**
 * 根据日期字符串和时间字符串生成时间戳
 * @param {string} dateStr YYYY-MM-DD
 * @param {string} timeStr HH:mm
 * @returns {number} 毫秒时间戳
 */
function getTimestamp(dateStr, timeStr) {
  return new Date(`${dateStr} ${timeStr}:00`).getTime()
}

/**
 * 计算两个时间戳之间相差的分钟数
 */
function diffMinutes(startTs, endTs) {
  return Math.round((endTs - startTs) / 60000)
}

/**
 * 格式化时长（分钟转中文）
 * @param {number} minutes
 * @returns {string} 如 "2小时" 或 "1.5小时"
 */
function formatDuration(minutes) {
  const hours = minutes / 60
  if (Number.isInteger(hours)) {
    return `${hours}小时`
  }
  return `${hours.toFixed(1)}小时`
}

/**
 * 获取本周日期范围（周一到周日）
 * @param {Date} date 参考日期
 * @returns {{start: string, end: string, dates: string[]}}
 */
function getWeekRange(date = new Date()) {
  const d = new Date(date)
  const day = getDayOfWeek(d)
  const monday = new Date(d)
  monday.setDate(d.getDate() - day + 1)
  monday.setHours(0, 0, 0, 0)

  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)

  const dates = []
  for (let i = 0; i < 7; i++) {
    const dt = new Date(monday)
    dt.setDate(monday.getDate() + i)
    dates.push(formatDate(dt))
  }

  return {
    start: formatDate(monday),
    end: formatDate(sunday),
    dates
  }
}

/**
 * 获取指定日期前后N天的日期
 */
function addDays(date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

/**
 * 生成日期范围内的所有日期
 * @param {string} startDate YYYY-MM-DD
 * @param {string} endDate YYYY-MM-DD
 * @returns {string[]}
 */
function getDatesBetween(startDate, endDate) {
  const dates = []
  const start = new Date(startDate)
  const end = new Date(endDate)
  const current = new Date(start)

  while (current <= end) {
    dates.push(formatDate(current))
    current.setDate(current.getDate() + 1)
  }
  return dates
}

/**
 * 友好的日期显示
 */
function friendlyDate(dateStr) {
  const d = new Date(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr)
  target.setHours(0, 0, 0, 0)
  const diff = (target - today) / 86400000

  if (diff === 0) return '今天'
  if (diff === 1) return '明天'
  if (diff === -1) return '昨天'
  if (diff > 1 && diff <= 7) return `${diff}天后`
  if (diff < -1 && diff >= -7) return `${-diff}天前`

  const month = d.getMonth() + 1
  const day = d.getDate()
  return `${month}月${day}日`
}

/**
 * 判断是否是今天
 */
function isToday(dateStr) {
  return formatDate(new Date()) === formatDate(dateStr)
}

/**
 * 判断是否已过去
 */
function isPast(dateStr, timeStr) {
  const ts = timeStr ? getTimestamp(dateStr, timeStr) : getTimestamp(dateStr, '00:00')
  return ts < Date.now()
}

module.exports = {
  pad,
  formatDate,
  formatTime,
  formatDateTime,
  getDayOfWeek,
  getWeekdayLabel,
  getTimestamp,
  diffMinutes,
  formatDuration,
  getWeekRange,
  addDays,
  getDatesBetween,
  friendlyDate,
  isToday,
  isPast
}
