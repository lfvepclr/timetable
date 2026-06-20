// cloudfunctions/syncHolidays/index.js - 节假日数据同步
const cloud = require('wx-server-sdk')
const holidays2025 = require('./holidays-2025.json')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { year } = event
  const targetYear = year || new Date().getFullYear()

  // 选择对应年份的数据
  let holidayData
  if (targetYear === 2025) {
    holidayData = holidays2025
  } else {
    // 其他年份需要补充数据文件
    holidayData = []
  }

  let imported = 0
  let updated = 0

  for (const item of holidayData) {
    // 检查是否已存在
    const existRes = await db.collection('holidays')
      .where({ date: item.date })
      .limit(1)
      .get()

    if (existRes.data.length > 0) {
      const exist = existRes.data[0]
      // 不覆盖手动添加的记录
      if (exist.source === 'manual') {
        continue
      }
      // 更新内置记录
      await db.collection('holidays').doc(exist._id).update({
        data: {
          name: item.name,
          is_off_day: item.is_off_day,
          year: targetYear,
          source: 'builtin'
        }
      })
      updated++
    } else {
      // 新增
      await db.collection('holidays').add({
        data: {
          date: item.date,
          name: item.name,
          is_off_day: item.is_off_day,
          year: targetYear,
          source: 'builtin',
          created_at: Date.now()
        }
      })
      imported++
    }
  }

  return {
    code: 0,
    data: {
      year: targetYear,
      imported,
      updated,
      total: holidayData.length
    }
  }
}
