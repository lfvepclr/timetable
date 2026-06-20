// pages/parent/schedule/schedule.js - 家长课表（只读）
const app = getApp()
const { db, _, query, getById } = require('../../../utils/db')
const { formatDate, getWeekRange, getWeekdayLabel, isToday } = require('../../../utils/date')
const { buildFoldedSchedule, groupByDate } = require('../../../utils/schedule')

Page({
  data: {
    student: null,
    weekDates: [],
    selectedDate: '',
    selectedLessons: [],
    segments: [],
    loading: true,
    weekOffset: 0
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().updateSelected(1)
      this.getTabBar().updateTabs()
    }
    this.initWeek()
    this.loadStudent()
  },

  initWeek(offset = 0) {
    const baseDate = new Date()
    baseDate.setDate(baseDate.getDate() + offset * 7)
    const week = getWeekRange(baseDate)
    this.setData({ weekDates: week.dates })

    if (!this.data.selectedDate || !week.dates.includes(this.data.selectedDate)) {
      this.setData({ selectedDate: isToday(week.dates[0]) ? formatDate(new Date()) : week.dates[0] })
    }
  },

  async loadStudent() {
    try {
      const openid = app.globalData.openid || wx.getStorageSync('openid')
      const bindings = await query('bindings', { parent_openid: openid, status: 'active' })
      if (bindings.length === 0) {
        this.setData({ loading: false })
        return
      }
      const student = await getById('students', bindings[0].student_id)
      this.setData({ student, studentId: bindings[0].student_id })
      this.loadWeekLessons()
    } catch (err) {
      console.error('加载学生失败:', err)
      this.setData({ loading: false })
    }
  },

  async loadWeekLessons() {
    this.setData({ loading: true })
    try {
      const dates = this.data.weekDates
      const startDate = dates[0]
      const endDate = dates[6]

      const lessons = await query('lessons', {
        'students.student_id': this.data.studentId,
        date: _.gte(startDate).and(_.lte(endDate)),
        lesson_status: _.neq('cancelled')
      }, {
        orderBy: ['start_ts', 'asc'],
        pageSize: 100
      })

      this.weekLessons = lessons
      this.filterDayLessons()
    } catch (err) {
      console.error('加载课程失败:', err)
      this.setData({ loading: false })
    }
  },

  filterDayLessons() {
    const date = this.data.selectedDate
    const lessons = (this.weekLessons || []).filter(l => l.date === date)
    const segments = buildFoldedSchedule(lessons)
    this.setData({ selectedLessons: lessons, segments, loading: false })
  },

  onSelectDate(e) {
    this.setData({ selectedDate: e.currentTarget.dataset.date })
    this.filterDayLessons()
  },

  prevWeek() {
    const offset = this.data.weekOffset - 1
    this.setData({ weekOffset: offset })
    this.initWeek(offset)
    this.loadWeekLessons()
  },

  nextWeek() {
    const offset = this.data.weekOffset + 1
    this.setData({ weekOffset: offset })
    this.initWeek(offset)
    this.loadWeekLessons()
  },

  onLessonTap(e) {
    // 家长端课表只读，不跳转
  }
})
