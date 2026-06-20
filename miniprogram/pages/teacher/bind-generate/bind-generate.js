// pages/teacher/bind-generate/bind-generate.js - 生成绑定码
const { getById, query } = require('../../../utils/db')
const { callFn, getTempFileURLs } = require('../../../utils/cloud')

Page({
  data: {
    studentId: '',
    student: null,
    bindCode: '',
    qrUrl: '',
    generating: false,
    bindings: []
  },

  onLoad(options) {
    if (options.student_id) {
      this.setData({ studentId: options.student_id })
      this.loadStudent()
      this.loadBindings()
    }
  },

  async loadStudent() {
    try {
      const student = await getById('students', this.data.studentId)
      if (student) {
        this.setData({ student })
        wx.setNavigationBarTitle({ title: `绑定${student.name}的家长` })
        // 自动生成
        this.generateCode()
      }
    } catch (err) {
      console.error('加载学生失败:', err)
    }
  },

  async loadBindings() {
    try {
      const bindings = await query('bindings', {
        student_id: this.data.studentId,
        status: 'active'
      })
      this.setData({ bindings })
    } catch (err) {
      console.error('加载绑定列表失败:', err)
    }
  },

  async generateCode() {
    this.setData({ generating: true })
    try {
      const result = await callFn('generateBindCode', {
        student_id: this.data.studentId
      })

      this.setData({
        bindCode: result.bind_code,
        generating: false
      })

      // 获取二维码临时链接
      if (result.qr_file_id) {
        try {
          const urls = await getTempFileURLs([result.qr_file_id])
          this.setData({ qrUrl: urls[0] })
        } catch (e) {
          console.error('获取二维码链接失败:', e)
        }
      }
    } catch (err) {
      this.setData({ generating: false })
      console.error('生成绑定码失败:', err)
      wx.showToast({ title: err.message || '生成失败', icon: 'none' })
    }
  },

  // 复制绑定码
  copyCode() {
    wx.setClipboardData({
      data: this.data.bindCode,
      success: () => {
        wx.showToast({ title: '已复制', icon: 'success' })
      }
    })
  },

  // 分享
  onShareAppMessage() {
    return {
      title: `请绑定${this.data.student ? this.data.student.name : '学生'}的家长账号`,
      path: `/pages/common/bind/index?code=${this.data.bindCode}`,
      imageUrl: this.data.qrUrl || ''
    }
  }
})
