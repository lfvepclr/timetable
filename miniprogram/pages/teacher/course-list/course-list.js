// pages/teacher/course-list/course-list.js - 课程管理列表
const { _, query, update, remove } = require('../../../utils/api')
const { COURSE_TYPE_CONFIG } = require('../../../utils/constants')

Page({
  data: {
    courses: [],
    loading: true
  },

  onShow() {
    this.loadCourses()
  },

  async loadCourses() {
    this.setData({ loading: true })
    try {
      const courses = await query('courses', {}, { pageSize: 50 })
      const formatted = courses.map(c => ({
        ...c,
        typeLabel: (COURSE_TYPE_CONFIG[c.type] || { label: c.type }).label
      }))
      this.setData({ courses: formatted, loading: false })
    } catch (err) {
      console.error('加载课程失败:', err)
      this.setData({ loading: false })
    }
  },

  goToEdit(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `../course-edit/course-edit?id=${id}` })
  },

  goToCreate() {
    wx.navigateTo({ url: '../course-edit/course-edit' })
  },

  toggleActive(e) {
    const id = e.currentTarget.dataset.id
    const course = this.data.courses.find(c => c._id === id)
    if (!course) return
    const newActive = !course.active
    update('courses', id, { active: newActive }).then(() => {
      wx.showToast({ title: newActive ? '已启用' : '已停用', icon: 'none' })
      this.loadCourses()
    })
  },

  deleteCourse(e) {
    const id = e.currentTarget.dataset.id
    const course = this.data.courses.find(c => c._id === id)
    if (!course) return
    wx.showModal({
      title: '删除课程',
      content: `确定删除「${course.name}」吗？此操作不可恢复`,
      confirmColor: '#EF4444',
      success: (res) => {
        if (res.confirm) {
          remove('courses', id).then(() => {
            wx.showToast({ title: '已删除', icon: 'success' })
            this.loadCourses()
          })
        }
      }
    })
  },

  onPullDownRefresh() {
    this.loadCourses().then(() => wx.stopPullDownRefresh())
  }
})
