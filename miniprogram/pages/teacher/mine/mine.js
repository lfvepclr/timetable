// pages/teacher/mine/mine.js - 老师我的页面
const app = getApp()

Page({
  data: {
    userInfo: null,
    version: '1.0.0'
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().updateSelected(3)
      this.getTabBar().updateTabs()
    }
    const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo')
    this.setData({ userInfo })
  },

  // 假期管理
  goToHolidayManage() {
    wx.navigateTo({ url: '../holiday-manage/holiday-manage' })
  },

  // 设置
  goToSettings() {
    wx.navigateTo({ url: '../settings/settings' })
  },

  // 同步节假日
  async syncHolidays() {
    wx.showLoading({ title: '同步中...' })
    try {
      const { callFn } = require('../../../utils/cloud')
      await callFn('syncHolidays', { year: new Date().getFullYear() })
      wx.hideLoading()
      wx.showToast({ title: '同步成功', icon: 'success' })
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: '同步失败', icon: 'none' })
    }
  },

  // 清除缓存
  clearCache() {
    wx.showModal({
      title: '清除缓存',
      content: '将清除本地缓存数据，不影响云端数据',
      success: (res) => {
        if (res.confirm) {
          wx.clearStorageSync()
          wx.showToast({ title: '已清除', icon: 'success' })
          setTimeout(() => {
            wx.reLaunch({ url: '/pages/common/bind/index' })
          }, 1000)
        }
      }
    })
  },

  // 预览说明
  showAbout() {
    wx.showModal({
      title: '关于排课助手',
      content: '专为课外辅导老师打造的排课管理工具\nv' + this.data.version,
      showCancel: false
    })
  }
})
