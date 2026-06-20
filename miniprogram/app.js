// app.js - 排课助手小程序入口
App({
  globalData: {
    role: null,        // 当前视图角色 'teacher' | 'parent'
    capabilities: { teacher: false, parent: false },
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
      const result = res.result && res.result.data ? res.result.data : res.result
      const { openid, userId, userInfo, capabilities } = result || {}

      that.globalData.openid = openid
      that.globalData.userInfo = userInfo || { _id: userId }
      that.globalData.capabilities = capabilities || { teacher: true, parent: false }

      // 决定默认角色：优先本地缓存，其次按能力顺序
      let role = wx.getStorageSync('role')
      const hasCachedRole = role === 'teacher'
        ? that.globalData.capabilities.teacher
        : (role === 'parent' ? that.globalData.capabilities.parent : false)

      if (!hasCachedRole) {
        role = that.globalData.capabilities.teacher
          ? 'teacher'
          : (that.globalData.capabilities.parent ? 'parent' : null)
      }

      that.globalData.role = role

      // 缓存到本地
      wx.setStorageSync('openid', openid)
      wx.setStorageSync('role', role)
      wx.setStorageSync('userInfo', that.globalData.userInfo)
      wx.setStorageSync('capabilities', that.globalData.capabilities)

      // 通知 TabBar 更新
      if (that.onRoleReady) {
        that.onRoleReady(role)
      }
    }).catch(err => {
      console.error('登录失败:', err)
      // 使用本地缓存兜底
      that.globalData.role = wx.getStorageSync('role')
      that.globalData.openid = wx.getStorageSync('openid')
      that.globalData.userInfo = wx.getStorageSync('userInfo')
      that.globalData.capabilities = wx.getStorageSync('capabilities') || { teacher: true, parent: false }
      if (that.onRoleReady) {
        that.onRoleReady(that.globalData.role)
      }
    })
  },

  // 切换当前视图角色
  switchRole(role) {
    if (role !== 'teacher' && role !== 'parent') return
    if (!this.globalData.capabilities[role]) {
      wx.showToast({ title: '未开通该身份', icon: 'none' })
      return
    }

    this.globalData.role = role
    wx.setStorageSync('role', role)

    const url = role === 'teacher'
      ? '/pages/teacher/index/index'
      : '/pages/parent/index/index'
    wx.reLaunch({ url })
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
