// pages/teacher/holiday-manage/holiday-manage.js - 假期管理
const { db, _, query, add, update, remove } = require('../../../utils/db')
const { formatDate } = require('../../../utils/date')

Page({
  data: {
    year: new Date().getFullYear(),
    holidays: [],
    vacations: [],
    loading: true,
    showAdd: false,
    newHoliday: { date: '', name: '', is_off_day: true },
    showVacation: false,
    newVacation: { type: 'summer', start_date: '', end_date: '', year: new Date().getFullYear() }
  },

  onLoad() {
    this.loadHolidays()
    this.loadVacations()
  },

  async loadHolidays() {
    this.setData({ loading: true })
    try {
      const holidays = await query('holidays', { year: this.data.year }, {
        orderBy: ['date', 'asc'],
        pageSize: 100
      })
      this.setData({ holidays, loading: false })
    } catch (err) {
      console.error('加载节假日失败:', err)
      this.setData({ loading: false })
    }
  },

  async loadVacations() {
    try {
      const vacations = await query('vacations', { year: this.data.year })
      this.setData({ vacations })
    } catch (err) {
      console.error('加载假期段失败:', err)
    }
  },

  switchYear(e) {
    const idx = e.detail.value
    const years = [this.data.year - 1, this.data.year, this.data.year + 1]
    this.setData({ year: years[idx] })
    this.loadHolidays()
    this.loadVacations()
  },

  // 添加节假日
  showAddHoliday() {
    this.setData({ showAdd: true, newHoliday: { date: '', name: '', is_off_day: true } })
  },

  hideAddHoliday() {
    this.setData({ showAdd: false })
  },

  onHolidayDateChange(e) {
    this.setData({ 'newHoliday.date': e.detail.value })
  },

  onHolidayNameInput(e) {
    this.setData({ 'newHoliday.name': e.detail.value })
  },

  onHolidayTypeChange(e) {
    this.setData({ 'newHoliday.is_off_day': e.detail.value })
  },

  async saveHoliday() {
    const h = this.data.newHoliday
    if (!h.date || !h.name) {
      wx.showToast({ title: '请填写完整', icon: 'none' })
      return
    }

    wx.showLoading({ title: '保存中...' })
    try {
      const date = new Date(h.date)
      await add('holidays', {
        date: h.date,
        name: h.name,
        is_off_day: h.is_off_day,
        year: date.getFullYear(),
        source: 'manual',
        created_at: Date.now()
      })
      wx.hideLoading()
      wx.showToast({ title: '已添加', icon: 'success' })
      this.setData({ showAdd: false })
      this.loadHolidays()
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: '添加失败', icon: 'none' })
    }
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
      content: '确定删除此节假日记录？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await remove('holidays', id)
            wx.showToast({ title: '已删除', icon: 'success' })
            this.loadHolidays()
          } catch (err) {
            wx.showToast({ title: '删除失败', icon: 'none' })
          }
        }
      }
    })
  },

  // 假期段管理
  showAddVacation() {
    this.setData({ showVacation: true, newVacation: { type: 'summer', start_date: '', end_date: '', year: this.data.year } })
  },

  hideAddVacation() {
    this.setData({ showVacation: false })
  },

  onVacationTypeChange(e) {
    const types = ['summer', 'winter']
    this.setData({ 'newVacation.type': types[e.detail.value] })
  },

  onVacationStartChange(e) {
    this.setData({ 'newVacation.start_date': e.detail.value })
  },

  onVacationEndChange(e) {
    this.setData({ 'newVacation.end_date': e.detail.value })
  },

  async saveVacation() {
    const v = this.data.newVacation
    if (!v.start_date || !v.end_date) {
      wx.showToast({ title: '请选择日期', icon: 'none' })
      return
    }

    wx.showLoading({ title: '保存中...' })
    try {
      await add('vacations', {
        ...v,
        created_at: Date.now()
      })
      wx.hideLoading()
      wx.showToast({ title: '已添加', icon: 'success' })
      this.setData({ showVacation: false })
      this.loadVacations()
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: '添加失败', icon: 'none' })
    }
  }
})
