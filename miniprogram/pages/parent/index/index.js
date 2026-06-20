// pages/parent/index/index.js - 家长首页
const app = getApp()
const { guardRole } = require('../../../utils/auth')
const { db, _, query, getById } = require('../../../utils/db')
const { formatDate, friendlyDate, getWeekdayLabel } = require('../../../utils/date')
const { subscribeClassReminder } = require('../../../utils/subscribe')

Page({
  data: {
    student: null,
    nextLesson: null,
    packages: [],
    latestFeedback: null,
    loading: true
  },

  onShow() {
    guardRole('parent')
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().updateSelected(0)
      this.getTabBar().updateTabs()
    }
    this.loadData()
  },

  async loadData() {
    try {
      const openid = app.globalData.openid || wx.getStorageSync('openid')
      if (!openid) return

      // 获取绑定的学生
      const bindings = await query('bindings', { parent_openid: openid, status: 'active' })
      if (bindings.length === 0) {
        this.setData({ loading: false })
        return
      }

      const studentId = bindings[0].student_id
      const student = await getById('students', studentId)
      if (!student) {
        this.setData({ loading: false })
        return
      }

      this.setData({ student })
      wx.setNavigationBarTitle({ title: `${student.name}的课表` })

      // 加载下一节课
      const today = formatDate(new Date())
      const todayTs = new Date(today).getTime()
      const lessons = await query('lessons', {
        'students.student_id': studentId,
        'students.status': _.neq('on_leave'),
        lesson_status: 'scheduled',
        date: _.gte(today)
      }, {
        orderBy: ['start_ts', 'asc'],
        pageSize: 1
      })

      if (lessons.length > 0) {
        const lesson = lessons[0]
        lesson.weekday = getWeekdayLabel(lesson.day_of_week)
        lesson.friendlyDate = friendlyDate(lesson.date)
        this.setData({ nextLesson: lesson })
      }

      // 加载课程包
      const packages = await query('packages', { student_id: studentId, status: 'active' })
      this.setData({ packages })

      // 加载最新反馈
      const feedbacks = await query('feedbacks', { student_id: studentId }, {
        orderBy: ['created_at', 'desc'],
        pageSize: 1
      })
      if (feedbacks.length > 0) {
        this.setData({ latestFeedback: feedbacks[0] })
      }

      this.setData({ loading: false })

      // 引导订阅消息
      subscribeClassReminder()
    } catch (err) {
      console.error('加载首页数据失败:', err)
      this.setData({ loading: false })
    }
  },

  // 跳转课表
  goToSchedule() {
    wx.reLaunch({ url: '/pages/parent/schedule/schedule' })
  },

  // 跳转反馈列表
  goToFeedback() {
    wx.reLaunch({ url: '/pages/parent/feedback-list/feedback-list' })
  },

  // 跳转反馈详情
  goToFeedbackDetail() {
    if (this.data.latestFeedback) {
      wx.navigateTo({
        url: `/pages/parent/feedback-detail/feedback-detail?id=${this.data.latestFeedback._id}`
      })
    }
  },

  // 跳转课时详情
  goToPackage() {
    wx.navigateTo({ url: '/pages/parent/package/package' })
  }
})
