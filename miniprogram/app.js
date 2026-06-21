// app.js - 排课助手小程序入口（本地数据库模式）
const localDb = require('./utils/local-db')

App({
  globalData: {
    role: null,        // 当前视图角色 'teacher' | 'parent'
    capabilities: { teacher: true, parent: false },
    openid: null,
    userInfo: null,
    systemInfo: null,
    pageCache: {}      // 跨 reLaunch 的页面数据缓存
  },

  onLaunch() {
    // 获取系统信息（用于安全区适配、Canvas dpr等）
    const windowInfo = wx.getWindowInfo()
    const deviceInfo = wx.getDeviceInfo()
    this.globalData.systemInfo = {
      ...windowInfo,
      ...deviceInfo,
      pixelRatio: windowInfo.pixelRatio
    }

    // 预加载 TDesign 图标字体，规避开发者工具 ERR_CACHE_MISS
    wx.loadFontFace({
      family: 't',
      source: 'url("https://tdesign.gtimg.com/icon/0.4.2/fonts/t.woff")',
      global: true,
      scopes: ['webview', 'native']
    })

    // 初始化本地数据库并加载用户
    this.initLocalUser()
  },

  // 初始化本地用户（无需服务端登录）
  initLocalUser() {
    // 初始化数据库
    localDb.init()

    // 检查本地是否已有用户
    let userInfo = wx.getStorageSync('userInfo')
    let openid = wx.getStorageSync('openid')

    if (!userInfo || !openid) {
      // 首次使用，创建默认老师用户
      openid = 'local_' + Date.now()
      userInfo = { _id: openid, name: '老师', capabilities: { teacher: true, parent: false } }
      wx.setStorageSync('openid', openid)
      wx.setStorageSync('userInfo', userInfo)
    }

    this.globalData.openid = openid
    this.globalData.userInfo = userInfo
    this.globalData.capabilities = { teacher: true, parent: false }
    this.globalData.role = 'teacher'

    wx.setStorageSync('role', 'teacher')
    wx.setStorageSync('capabilities', this.globalData.capabilities)

    if (this.onRoleReady) {
      this.onRoleReady('teacher')
    }
  },

  // 切换当前视图角色（本地模式仅支持 teacher）
  switchRole(role) {
    if (role !== 'teacher' && role !== 'parent') return
    if (role === 'parent') {
      wx.showToast({ title: '本地模式暂不支持家长端', icon: 'none' })
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
  },

  // 页面缓存（跨 reLaunch 保存数据，减少切换闪烁）
  getPageCache(key) {
    const cache = this.globalData.pageCache[key]
    if (cache && Date.now() - cache.ts < 30000) {
      return cache.data
    }
    return null
  },

  setPageCache(key, data) {
    this.globalData.pageCache[key] = { data, ts: Date.now() }
  },

  clearPageCache(key) {
    if (key) {
      delete this.globalData.pageCache[key]
    } else {
      this.globalData.pageCache = {}
    }
  }
})
