// utils/subscribe.js - 订阅消息引导封装

const { SUBSCRIBE_TEMPLATES } = require('./constants')

/**
 * 引导用户订阅消息
 * @param {string[]} templateKeys 模板key数组
 * @returns {Promise<object>} 订阅结果
 */
function requestSubscribe(templateKeys) {
  const tmplIds = templateKeys.map(key => SUBSCRIBE_TEMPLATES[key]).filter(Boolean)

  if (tmplIds.length === 0) {
    return Promise.resolve({})
  }

  return new Promise((resolve, reject) => {
    wx.requestSubscribeMessage({
      tmplIds,
      success(res) {
        // res[templateId] = 'accept' | 'reject' | 'ban'
        resolve(res)
      },
      fail(err) {
        console.error('订阅消息失败:', err)
        resolve({})  // 不 reject，订阅失败不影响业务
      }
    })
  })
}

/**
 * 引导订阅反馈通知（家长端）
 */
function subscribeFeedback() {
  return requestSubscribe(['FEEDBACK', 'CLASS_REMINDER'])
}

/**
 * 引导订阅排课变更通知（家长端）
 */
function subscribeScheduleChange() {
  return requestSubscribe(['SCHEDULE_CHANGE', 'CLASS_REMINDER'])
}

/**
 * 引导订阅上课提醒（家长端首页）
 */
function subscribeClassReminder() {
  return requestSubscribe(['CLASS_REMINDER', 'FEEDBACK', 'SCHEDULE_CHANGE'])
}

module.exports = {
  requestSubscribe,
  subscribeFeedback,
  subscribeScheduleChange,
  subscribeClassReminder
}
