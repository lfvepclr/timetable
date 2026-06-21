// pages/teacher/schedule/schedule.js - 老师课表视图
const app = getApp()
const { guardRole } = require('../../../utils/auth')
const { _, query } = require('../../../utils/api')
const { formatDate, getWeekRange, getDayOfWeek, getWeekdayLabel, addDays } = require('../../../utils/date')
const { buildFoldedSchedule, groupByDate } = require('../../../utils/schedule')

Page({
  data: {
    viewMode: 'week',  // 'week' | 'day'
    currentWeek: null,
    weekDates: [],
    selectedDate: '',
    weekLessons: [],   // 本周所有课程
    daySegments: [],   // 当日折叠后的课程段
    dayLessonCounts: [], // 每天课节数（对应 weekDates）
    activeDayIndex: 0,
    loading: true
  },

  onLoad() {
    const week = getWeekRange()
    this.setData({
      currentWeek: week,
      weekDates: week.dates,
      selectedDate: week.dates[0],
      activeDayIndex: 0
    })
  },

  onShow() {
    guardRole('teacher')
    const tabBar = this.selectComponent('#tabBar')
    if (tabBar) {
      tabBar.updateSelected(1)
      tabBar.updateTabs()
    }

    // 每次返回页面都重新加载数据
    if (this.data.currentWeek) {
      this.loadWeekLessons()
    }
  },

  // 切换视图模式
  switchMode(e) {
    const mode = e.currentTarget.dataset.mode
    this.setData({ viewMode: mode })
    if (mode === 'day') {
      this.updateDayView()
    }
  },

  // 选择日期
  selectDate(e) {
    const index = e.currentTarget.dataset.index
    const date = this.data.weekDates[index]
    this.setData({ selectedDate: date, activeDayIndex: index, viewMode: 'day' })
    this.updateDayView()
  },

  // 上一周
  prevWeek() {
    const monday = new Date(this.data.currentWeek.start)
    monday.setDate(monday.getDate() - 7)
    const week = getWeekRange(monday)
    this.setData({ currentWeek: week, weekDates: week.dates })
    this.loadWeekLessons()
  },

  // 下一周
  nextWeek() {
    const monday = new Date(this.data.currentWeek.start)
    monday.setDate(monday.getDate() + 7)
    const week = getWeekRange(monday)
    this.setData({ currentWeek: week, weekDates: week.dates })
    this.loadWeekLessons()
  },

  // 回到本周
  goToday() {
    const week = getWeekRange()
    this.setData({
      currentWeek: week,
      weekDates: week.dates,
      selectedDate: week.dates[0],
      activeDayIndex: 0
    })
    this.loadWeekLessons()
  },

  // 加载本周课程
  async loadWeekLessons(silent = false) {
    if (!silent) {
      this.setData({ loading: true })
    }
    try {
      const { start, end } = this.data.currentWeek
      const lessons = await query('lessons', {
        date: _.gte(start).and(_.lte(end)),
        lesson_status: _.neq('cancelled')
      }, {
        orderBy: ['date', 'asc'],
        pageSize: 100
      })

      this.setData({ weekLessons: lessons, loading: false })
      this.updateDayView()
      this.updateLessonCounts(lessons)
      app.setPageCache('teacher_schedule', { weekLessons: lessons, weekStart: start })
    } catch (err) {
      console.error('加载课表失败:', err)
      this.setData({ loading: false })
    }
  },

  // 更新日视图
  updateDayView() {
    const date = this.data.selectedDate
    const dayLessons = this.data.weekLessons.filter(l => l.date === date)
    const segments = buildFoldedSchedule(dayLessons)
    this.setData({ daySegments: segments })
  },

  // 计算每天课节数
  updateLessonCounts(lessons) {
    const counts = this.data.weekDates.map(date =>
      lessons.filter(l => l.date === date).length
    )
    this.setData({ dayLessonCounts: counts })
  },

  // 点击课程
  onLessonTap(e) {
    const lesson = e.detail.lesson
    wx.navigateTo({
      url: `../lesson-detail/lesson-detail?id=${lesson._id}`
    })
  },

  // 跳转排课
  goToSchedule() {
    wx.navigateTo({ url: '../lesson-schedule/lesson-schedule' })
  },

  // 跳转周模式
  goToPattern() {
    wx.navigateTo({ url: '../pattern-edit/pattern-edit' })
  },

  onPullDownRefresh() {
    this.loadWeekLessons().then(() => wx.stopPullDownRefresh())
  }
})
