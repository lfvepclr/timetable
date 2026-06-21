// utils/holidays.js — 静态节假日数据（从云数据库迁移）
// 节假日无需数据库存储，直接打包进代码

const HOLIDAYS_2025 = [
  { date: '2025-01-01', name: '元旦', is_off_day: true },
  { date: '2025-01-26', name: '春节调休工作日', is_off_day: false },
  { date: '2025-01-28', name: '除夕', is_off_day: true },
  { date: '2025-01-29', name: '春节', is_off_day: true },
  { date: '2025-01-30', name: '春节', is_off_day: true },
  { date: '2025-01-31', name: '春节', is_off_day: true },
  { date: '2025-02-01', name: '春节', is_off_day: true },
  { date: '2025-02-02', name: '春节', is_off_day: true },
  { date: '2025-02-03', name: '春节', is_off_day: true },
  { date: '2025-02-04', name: '春节', is_off_day: true },
  { date: '2025-02-08', name: '春节调休工作日', is_off_day: false },
  { date: '2025-04-04', name: '清明节', is_off_day: true },
  { date: '2025-04-05', name: '清明节', is_off_day: true },
  { date: '2025-04-06', name: '清明节', is_off_day: true },
  { date: '2025-04-27', name: '劳动节调休工作日', is_off_day: false },
  { date: '2025-05-01', name: '劳动节', is_off_day: true },
  { date: '2025-05-02', name: '劳动节', is_off_day: true },
  { date: '2025-05-03', name: '劳动节', is_off_day: true },
  { date: '2025-05-04', name: '劳动节', is_off_day: true },
  { date: '2025-05-05', name: '劳动节', is_off_day: true },
  { date: '2025-05-31', name: '端午节', is_off_day: true },
  { date: '2025-06-01', name: '端午节', is_off_day: true },
  { date: '2025-06-02', name: '端午节', is_off_day: true },
  { date: '2025-09-28', name: '国庆节调休工作日', is_off_day: false },
  { date: '2025-10-01', name: '国庆节', is_off_day: true },
  { date: '2025-10-02', name: '国庆节', is_off_day: true },
  { date: '2025-10-03', name: '国庆节', is_off_day: true },
  { date: '2025-10-04', name: '中秋节', is_off_day: true },
  { date: '2025-10-05', name: '国庆节', is_off_day: true },
  { date: '2025-10-06', name: '国庆节', is_off_day: true },
  { date: '2025-10-07', name: '国庆节', is_off_day: true },
  { date: '2025-10-08', name: '国庆节', is_off_day: true },
  { date: '2025-10-11', name: '国庆节调休工作日', is_off_day: false },
]

// 构建快速查找 Map
const holidayMap = {}
HOLIDAYS_2025.forEach(h => { holidayMap[h.date] = h })

/**
 * 获取某天的节假日信息
 * @param {string} dateStr 日期 YYYY-MM-DD
 * @returns {object|null} { date, name, is_off_day }
 */
function getHoliday(dateStr) {
  return holidayMap[dateStr] || null
}

/**
 * 判断某天是否为休息日（法定假日）
 * @param {string} dateStr
 * @returns {boolean|null} true=法定假日, false=调休工作日, null=非节假日
 */
function isOffDay(dateStr) {
  const h = getHoliday(dateStr)
  return h ? h.is_off_day : null
}

/**
 * 判断某天是否为调休工作日（需跳过排课）
 * @param {string} dateStr
 * @returns {boolean}
 */
function isMakeupWorkday(dateStr) {
  const h = getHoliday(dateStr)
  return h ? h.is_off_day === false : false
}

module.exports = {
  HOLIDAYS_2025,
  getHoliday,
  isOffDay,
  isMakeupWorkday,
}
