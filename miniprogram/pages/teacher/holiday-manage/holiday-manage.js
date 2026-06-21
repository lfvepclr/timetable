// pages/teacher/holiday-manage/holiday-manage.js - 假期管理
// 节假日数据已内置为静态代码，此页面展示法定假日 + 自定义假日（localStorage）
const { HOLIDAYS_2025, getHoliday } = require('../../../utils/holidays')

Page({
  data: {
    year: new Date().getFullYear(),
    holidays: [],
    loading: true,
    showAdd: false,
    newHoliday: { date: '', name: '', is_off_day: true }
  },

  onLoad() {
    this.loadHolidays()
  },

  async loadHolidays() {
    this.setData({ loading: true })
    try {
      // 内置节假日（按年份过滤）
      const builtin = HOLIDAYS_2025.filter(h => h.date.startsWith(String(this.data.year)))

      // 自定义节假日（从 localStorage 读取）
      const customKey = `custom_holidays_${this.data.year}`
      const custom = wx.getStorageSync(customKey) || []

      // 合并并排序
      const all = [...builtin, ...custom].sort((a, b) => a.date.localeCompare(b.date))
      this.setData({ holidays: all, loading: false })
    } catch (err) {
      console.error('加载节假日失败:', err)
      this.setData({ loading: false })
    }
  },

  switchYear(e) {
    const idx = e.detail.value
    const years = [this.data.year - 1, this.data.year, this.data.year + 1]
    this.setData({ year: years[idx] })
    this.loadHolidays()
  },

  // 添加节假日
  showAddHoliday() {
    this.setData({ showAdd: true, newHoliday: { date: '', name: '', is_off_day: true } })
  },

  hideAddHoliday() {
    this.setData({ showAdd: false })
  },

  onPopupVisibleChange(e) {
    this.setData({ showAdd: e.detail.visible })
  },

  onHolidayDateChange(e) {
    this.setData({ 'newHoliday.date': e.detail.value })
  },

  onHolidayNameInput(e) {
    this.setData({ 'newHoliday.name': e.detail.value })
  },

  onHolidayTypeChange(e) {
    const value = e.detail.value !== undefined ? e.detail.value : e.detail
    this.setData({ 'newHoliday.is_off_day': value })
  },

  async saveHoliday() {
    const h = this.data.newHoliday
    if (!h.date || !h.name) {
      wx.showToast({ title: '请填写完整', icon: 'none' })
      return
    }

    // 保存到 localStorage
    const customKey = `custom_holidays_${this.data.year}`
    const custom = wx.getStorageSync(customKey) || []
    custom.push({
      date: h.date,
      name: h.name,
      is_off_day: h.is_off_day,
      source: 'manual'
    })
    wx.setStorageSync(customKey, custom)

    wx.showToast({ title: '已添加', icon: 'success' })
    this.setData({ showAdd: false })
    this.loadHolidays()
  },

  // 删除节假日
  async deleteHoliday(e) {
    const id = e.currentTarget.dataset.id
    const source = e.currentTarget.dataset.source
    if (source === 'builtin') {
      wx.showToast({ title: '法定假日不可删除', icon: 'none' })
      return
    }

    wx.showModal({
      title: '确认删除',
      content: '确定删除此自定义节假日？',
      success: (res) => {
        if (res.confirm) {
          const customKey = `custom_holidays_${this.data.year}`
          let custom = wx.getStorageSync(customKey) || []
          custom = custom.filter(h => h.date !== id)
          wx.setStorageSync(customKey, custom)
          wx.showToast({ title: '已删除', icon: 'success' })
          this.loadHolidays()
        }
      }
    })
  }
})
