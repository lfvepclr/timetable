// pages/parent/mine/mine.js - 家长我的页面
const app = getApp()
const { query, getById } = require('../../../utils/db')
const { requestSubscribe } = require('../../../utils/subscribe')

Page({
  data: {
    student: null,
    packages: [],
    settings: {
      feedbackNotify: true,
      scheduleChangeNotify: true,
      classReminder: true
    }
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().updateSelected(3)
      this.getTabBar().updateTabs()
    }
    this.loadData()
  },

  async loadData() {
    try {
      const openid = app.globalData.openid || wx.getStorageSync('openid')
      const bindings = await query('bindings', { parent_openid: openid, status: 'active' })
      if (bindings.length === 0) return

      const student = await getById('students', bindings[0].student_id)
      const packages = await query('packages', { student_id: bindings[0].student_id, status: 'active' })
      this.setData({ student, packages })

      const settings = wx.getStorageSync('parentSettings')
      if (settings) this.setData({ settings })
    } catch (err) {
      console.error('加载数据失败:', err)
    }
  },

  onSwitchChange(e) {
    const key = e.currentTarget.dataset.key
    const value = e.detail.value
    this.setData({ [`settings.${key}`]: value })

    if (value) {
      const templateMap = {
        feedbackNotify: ['FEEDBACK'],
        scheduleChangeNotify: ['SCHEDULE_CHANGE'],
        classReminder: ['CLASS_REMINDER']
      }
      requestSubscribe(templateMap[key] || [])
    }

    wx.setStorageSync('parentSettings', this.data.settings)
  },

  goToPackage() {
    wx.navigateTo({ url: '/pages/parent/package/package' })
  }
})
