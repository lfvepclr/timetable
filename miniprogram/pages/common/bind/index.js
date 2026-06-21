// pages/common/bind/index.js - 绑定中转页
const app = getApp()
const { callFn } = require('../../../utils/api')

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
      // 有绑定码，执行绑定流程
      this.setData({ code })
      this.tryBind(code)
    } else {
      // 没有 code，尝试用缓存角色直接跳转（避免先显示绑定页）
      const cachedRole = wx.getStorageSync('role')
      const cachedCaps = wx.getStorageSync('capabilities') || {}

      if (cachedRole === 'parent' && cachedCaps.parent) {
        wx.reLaunch({ url: '/pages/parent/index/index' })
        return
      }
      if (cachedRole === 'teacher' && cachedCaps.teacher) {
        wx.reLaunch({ url: '/pages/teacher/index/index' })
        return
      }
      // 没有缓存，等待登录完成再跳转
      app.getRole(() => this.checkRole())
    }
  },

  checkRole() {
    const role = app.globalData.role || wx.getStorageSync('role')
    const caps = app.globalData.capabilities || wx.getStorageSync('capabilities') || { teacher: true, parent: false }

    if (role === 'parent' && caps.parent) {
      wx.reLaunch({ url: '/pages/parent/index/index' })
    } else if (caps.teacher) {
      wx.reLaunch({ url: '/pages/teacher/index/index' })
    } else if (caps.parent) {
      wx.reLaunch({ url: '/pages/parent/index/index' })
    } else {
      this.setData({ loading: false, errorMsg: '无法连接服务器，请确认服务端已启动' })
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

        // 更新能力并切换到家长视图
        app.globalData.capabilities = { ...app.globalData.capabilities, parent: true }
        wx.setStorageSync('capabilities', app.globalData.capabilities)

        // 延迟跳转
        setTimeout(() => {
          app.switchRole('parent')
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
