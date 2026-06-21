// pages/teacher/index/index.js - 老师今日课表
const app = getApp()
const { guardRole } = require('../../../utils/auth')
const { _, query } = require('../../../utils/api')
const { formatDate, friendlyDate, getDayOfWeek, getWeekdayLabel } = require('../../../utils/date')
const { buildFoldedSchedule } = require('../../../utils/schedule')

Page({
  data: {
    today: '',
    weekday: '',
    todayLessons: [],
    segments: [],
    upcomingLessons: [],
    loading: true,
    hasCache: false,
    lessonStatusTheme: {
      scheduled: 'primary',
      completed: 'success',
      pending_feedback: 'warning',
      cancelled: 'default',
      attended: 'success',
      on_leave: 'warning'
    },
    lessonStatusText: {
      scheduled: '待上课',
      completed: '已完成',
      pending_feedback: '待反馈',
      cancelled: '已取消',
      attended: '已出勤',
      on_leave: '请假'
    }
  },

  onLoad() {
    const today = formatDate(new Date())
    const weekday = getWeekdayLabel(getDayOfWeek(today))
    this.setData({ today, weekday })
  },

  onShow() {
    guardRole('teacher')
    const tabBar = this.selectComponent('#tabBar')
    if (tabBar) {
      tabBar.updateSelected(0)
      tabBar.updateTabs()
    }

    // 有缓存时先渲染缓存，后台静默刷新
    const cached = app.getPageCache('teacher_index')
    if (cached && cached.date === this.data.today) {
      this.setData({
        todayLessons: cached.todayLessons,
        segments: cached.segments,
        upcomingLessons: cached.upcomingLessons || [],
        loading: false,
        hasCache: true
      })
      // 静默刷新（不显示 loading）
      this.loadTodaySchedule(true)
    } else {
      this.loadTodaySchedule(false)
    }
  },

  // 加载今日课程
  async loadTodaySchedule(silent = false) {
    if (!silent) {
      this.setData({ loading: true })
    }

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

      // 合并 setData，减少渲染次数
      this.setData({
        todayLessons: lessons,
        segments,
        loading: false,
        hasCache: true
      })

      // 缓存数据（存入全局，跨 reLaunch 生效）
      app.setPageCache('teacher_index', { todayLessons: lessons, segments, date: today })

      // 加载近期课程（不阻塞主流程）
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
        date: _.gt(today).and(_.lte(weekLaterStr)),
        lesson_status: 'scheduled'
      }, {
        orderBy: ['start_ts', 'asc'],
        pageSize: 20
      })

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

      const upcomingList = upcoming.slice(0, 5)
      this.setData({ upcomingLessons: upcomingList })

      // 更新缓存
      const cached = app.getPageCache('teacher_index')
      if (cached) {
        app.setPageCache('teacher_index', { ...cached, upcomingLessons: upcomingList })
      }
    } catch (err) {
      console.error('加载近期课程失败:', err)
    }
  },

  // 点击课程
  onLessonTap(e) {
    const lesson = e.detail.lesson || e.currentTarget.dataset.lesson
    if (!lesson || !lesson._id) return
    wx.navigateTo({
      url: `../lesson-detail/lesson-detail?id=${lesson._id}`
    })
  },

  goToSchedule() {
    wx.reLaunch({ url: '../schedule/schedule' })
  },

  goToManualSchedule() {
    wx.navigateTo({ url: '../lesson-schedule/lesson-schedule' })
  },

  goToPatternGenerate() {
    wx.navigateTo({ url: '../pattern-generate/pattern-generate' })
  },

  onPullDownRefresh() {
    this.loadTodaySchedule().then(() => {
      wx.stopPullDownRefresh()
    })
  }
})
