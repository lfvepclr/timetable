// pages/teacher/lesson-schedule/lesson-schedule.js - 手动排课/补课
const { db, _, query, add } = require('../../../utils/db')
const { callFn } = require('../../../utils/cloud')
const { formatDate, getDayOfWeek, getWeekdayLabel, getTimestamp } = require('../../../utils/date')
const { COURSE_TYPE_CONFIG, DURATION_OPTIONS, TIME_RANGE } = require('../../../utils/constants')

Page({
  data: {
    mode: 'manual',       // manual | makeup
    makeupLessonId: '',
    makeupStudentId: '',
    courses: [],
    selectedCourseId: '',
    selectedCourse: null,
    students: [],
    selectedStudentIds: [],
    date: '',
    startTime: '08:00',
    duration: 120,
    durationOptions: DURATION_OPTIONS,
    loading: false,
    minDate: '',
    maxDate: ''
  },

  onLoad(options) {
    const today = formatDate(new Date())
    const maxDate = formatDate(new Date(Date.now() + 180 * 86400000))
    this.setData({
      date: today,
      minDate: today,
      maxDate,
      mode: options.mode || 'manual',
      makeupLessonId: options.lesson_id || '',
      makeupStudentId: options.student_id || ''
    })

    if (this.data.mode === 'makeup') {
      wx.setNavigationBarTitle({ title: '补课排课' })
    }

    this.loadCourses()
    this.loadStudents()
  },

  async loadCourses() {
    try {
      const courses = await query('courses', {}, { pageSize: 50 })
      this.setData({ courses })
      if (courses.length > 0 && !this.data.selectedCourseId) {
        this.selectCourse({ currentTarget: { dataset: { id: courses[0]._id } } })
      }
    } catch (err) {
      console.error('加载课程失败:', err)
    }
  },

  async loadStudents() {
    try {
      const students = await query('students', { active: true }, { pageSize: 100 })
      this.setData({ students })

      // 补课模式预选学生
      if (this.data.mode === 'makeup' && this.data.makeupStudentId) {
        this.setData({ selectedStudentIds: [this.data.makeupStudentId] })
      }
    } catch (err) {
      console.error('加载学生失败:', err)
    }
  },

  selectCourse(e) {
    const id = e.currentTarget.dataset.id
    const course = this.data.courses.find(c => c._id === id)
    if (course) {
      this.setData({
        selectedCourseId: id,
        selectedCourse: course,
        duration: course.default_duration || 120
      })
    }
  },

  onDateChange(e) {
    this.setData({ date: e.detail.value })
  },

  onTimeChange(e) {
    this.setData({ startTime: e.detail.value })
  },

  onDurationChange(e) {
    const idx = e.detail.value
    this.setData({ duration: this.data.durationOptions[idx].value })
  },

  toggleStudent(e) {
    const sid = e.currentTarget.dataset.id
    const ids = [...this.data.selectedStudentIds]
    const idx = ids.indexOf(sid)
    if (idx > -1) {
      ids.splice(idx, 1)
    } else {
      // 检查人数限制
      const course = this.data.selectedCourse
      if (course) {
        const max = COURSE_TYPE_CONFIG[course.type]?.maxStudents || 1
        if (ids.length >= max) {
          wx.showToast({ title: `最多${max}人`, icon: 'none' })
          return
        }
      }
      ids.push(sid)
    }
    this.setData({ selectedStudentIds: ids })
  },

  // 计算结束时间
  getEndTime() {
    const [h, m] = this.data.startTime.split(':').map(Number)
    const totalMinutes = h * 60 + m + this.data.duration
    const endH = Math.floor(totalMinutes / 60)
    const endM = totalMinutes % 60
    return `${endH < 10 ? '0' + endH : endH}:${endM < 10 ? '0' + endM : endM}`
  },

  // 冲突检测+保存
  async handleSchedule() {
    if (!this.data.selectedCourseId) {
      wx.showToast({ title: '请选择课程', icon: 'none' })
      return
    }
    if (this.data.selectedStudentIds.length === 0) {
      wx.showToast({ title: '请选择学生', icon: 'none' })
      return
    }

    this.setData({ loading: true })
    wx.showLoading({ title: '排课中...' })

    try {
      const endTime = this.getEndTime()
      const startTs = getTimestamp(this.data.date, this.data.startTime)
      const endTs = getTimestamp(this.data.date, endTime)
      const dayOfWeek = getDayOfWeek(this.data.date)

      // 冲突检测
      const conflictResult = await callFn('checkSlotConflict', {
        date: this.data.date,
        start_ts: startTs,
        end_ts: endTs,
        student_ids: this.data.selectedStudentIds,
        exclude_lesson_id: this.data.makeupLessonId
      })

      if (conflictResult && conflictResult.hasConflict) {
        wx.hideLoading()
        this.setData({ loading: false })
        wx.showModal({
          title: '时段冲突',
          content: `与 ${conflictResult.conflicts[0].course_name || '其他课程'} 时间重叠`,
          showCancel: false
        })
        return
      }

      // 创建课程
      const course = this.data.selectedCourse
      const lessonData = {
        date: this.data.date,
        day_of_week: dayOfWeek,
        start_time: this.data.startTime,
        end_time: endTime,
        start_ts: startTs,
        end_ts: endTs,
        course_id: course._id,
        course_name: course.name,
        course_type: course.type,
        course_color: course.color,
        students: this.data.selectedStudentIds.map(sid => {
          const s = this.data.students.find(st => st._id === sid)
          return {
            student_id: sid,
            student_name: s ? s.name : '',
            status: 'scheduled'
          }
        }),
        lesson_status: 'scheduled',
        source: this.data.mode === 'makeup' ? 'makeup' : 'manual',
        pattern_id: '',
        feedback_id: '',
        created_at: Date.now()
      }

      await add('lessons', lessonData)

      wx.hideLoading()
      this.setData({ loading: false })
      wx.showToast({ title: '排课成功', icon: 'success' })

      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
    } catch (err) {
      wx.hideLoading()
      this.setData({ loading: false })
      console.error('排课失败:', err)
      wx.showToast({ title: err.message || '排课失败', icon: 'none' })
    }
  }
})
