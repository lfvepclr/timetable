// pages/teacher/settings/settings.js - 通知设置
const { SUBSCRIBE_TEMPLATES } = require('../../../utils/constants')
const { requestSubscribe } = require('../../../utils/subscribe')

Page({
  data: {
    settings: {
      feedbackNotify: true,
      scheduleChangeNotify: true,
      classReminder: true,
      leaveNotice: true
    }
  },

  onLoad() {
    const settings = wx.getStorageSync('teacherSettings')
    if (settings) {
      this.setData({ settings })
    }
  },

  onSwitchChange(e) {
    const key = e.currentTarget.dataset.key
    const value = e.detail.value
    this.setData({ [`settings.${key}`]: value })

    if (value) {
      // 订阅消息
      const templateMap = {
        feedbackNotify: ['FEEDBACK'],
        scheduleChangeNotify: ['SCHEDULE_CHANGE'],
        classReminder: ['CLASS_REMINDER'],
        leaveNotice: ['LEAVE_NOTICE']
      }
      requestSubscribe(templateMap[key] || [])
    }

    wx.setStorageSync('teacherSettings', this.data.settings)
  },

  // 一键订阅所有
  async subscribeAll() {
    wx.showLoading({ title: '请确认...' })
    try {
      await requestSubscribe(['FEEDBACK', 'SCHEDULE_CHANGE', 'CLASS_REMINDER', 'LEAVE_NOTICE'])
      wx.hideLoading()
      wx.showToast({ title: '已开启全部通知', icon: 'success' })
    } catch (err) {
      wx.hideLoading()
    }
  }
})
