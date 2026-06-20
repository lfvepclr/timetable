// pages/teacher/index/index.js - 老师今日课表
const app = getApp()
const { guardRole } = require('../../../utils/auth')
const { db, _, query } = require('../../../utils/db')
const { formatDate, friendlyDate, getDayOfWeek, getWeekdayLabel } = require('../../../utils/date')
const { buildFoldedSchedule } = require('../../../utils/schedule')
const { callFn } = require('../../../utils/cloud')

Page({
  data: {
    today: '',
    weekday: '',
    todayLessons: [],
    segments: [],
    upcomingLessons: [],
    loading: true
  },

  onLoad() {
    const today = formatDate(new Date())
    const weekday = getWeekdayLabel(getDayOfWeek(today))
    this.setData({ today, weekday })
  },

  onShow() {
    guardRole('teacher')
    // 更新 TabBar 选中状态
    const tabBar = this.selectComponent('#tabBar')
    if (tabBar) {
      tabBar.updateSelected(0)
      tabBar.updateTabs()
    }
    this.loadTodaySchedule()
  },

  // 加载今日课程
  async loadTodaySchedule() {
    this.setData({ loading: true })
    try {
      const today = this.data.today
      const lessons = await query('lessons', {
        date: today,
        lesson_status: _.neq('cancelled')
      }, {
        orderBy: ['start_ts', 'asc'],
        pageSize: 50
      })

      const segments = buildFoldedSchedule(lessons)
      this.setData({ todayLessons: lessons, segments, loading: false })

      // 加载近期课程（未来7天）
      this.loadUpcomingLessons()
    } catch (err) {
      console.error('加载今日课程失败:', err)
      this.setData({ loading: false })
    }
  },

  // 加载近期课程
  async loadUpcomingLessons() {
    try {
      const today = this.data.today
      const todayTs = new Date(today).getTime()
      const weekLater = new Date(todayTs + 7 * 86400000)
      const weekLaterStr = formatDate(weekLater)

      const lessons = await query('lessons', {
        date: _.gt(today),
        date: _.lte(weekLaterStr),
        lesson_status: 'scheduled'
      }, {
        orderBy: ['start_ts', 'asc'],
        pageSize: 20
      })

      // 按日期分组显示
      const grouped = {}
      lessons.forEach(l => {
        if (!grouped[l.date]) grouped[l.date] = []
        grouped[l.date].push(l)
      })

      const upcoming = Object.keys(grouped).map(date => ({
        date,
        label: friendlyDate(date),
        lessons: grouped[date]
      }))

      this.setData({ upcomingLessons: upcoming.slice(0, 5) })
    } catch (err) {
      console.error('加载近期课程失败:', err)
    }
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
    wx.reLaunch({ url: '../schedule/schedule' })
  },

  // 手动排课
  goToManualSchedule() {
    wx.navigateTo({
      url: '../lesson-schedule/lesson-schedule'
    })
  },

  // 周模式生成
  goToPatternGenerate() {
    wx.navigateTo({
      url: '../pattern-generate/pattern-generate'
    }
    )
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.loadTodaySchedule().then(() => {
      wx.stopPullDownRefresh()
    })
  }
})
