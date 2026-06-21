// lib/wxapi.js — 微信 API 调用（code2session / access_token / 订阅消息 / 小程序码）
const config = require('../config')

let accessTokenCache = { token: '', expireAt: 0 }

/**
 * code2session — 用前端传来的 code 换取 openid
 */
async function code2session(code) {
  const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${config.wx.appid}&secret=${config.wx.secret}&js_code=${code}&grant_type=authorization_code`
  const resp = await fetch(url)
  const data = await resp.json()
  if (data.errcode) {
    throw new Error(`code2session 失败: ${data.errmsg} (${data.errcode})`)
  }
  return data // { openid, session_key, unionid? }
}

/**
 * 获取 access_token（带缓存）
 */
async function getAccessToken() {
  if (accessTokenCache.token && accessTokenCache.expireAt > Date.now() + 60000) {
    return accessTokenCache.token
  }
  const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${config.wx.appid}&secret=${config.wx.secret}`
  const resp = await fetch(url)
  const data = await resp.json()
  if (data.errcode) {
    throw new Error(`获取 access_token 失败: ${data.errmsg} (${data.errcode})`)
  }
  accessTokenCache = {
    token: data.access_token,
    expireAt: Date.now() + data.expires_in * 1000,
  }
  return data.access_token
}

/**
 * 发送订阅消息
 */
async function sendSubscribeMessage(openid, templateId, page, templateData) {
  const token = await getAccessToken()
  const url = `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${token}`
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      touser: openid,
      template_id: templateId,
      page,
      data: templateData,
    }),
  })
  const data = await resp.json()
  return data
}

/**
 * 生成小程序码（getUnlimited）
 * @returns {Buffer} 图片 buffer
 */
async function generateWxaCode(scene, page, width = 280) {
  const token = await getAccessToken()
  const url = `https://api.weixin.qq.com/wxa/getwxacodeunlimit?access_token=${token}`
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      scene,
      page,
      width,
      auto_color: false,
      line_color: { r: 74, g: 144, b: 217 },
    }),
  })
  const buffer = Buffer.from(await resp.arrayBuffer())
  // 检查是否返回了错误 JSON
  const contentType = resp.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    const data = JSON.parse(buffer.toString())
    throw new Error(`生成小程序码失败: ${data.errmsg} (${data.errcode})`)
  }
  return buffer
}

module.exports = { code2session, getAccessToken, sendSubscribeMessage, generateWxaCode }
