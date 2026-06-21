// pages/teacher/pattern-edit/pattern-edit.js - 周期排课编辑
const { _, query, add, update, getById } = require('../../../utils/api')
const { WEEKDAYS, COURSE_COLORS, DURATION_OPTIONS, COURSE_TYPE_CONFIG, TIME_SLOTS } = require('../../../utils/constants')
const { formatDate, addDays } = require('../../../utils/date')

Page({
  data: {
    isEdit: false,
    patternId: '',
    form: {
      name: '',
      course_id: '',
      course_name: '',
      course_type: '1v1',
      color: '#5B7CF9',
      cycle_type: 'weekly',
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
    timeSlots: TIME_SLOTS,
    startTimeIndex: 4,
    estimatedCount: 0,
    showStudentPicker: false,
    selectedStudents: {},
    saving: false
  },

  async onLoad(options) {
    const today = formatDate(new Date())
    const defaultEnd = formatDate(addDays(new Date(), 90))
    const startTimeIdx = TIME_SLOTS.indexOf('10:00')
    this.setData({
      'form.valid_from': today,
      'form.valid_until': defaultEnd,
      startTimeIndex: startTimeIdx >= 0 ? startTimeIdx : 4
    })
    this.calculateEstimatedCount()

    await this.loadCourses()
    await this.loadStudents()

    if (options.id) {
      this.setData({ isEdit: true, patternId: options.id })
      this.loadPattern(options.id)
    }
  },

  onShow() {
    // 从课程编辑页返回时刷新课程列表
    this.loadCourses()
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
        const startTimeIdx = TIME_SLOTS.indexOf(pattern.start_time || '10:00')
        this.setData({
          form: { ...this.data.form, ...pattern, cycle_type: pattern.cycle_type || 'weekly' },
          selectedStudents,
          startTimeIndex: startTimeIdx >= 0 ? startTimeIdx : 4
        })
        this.calculateEstimatedCount()
      }
    } catch (err) { console.error(err) }
  },

  goToCreateCourse() {
    wx.navigateTo({ url: '../course-edit/course-edit' })
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
        'form.color': course.color || '#5B7CF9',
        'form.duration': course.default_duration || 120
      })
      this.updateEndTime()
    }
  },

  onDayChange(e) {
    const index = e.detail.value
    this.setData({ 'form.day_of_week': this.data.weekdays[index].value })
    this.calculateEstimatedCount()
  },

  onCycleTypeChange(e) {
    const type = e.currentTarget.dataset.type
    this.setData({ 'form.cycle_type': type })
    this.calculateEstimatedCount()
  },

  onDurationChange(e) {
    const index = e.detail.value
    const duration = this.data.durations[index].value
    this.setData({ 'form.duration': duration })
    this.updateEndTime()
  },

  onStartTimeChange(e) {
    const index = e.detail.value
    const time = this.data.timeSlots[index]
    this.setData({ startTimeIndex: index, 'form.start_time': time })
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
    this.calculateEstimatedCount()
  },

  calculateEstimatedCount() {
    const { cycle_type, day_of_week, valid_from, valid_until } = this.data.form
    if (!valid_from || !valid_until) {
      this.setData({ estimatedCount: 0 })
      return
    }
    const start = new Date(valid_from)
    const end = new Date(valid_until)
    if (start > end) {
      this.setData({ estimatedCount: 0 })
      return
    }
    let count = 0
    const current = new Date(start)
    current.setHours(0, 0, 0, 0)
    end.setHours(23, 59, 59, 999)
    while (current <= end) {
      if (cycle_type === 'daily') {
        count++
      } else {
        const dow = current.getDay()
        const dayOfWeek = dow === 0 ? 7 : dow
        if (dayOfWeek === day_of_week) count++
      }
      current.setDate(current.getDate() + 1)
    }
    this.setData({ estimatedCount: count })
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
    const { name, course_id, cycle_type, day_of_week, start_time, student_ids, valid_from, valid_until } = this.data.form
    if (!course_id) { wx.showToast({ title: '请选择课程', icon: 'none' }); return }
    if (cycle_type === 'weekly' && !day_of_week) { wx.showToast({ title: '请选择周几', icon: 'none' }); return }
    if (student_ids.length === 0) { wx.showToast({ title: '请选择学生', icon: 'none' }); return }
    if (!valid_from) { wx.showToast({ title: '请设生效起始日', icon: 'none' }); return }

    this.setData({ saving: true })
    wx.showLoading({ title: '保存中...' })

    try {
      const data = { ...this.data.form, status: 'active', updated_at: Date.now() }
      if (!data.name) {
        const cycleLabel = cycle_type === 'daily' ? '每天' : (this.data.weekdays.find(w => w.value === day_of_week)?.label || '')
        data.name = `${data.course_name}·${cycleLabel}·${start_time}`
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
