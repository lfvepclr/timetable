// pages/parent/mine/mine.js - 家长我的页面
const app = getApp()
const { guardRole, getCapabilities } = require('../../../utils/auth')
const { query, getById } = require('../../../utils/api')
const { requestSubscribe } = require('../../../utils/subscribe')

Page({
  data: {
    student: null,
    packages: [],
    settings: {
      feedbackNotify: true,
      scheduleChangeNotify: true,
      classReminder: true
    },
    canSwitchTeacher: true
  },

  onLoad() {
  },

  onShow() {
    guardRole('parent')
    const tabBar = this.selectComponent('#tabBar')
    if (tabBar) {
      tabBar.updateSelected(3)
      tabBar.updateTabs()
    }
    const caps = getCapabilities()
    this.setData({
      canSwitchTeacher: caps.teacher !== false
    })
    this.loadData()
  },

  // 切换为老师视图
  switchToTeacher() {
    app.switchRole('teacher')
  },

  async loadData() {
    try {
      const openid = app.globalData.openid || wx.getStorageSync('openid')
      const students = await query('students', { 'parents.openid': openid, 'parents.status': 'active' })
      if (students.length === 0) return

      const student = students[0]
      const packages = await query('packages', { student_id: student._id, status: 'active' })
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
