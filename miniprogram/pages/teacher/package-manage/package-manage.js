// pages/teacher/package-manage/package-manage.js - 课程包管理
const { db, _, query, add, update } = require('../../../utils/db')
const { formatDate } = require('../../../utils/date')
const { PACKAGE_OPTIONS, PACKAGE_STATUS } = require('../../../utils/constants')

Page({
  data: {
    studentId: '',
    student: null,
    packages: [],
    courses: [],
    showAdd: false,
    newPkg: {
      course_id: '',
      total_lessons: 10,
      purchase_date: ''
    },
    loading: true
  },

  onLoad(options) {
    if (options.student_id) {
      this.setData({ studentId: options.student_id })
      this.loadStudent()
      this.loadPackages()
      this.loadCourses()
    }
  },

  async loadStudent() {
    try {
      const { getById } = require('../../../utils/db')
      const student = await getById('students', this.data.studentId)
      this.setData({ student })
      wx.setNavigationBarTitle({ title: `${student.name}的课程包` })
    } catch (err) {
      console.error('加载学生失败:', err)
    }
  },

  async loadPackages() {
    this.setData({ loading: true })
    try {
      const packages = await query('packages', { student_id: this.data.studentId }, {
        orderBy: ['purchase_date', 'desc']
      })
      this.setData({ packages, loading: false })
    } catch (err) {
      console.error('加载课程包失败:', err)
      this.setData({ loading: false })
    }
  },

  async loadCourses() {
    try {
      const courses = await query('courses', {}, { pageSize: 50 })
      this.setData({ courses })
    } catch (err) {
      console.error('加载课程失败:', err)
    }
  },

  showAddDialog() {
    const today = formatDate(new Date())
    this.setData({
      showAdd: true,
      newPkg: {
        course_id: this.data.courses.length > 0 ? this.data.courses[0]._id : '',
        total_lessons: 10,
        purchase_date: today
      }
    })
  },

  hideAddDialog() {
    this.setData({ showAdd: false })
  },

  onCourseChange(e) {
    const idx = e.detail.value
    this.setData({ 'newPkg.course_id': this.data.courses[idx]._id })
  },

  onTotalChange(e) {
    const idx = e.detail.value
    this.setData({ 'newPkg.total_lessons': PACKAGE_OPTIONS[idx] })
  },

  onDateChange(e) {
    this.setData({ 'newPkg.purchase_date': e.detail.value })
  },

  async savePackage() {
    const pkg = this.data.newPkg
    if (!pkg.course_id) {
      wx.showToast({ title: '请选择课程', icon: 'none' })
      return
    }

    wx.showLoading({ title: '保存中...' })
    try {
      const course = this.data.courses.find(c => c._id === pkg.course_id)
      await add('packages', {
        student_id: this.data.studentId,
        course_id: pkg.course_id,
        course_name: course ? course.name : '',
        total_lessons: pkg.total_lessons,
        consumed_lessons: 0,
        remaining: pkg.total_lessons,
        status: PACKAGE_STATUS.ACTIVE,
        purchase_date: pkg.purchase_date,
        consume_records: [],
        created_at: Date.now()
      })
      wx.hideLoading()
      wx.showToast({ title: '添加成功', icon: 'success' })
      this.setData({ showAdd: false })
      this.loadPackages()
    } catch (err) {
      wx.hideLoading()
      console.error('添加课程包失败:', err)
      wx.showToast({ title: '添加失败', icon: 'none' })
    }
  },

  // 查看消耗记录
  showRecords(e) {
    const pkg = e.currentTarget.dataset.pkg
    if (!pkg.consume_records || pkg.consume_records.length === 0) {
      wx.showToast({ title: '暂无消耗记录', icon: 'none' })
      return
    }
    const records = pkg.consume_records.map(r => `${r.date} ${r.lesson_name || ''}`).join('\n')
    wx.showModal({
      title: '消耗记录',
      content: records,
      showCancel: false
    })
  }
})
