// pages/parent/package/package.js - 家长课时详情
const app = getApp()
const { _, query, getById } = require('../../../utils/db')

Page({
  data: {
    packages: [],
    loading: true
  },

  onLoad() {
    this.loadPackages()
  },

  async loadPackages() {
    try {
      const openid = app.globalData.openid || wx.getStorageSync('openid')
      const bindings = await query('bindings', { parent_openid: openid, status: 'active' })
      if (bindings.length === 0) {
        this.setData({ loading: false })
        return
      }

      const packages = await query('packages', {
        student_id: bindings[0].student_id
      }, {
        orderBy: ['purchase_date', 'desc']
      })

      this.setData({ packages, loading: false })
    } catch (err) {
      console.error('加载课时失败:', err)
      this.setData({ loading: false })
    }
  },

  // 查看消耗记录
  showRecords(e) {
    const pkg = e.currentTarget.dataset.pkg
    if (!pkg.consume_records || pkg.consume_records.length === 0) {
      wx.showToast({ title: '暂无消耗记录', icon: 'none' })
      return
    }
    const records = pkg.consume_records.map((r, i) => `${i + 1}. ${r.date} ${r.lesson_name || ''}`).join('\n')
    wx.showModal({
      title: '消耗记录',
      content: records,
      showCancel: false
    })
  }
})
