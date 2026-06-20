// utils/auth.js - 角色守卫与权限辅助
const app = getApp()

/**
 * 校验当前角色，不匹配则重定向到对应首页
 * @param {string} expectedRole 'teacher' | 'parent'
 * @param {boolean} redirect 是否自动重定向，默认 true
 * @returns {boolean}
 */
function guardRole(expectedRole, redirect = true) {
  const role = app.globalData.role || wx.getStorageSync('role')
  if (role === expectedRole) return true

  if (redirect) {
    const url = expectedRole === 'teacher'
      ? '/pages/teacher/index/index'
      : '/pages/parent/index/index'
    wx.reLaunch({ url })
  }
  return false
}

/**
 * 判断当前用户是否有指定能力
 * @param {string} capability 'teacher' | 'parent'
 * @returns {boolean}
 */
function hasCapability(capability) {
  const caps = app.globalData.capabilities || wx.getStorageSync('capabilities') || {}
  return caps[capability] === true
}

/**
 * 获取当前能力对象
 * @returns {object} { teacher: boolean, parent: boolean }
 */
function getCapabilities() {
  return app.globalData.capabilities || wx.getStorageSync('capabilities') || { teacher: true, parent: false }
}

module.exports = {
  guardRole,
  hasCapability,
  getCapabilities
}
