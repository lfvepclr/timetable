// pages/teacher/mine/mine.js - 老师我的页面
const app = getApp()
const { guardRole, getCapabilities } = require('../../../utils/auth')
const localDb = require('../../../utils/local-db')

Page({
  data: {
    userInfo: null,
    version: '1.0.0',
    canSwitchParent: false
  },

  onLoad() {
  },

  onShow() {
    guardRole('teacher')
    const tabBar = this.selectComponent('#tabBar')
    if (tabBar) {
      tabBar.updateSelected(3)
      tabBar.updateTabs()
    }
    const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo')
    const caps = getCapabilities()
    this.setData({
      userInfo,
      canSwitchParent: caps.parent === true
    })
  },

  // 切换为家长视图
  switchToParent() {
    app.switchRole('parent')
  },

  // 假期管理
  goToHolidayManage() {
    wx.navigateTo({ url: '../holiday-manage/holiday-manage' })
  },

  // 设置
  goToSettings() {
    wx.navigateTo({ url: '../settings/settings' })
  },

  // 同步节假日（已内置静态数据，无需同步）
  async syncHolidays() {
    wx.showToast({ title: '节假日已内置', icon: 'success' })
  },

  // 清除缓存
  clearCache() {
    wx.showModal({
      title: '清除缓存',
      content: '将清除所有本地数据（学生、课程、课时等），此操作不可恢复',
      success: (res) => {
        if (res.confirm) {
          wx.clearStorageSync()
          app.clearPageCache()
          // 重置本地数据库
          localDb.replaceData({})
          wx.showToast({ title: '已清除', icon: 'success' })
          setTimeout(() => {
            wx.reLaunch({ url: '/pages/teacher/index/index' })
          }, 1000)
        }
      }
    })
  },

  // 导出数据
  exportData() {
    wx.showActionSheet({
      itemList: ['分享到微信聊天', '保存到本地'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this._shareData()
        } else {
          this._saveToLocal()
        }
      }
    })
  },

  _shareData() {
    const data = localDb.getRawData()
    const dateStr = new Date().toISOString().slice(0, 10)
    const fileName = `timetable_export_${dateStr}.json`
    const filePath = `${wx.env.USER_DATA_PATH}/${fileName}`
    try {
      const fs = wx.getFileSystemManager()
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
      wx.shareFileMessage({
        filePath,
        fileName,
        success: () => {
          wx.showToast({ title: '分享成功', icon: 'success' })
        },
        fail: (err) => {
          console.error('分享失败:', err)
          wx.showToast({ title: '分享取消', icon: 'none' })
        }
      })
    } catch (e) {
      console.error('导出失败:', e)
      wx.showToast({ title: '导出失败', icon: 'none' })
    }
  },

  _saveToLocal() {
    const data = localDb.getRawData()
    const dateStr = new Date().toISOString().slice(0, 10)
    const fileName = `timetable_export_${dateStr}.json`
    const filePath = `${wx.env.USER_DATA_PATH}/${fileName}`
    try {
      const fs = wx.getFileSystemManager()
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
      wx.showModal({
        title: '导出成功',
        content: `文件已保存：${fileName}`,
        showCancel: false
      })
    } catch (e) {
      console.error('保存失败:', e)
      wx.showToast({ title: '保存失败', icon: 'none' })
    }
  },

  // 导入数据
  importData() {
    wx.showModal({
      title: '导入数据',
      content: '将从文件导入数据，当前数据将被覆盖。确定继续？',
      success: (res) => {
        if (!res.confirm) return
        wx.chooseMessageFile({
          count: 1,
          type: 'file',
          extension: ['json'],
          success: (fileRes) => {
            const filePath = fileRes.tempFiles[0].path
            try {
              const fs = wx.getFileSystemManager()
              const content = fs.readFileSync(filePath, 'utf-8')
              const data = JSON.parse(content)
              // 验证数据结构
              const validTables = ['students', 'courses', 'packages', 'lessons', 'feedbacks', 'weekly_patterns']
              const hasValidTable = validTables.some(t => Array.isArray(data[t]))
              if (!hasValidTable) {
                wx.showToast({ title: '文件格式不正确', icon: 'none' })
                return
              }
              localDb.replaceData(data)
              app.clearPageCache()
              wx.showToast({ title: '导入成功', icon: 'success' })
              setTimeout(() => {
                wx.reLaunch({ url: '/pages/teacher/index/index' })
              }, 1000)
            } catch (e) {
              console.error('导入失败:', e)
              wx.showToast({ title: '导入失败：文件格式错误', icon: 'none' })
            }
          }
        })
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
