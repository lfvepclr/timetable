// pages/parent/feedback-list/feedback-list.js - 家长反馈列表
const app = getApp()
const { guardRole } = require('../../../utils/auth')
const { _, query, getById } = require('../../../utils/db')

Page({
  data: {
    feedbacks: [],
    loading: true,
    page: 1,
    hasMore: true
  },

  onShow() {
    guardRole('parent')
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().updateSelected(2)
      this.getTabBar().updateTabs()
    }
    this.setData({ feedbacks: [], page: 1, hasMore: true })
    this.loadFeedbacks()
  },

  async loadFeedbacks() {
    if (!this.data.hasMore && this.data.feedbacks.length > 0) return

    try {
      const openid = app.globalData.openid || wx.getStorageSync('openid')
      const bindings = await query('bindings', { parent_openid: openid, status: 'active' })
      if (bindings.length === 0) {
        this.setData({ loading: false })
        return
      }

      const studentId = bindings[0].student_id
      const feedbacks = await query('feedbacks', { student_id: studentId }, {
        orderBy: ['created_at', 'desc'],
        page: this.data.page,
        pageSize: 20
      })

      this.setData({
        feedbacks: this.data.page === 1 ? feedbacks : [...this.data.feedbacks, ...feedbacks],
        hasMore: feedbacks.length >= 20,
        loading: false
      })
    } catch (err) {
      console.error('加载反馈列表失败:', err)
      this.setData({ loading: false })
    }
  },

  goToDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/parent/feedback-detail/feedback-detail?id=${id}` })
  },

  onReachBottom() {
    if (this.data.hasMore) {
      this.setData({ page: this.data.page + 1 })
      this.loadFeedbacks()
    }
  }
})
