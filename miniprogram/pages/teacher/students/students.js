// pages/teacher/students/students.js - 学生管理
const app = getApp()
const { guardRole } = require('../../../utils/auth')
const { _, query, add, update, RegExp } = require('../../../utils/api')

Page({
  data: {
    students: [],
    keyword: '',
    loading: true,
    showAdd: false,
    newStudent: { name: '', grade: '', school: '', notes: '' }
  },

  onLoad() {
  },

  onShow() {
    guardRole('teacher')
    const tabBar = this.selectComponent('#tabBar')
    if (tabBar) {
      tabBar.updateSelected(2)
      tabBar.updateTabs()
    }
    this.loadStudents()
  },

  async loadStudents() {
    const keyword = this.data.keyword

    // 有缓存时先渲染，后台静默刷新
    const cached = app.getPageCache('teacher_students')
    if (cached && !keyword) {
      this.setData({ students: cached, loading: false })
    } else {
      this.setData({ loading: true })
    }

    try {
      let where = {}
      if (keyword) {
        where = _.or([
          { name: RegExp({ regexp: keyword, options: 'i' }) },
          { grade: RegExp({ regexp: keyword, options: 'i' }) }
        ])
      }
      const students = await query('students', where, {
        orderBy: ['created_at', 'desc'],
        pageSize: 100
      })

      // 加载课时消耗情况
      const studentIds = students.map(s => s._id)
      if (studentIds.length > 0) {
        const packages = await query('packages', { student_id: _.in(studentIds) }, { pageSize: 200 })
        const pkgMap = {}
        packages.forEach(pkg => {
          const sid = pkg.student_id
          if (!pkgMap[sid]) pkgMap[sid] = { total: 0, remaining: 0 }
          pkgMap[sid].total += pkg.total_lessons || 0
          pkgMap[sid].remaining += pkg.remaining || 0
        })
        students.forEach(s => {
          const p = pkgMap[s._id]
          s.pkgSummary = p && p.total > 0 ? `剩余${p.remaining}/${p.total}节` : ''
        })
      }

      this.setData({ students, loading: false })
      if (!keyword) {
        app.setPageCache('teacher_students', students)
      }
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

  onPopupVisibleChange(e) {
    this.setData({ showAdd: e.detail.visible })
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
