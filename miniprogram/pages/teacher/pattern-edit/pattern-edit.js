// pages/teacher/pattern-edit/pattern-edit.js - 周模式编辑
const { db, _, query, add, update, getById } = require('../../../utils/db')
const { WEEKDAYS, COURSE_COLORS, DURATION_OPTIONS, COURSE_TYPE_CONFIG } = require('../../../utils/constants')
const { formatDate } = require('../../../utils/date')

Page({
  data: {
    isEdit: false,
    patternId: '',
    form: {
      name: '',
      course_id: '',
      course_name: '',
      course_type: '1v1',
      color: '#4A90D9',
      day_of_week: 6,
      start_time: '10:00',
      end_time: '12:00',
      duration: 120,
      student_ids: [],
      student_names: [],
      valid_from: '',
      valid_until: '',
      is_weekday_evening: false
    },
    courses: [],
    students: [],
    weekdays: WEEKDAYS,
    colors: COURSE_COLORS,
    durations: DURATION_OPTIONS,
    showStudentPicker: false,
    selectedStudents: {},
    saving: false
  },

  async onLoad(options) {
    const today = formatDate(new Date())
    this.setData({ 'form.valid_from': today })

    await this.loadCourses()
    await this.loadStudents()

    if (options.id) {
      this.setData({ isEdit: true, patternId: options.id })
      this.loadPattern(options.id)
    }
  },

  async loadCourses() {
    try {
      const courses = await query('courses', { active: true }, { pageSize: 50 })
      this.setData({ courses })
    } catch (err) { console.error(err) }
  },

  async loadStudents() {
    try {
      const students = await query('students', { active: true }, { pageSize: 100 })
      this.setData({ students })
    } catch (err) { console.error(err) }
  },

  async loadPattern(id) {
    try {
      const pattern = await getById('weekly_patterns', id)
      if (pattern) {
        const selectedStudents = {}
        ;(pattern.student_ids || []).forEach(sid => { selectedStudents[sid] = true })
        this.setData({ form: { ...this.data.form, ...pattern }, selectedStudents })
      }
    } catch (err) { console.error(err) }
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ [`form.${field}`]: e.detail.value })
  },

  onCourseChange(e) {
    const index = e.detail.value
    const course = this.data.courses[index]
    if (course) {
      this.setData({
        'form.course_id': course._id,
        'form.course_name': course.name,
        'form.course_type': course.type,
        'form.color': course.color || '#4A90D9',
        'form.duration': course.default_duration || 120
      })
      this.updateEndTime()
    }
  },

  onDayChange(e) {
    const index = e.detail.value
    this.setData({ 'form.day_of_week': this.data.weekdays[index].value })
  },

  onDurationChange(e) {
    const index = e.detail.value
    const duration = this.data.durations[index].value
    this.setData({ 'form.duration': duration })
    this.updateEndTime()
  },

  onStartTimeChange(e) {
    this.setData({ 'form.start_time': e.detail.value })
    this.updateEndTime()
  },

  updateEndTime() {
    const { start_time, duration } = this.data.form
    if (start_time && duration) {
      const [h, m] = start_time.split(':').map(Number)
      const totalMin = h * 60 + m + duration
      const endH = Math.floor(totalMin / 60)
      const endM = totalMin % 60
      const end_time = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`
      this.setData({ 'form.end_time': end_time })
    }
  },

  onDateChange(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ [`form.${field}`]: e.detail.value })
  },

  onColorChange(e) {
    this.setData({ 'form.color': e.currentTarget.dataset.color })
  },

  showStudentPicker() {
    this.setData({ showStudentPicker: true })
  },

  hideStudentPicker() {
    this.setData({ showStudentPicker: false })
  },

  toggleStudent(e) {
    const sid = e.currentTarget.dataset.sid
    const sname = e.currentTarget.dataset.sname
    const selectedStudents = { ...this.data.selectedStudents }
    if (selectedStudents[sid]) {
      delete selectedStudents[sid]
    } else {
      selectedStudents[sid] = true
    }
    this.setData({ selectedStudents })
  },

  confirmStudents() {
    const selected = this.data.selectedStudents
    const student_ids = Object.keys(selected).filter(k => selected[k])
    const student_names = student_ids.map(sid => {
      const s = this.data.students.find(st => st._id === sid)
      return s ? s.name : ''
    })
    this.setData({
      'form.student_ids': student_ids,
      'form.student_names': student_names,
      showStudentPicker: false
    })
  },

  async save() {
    const { name, course_id, day_of_week, start_time, student_ids, valid_from, valid_until } = this.data.form
    if (!course_id) { wx.showToast({ title: '请选择课程', icon: 'none' }); return }
    if (!day_of_week) { wx.showToast({ title: '请选择周几', icon: 'none' }); return }
    if (student_ids.length === 0) { wx.showToast({ title: '请选择学生', icon: 'none' }); return }
    if (!valid_from) { wx.showToast({ title: '请设生效起始日', icon: 'none' }); return }

    this.setData({ saving: true })
    wx.showLoading({ title: '保存中...' })

    try {
      const data = { ...this.data.form, status: 'active', updated_at: Date.now() }
      if (!data.name) {
        const weekdayLabel = this.data.weekdays.find(w => w.value === day_of_week)?.label
        data.name = `${data.course_name}·${weekdayLabel}·${start_time}`
      }

      if (this.data.isEdit) {
        await update('weekly_patterns', this.data.patternId, data)
      } else {
        data.created_at = Date.now()
        await add('weekly_patterns', data)
      }

      wx.hideLoading()
      wx.showToast({ title: '保存成功', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 1000)
    } catch (err) {
      wx.hideLoading()
      console.error(err)
      wx.showToast({ title: '保存失败', icon: 'none' })
    } finally {
      this.setData({ saving: false })
    }
  }
})
