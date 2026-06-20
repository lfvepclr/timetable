// pages/teacher/student-detail/student-detail.js - 学生详情
const { db, _, getById, query, update } = require('../../../utils/db')
const { formatDate, friendlyDate, getWeekdayLabel, formatDuration } = require('../../../utils/date')

Page({
  data: {
    student: null,
    packages: [],
    recentLessons: [],
    feedbacks: [],
    loading: true,
    activeTab: 'info',
    editMode: false,
    editData: {}
  },

  onLoad(options) {
    if (options.id) {
      this.studentId = options.id
      this.loadStudent()
    }
  },

  async loadStudent() {
    this.setData({ loading: true })
    try {
      const student = await getById('students', this.studentId)
      if (student) {
        this.setData({ student, editData: { ...student }, loading: false })
        this.loadPackages()
        this.loadRecentLessons()
        this.loadFeedbacks()
      }
    } catch (err) {
      console.error('加载学生失败:', err)
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  async loadPackages() {
    try {
      const packages = await query('packages', { student_id: this.studentId }, {
        orderBy: ['purchase_date', 'desc']
      })
      this.setData({ packages })
    } catch (err) {
      console.error('加载课程包失败:', err)
    }
  },

  async loadRecentLessons() {
    try {
      const lessons = await query('lessons', {
        'students.student_id': this.studentId,
        lesson_status: _.neq('cancelled')
      }, {
        orderBy: ['start_ts', 'desc'],
        pageSize: 10
      })
      this.setData({ recentLessons: lessons })
    } catch (err) {
      console.error('加载课程失败:', err)
    }
  },

  async loadFeedbacks() {
    try {
      const feedbacks = await query('feedbacks', { student_id: this.studentId }, {
        orderBy: ['created_at', 'desc'],
        pageSize: 10
      })
      this.setData({ feedbacks })
    } catch (err) {
      console.error('加载反馈失败:', err)
    }
  },

  switchTab(e) {
    this.setData({ activeTab: e.currentTarget.dataset.tab })
  },

  // 编辑模式
  startEdit() {
    this.setData({ editMode: true })
  },

  cancelEdit() {
    this.setData({ editMode: false, editData: { ...this.data.student } })
  },

  onEditInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ [`editData.${field}`]: e.detail.value })
  },

  async saveEdit() {
    wx.showLoading({ title: '保存中...' })
    try {
      await update('students', this.studentId, {
        name: this.data.editData.name,
        grade: this.data.editData.grade,
        school: this.data.editData.school,
        notes: this.data.editData.notes,
        updated_at: Date.now()
      })
      wx.hideLoading()
      wx.showToast({ title: '已保存', icon: 'success' })
      this.setData({ editMode: false })
      this.loadStudent()
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: '保存失败', icon: 'none' })
    }
  },

  // 跳转课程包管理
  goToPackageManage() {
    wx.navigateTo({ url: '../package-manage/package-manage?student_id=' + this.studentId })
  },

  // 跳转绑定生成
  goToBindGenerate() {
    wx.navigateTo({ url: '../bind-generate/bind-generate?student_id=' + this.studentId })
  },

  // 跳转课程详情
  goToLessonDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '../lesson-detail/lesson-detail?id=' + id })
  },

  // 跳转反馈详情
  goToFeedbackDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '../feedback-card/feedback-card?feedback_id=' + id })
  }
})
