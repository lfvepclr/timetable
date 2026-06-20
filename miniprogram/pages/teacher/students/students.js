// pages/teacher/students/students.js - 学生管理
const { guardRole } = require('../../../utils/auth')
const { db, _, query, add, update } = require('../../../utils/db')

Page({
  data: {
    students: [],
    keyword: '',
    loading: true,
    showAdd: false,
    newStudent: { name: '', grade: '', school: '', notes: '' }
  },

  onShow() {
    guardRole('teacher')
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().updateSelected(2)
      this.getTabBar().updateTabs()
    }
    this.loadStudents()
  },

  async loadStudents() {
    this.setData({ loading: true })
    try {
      const keyword = this.data.keyword
      let where = {}
      if (keyword) {
        where = _.or([
          { name: db.RegExp({ regexp: keyword, options: 'i' }) },
          { grade: db.RegExp({ regexp: keyword, options: 'i' }) }
        ])
      }
      const students = await query('students', where, {
        orderBy: ['created_at', 'desc'],
        pageSize: 100
      })
      this.setData({ students, loading: false })
    } catch (err) {
      console.error('加载学生失败:', err)
      this.setData({ loading: false })
    }
  },

  onSearch(e) {
    this.setData({ keyword: e.detail.value })
  },

  onSearchConfirm() {
    this.loadStudents()
  },

  showAddDialog() {
    this.setData({ showAdd: true, newStudent: { name: '', grade: '', school: '', notes: '' } })
  },

  hideAddDialog() {
    this.setData({ showAdd: false })
  },

  onInputChange(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ [`newStudent.${field}`]: e.detail.value })
  },

  async saveStudent() {
    const { name } = this.data.newStudent
    if (!name || !name.trim()) {
      wx.showToast({ title: '请输入学生姓名', icon: 'none' })
      return
    }

    wx.showLoading({ title: '保存中...' })
    try {
      const now = Date.now()
      await add('students', {
        ...this.data.newStudent,
        name: name.trim(),
        active: true,
        tags: [],
        created_at: now,
        updated_at: now
      })
      wx.hideLoading()
      wx.showToast({ title: '添加成功', icon: 'success' })
      this.setData({ showAdd: false })
      this.loadStudents()
    } catch (err) {
      wx.hideLoading()
      console.error('添加学生失败:', err)
      wx.showToast({ title: '添加失败', icon: 'none' })
    }
  },

  goToDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `../student-detail/student-detail?id=${id}` })
  },

  onPullDownRefresh() {
    this.loadStudents().then(() => wx.stopPullDownRefresh())
  }
})
