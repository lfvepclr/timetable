// app.js - 排课助手小程序入口
App({
  globalData: {
    role: null,        // 'teacher' | 'parent' | 'student'
    openid: null,
    userInfo: null,
    systemInfo: null,
    cloudEnv: 'timetable-prod'  // 云开发环境ID，需替换为实际环境
  },

  onLaunch() {
    // 初始化云开发
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
      return
    }
    wx.cloud.init({
      env: this.globalData.cloudEnv,
      traceUser: true
    })

    // 获取系统信息（用于安全区适配、Canvas dpr等）
    const windowInfo = wx.getWindowInfo()
    const deviceInfo = wx.getDeviceInfo()
    this.globalData.systemInfo = {
      ...windowInfo,
      ...deviceInfo,
      pixelRatio: windowInfo.pixelRatio
    }

    // 登录并判断角色
    this.login()
  },

  // 登录鉴权
  login() {
    const that = this
    wx.cloud.callFunction({
      name: 'login',
      data: {}
    }).then(res => {
      const { openid, role, userId, userInfo } = res.result
      that.globalData.openid = openid
      that.globalData.role = role
      that.globalData.userInfo = userInfo || { _id: userId, role }

      // 缓存到本地
      wx.setStorageSync('openid', openid)
      wx.setStorageSync('role', role)
      wx.setStorageSync('userInfo', that.globalData.userInfo)

      // 通知 TabBar 更新
      if (that.onRoleReady) {
        that.onRoleReady(role)
      }
    }).catch(err => {
      console.error('登录失败:', err)
      // 使用本地缓存兜底
      const cachedRole = wx.getStorageSync('role')
      if (cachedRole) {
        that.globalData.role = cachedRole
        that.globalData.openid = wx.getStorageSync('openid')
        that.globalData.userInfo = wx.getStorageSync('userInfo')
        if (that.onRoleReady) {
          that.onRoleReady(cachedRole)
        }
      }
    })
  },

  // 获取当前角色（带回调，确保角色已就绪）
  getRole(cb) {
    if (this.globalData.role) {
      cb(this.globalData.role)
    } else {
      this.onRoleReady = cb
    }
  }
})
