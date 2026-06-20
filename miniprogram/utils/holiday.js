// utils/holiday.js - 节假日判断逻辑

const { db, _ } = require('./db')

// 缓存节假日数据
let holidayCache = null
let cacheYear = null

/**
 * 加载指定年份的节假日数据
 * @param {number} year
 * @returns {Promise<object>} { 'YYYY-MM-DD': { is_off_day, name } }
 */
async function loadHolidays(year) {
  if (holidayCache && cacheYear === year) {
    return holidayCache
  }

  const res = await db.collection('holidays')
    .where({ year })
    .limit(100)
    .get()

  const map = {}
  res.data.forEach(item => {
    map[item.date] = {
      is_off_day: item.is_off_day,
      name: item.name
    }
  })

  holidayCache = map
  cacheYear = year
  return map
}

/**
 * 加载多个月份跨年的节假日
 */
async function loadHolidaysForRange(startDate, endDate) {
  const years = new Set()
  const start = new Date(startDate)
  const end = new Date(endDate)
  years.add(start.getFullYear())
  years.add(end.getFullYear())

  const allHolidays = {}
  for (const year of years) {
    const map = await loadHolidays(year)
    Object.assign(allHolidays, map)
  }
  return allHolidays
}

/**
 * 判断某日是否为休息日（法定假日或调休休息）
 * @param {string} dateStr YYYY-MM-DD
 * @returns {Promise<{isOffDay: boolean, name: string|null}>}
 */
async function isOffDay(dateStr) {
  const d = new Date(dateStr)
  const map = await loadHolidays(d.getFullYear())
  const holiday = map[dateStr]
  if (holiday) {
    return { isOffDay: holiday.is_off_day, name: holiday.name }
  }
  // 无记录：周末默认休息，工作日不休息
  const day = d.getDay()
  const isWeekend = day === 0 || day === 6
  return { isOffDay: isWeekend, name: null }
}

/**
 * 判断某日是否为调休工作日（需跳过排课）
 * @param {string} dateStr
 * @returns {Promise<boolean>}
 */
async function isMakeupWorkday(dateStr) {
  const d = new Date(dateStr)
  const map = await loadHolidays(d.getFullYear())
  const holiday = map[dateStr]
  if (holiday && holiday.is_off_day === false) {
    return true  // 调休工作日
  }
  return false
}

/**
 * 判断某日是否可排课
 * 规则：
 *   - 调休工作日(is_off_day=false) → 不可排课（学生要上学）
 *   - 法定假日(is_off_day=true) → 可排课（学生放假）
 *   - 无记录的周末 → 可排课
 *   - 无记录的工作日 → 按周几模式决定（由调用方判断）
 * @returns {Promise<{canSchedule: boolean, reason: string}>}
 */
async function canScheduleOnDate(dateStr) {
  const makeup = await isMakeupWorkday(dateStr)
  if (makeup) {
    return { canSchedule: false, reason: '调休工作日' }
  }
  return { canSchedule: true, reason: '' }
}

/**
 * 清除缓存
 */
function clearCache() {
  holidayCache = null
  cacheYear = null
}

module.exports = {
  loadHolidays,
  loadHolidaysForRange,
  isOffDay,
  isMakeupWorkday,
  canScheduleOnDate,
  clearCache
}
