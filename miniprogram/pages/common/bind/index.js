// pages/common/bind/index.js - 绑定中转页
const app = getApp()
const { callFn } = require('../../../utils/cloud')

Page({
  data: {
    code: '',
    loading: true,
    binding: false,
    bindSuccess: false,
    studentName: '',
    errorMsg: '',
    showRelation: false,
    relationship: '家长'
  },

  onLoad(options) {
    // 从分享链接或扫码进入
    let code = ''
    if (options.code) {
      code = options.code
    } else if (options.scene) {
      // 小程序码扫码进入
      code = decodeURIComponent(options.scene)
    }

    if (code) {
      this.setData({ code })
      this.tryBind(code)
    } else {
      // 没有code，检查是否已登录
      this.checkRole()
    }
  },

  checkRole() {
    const role = app.globalData.role || wx.getStorageSync('role')
    if (role === 'teacher') {
      wx.reLaunch({ url: '/pages/teacher/index/index' })
    } else if (role === 'parent') {
      wx.reLaunch({ url: '/pages/parent/index/index' })
    } else {
      this.setData({ loading: false, errorMsg: '请通过老师分享的链接进入' })
    }
  },

  async tryBind(code) {
    this.setData({ loading: true, errorMsg: '' })
    try {
      const result = await callFn('bindStudent', {
        code,
        relationship: this.data.relationship
      })

      if (result && result.student_name) {
        this.setData({
          bindSuccess: true,
          studentName: result.student_name,
          loading: false
        })

        // 更新全局角色
        app.globalData.role = 'parent'
        wx.setStorageSync('role', 'parent')

        // 延迟跳转
        setTimeout(() => {
          wx.reLaunch({ url: '/pages/parent/index/index' })
        }, 2000)
      }
    } catch (err) {
      console.error('绑定失败:', err)
      this.setData({
        loading: false,
        errorMsg: err.message || '绑定失败'
      })
    }
  },

  onRelationChange(e) {
    const idx = e.detail.value
    const relations = ['家长', '父亲', '母亲', '爷爷', '奶奶', '外公', '外婆', '其他']
    this.setData({ relationship: relations[idx] })
  },

  // 重试
  retry() {
    if (this.data.code) {
      this.tryBind(this.data.code)
    } else {
      this.checkRole()
    }
  }
})
