// pages/teacher/lesson-detail/lesson-detail.js - 课程详情
const app = getApp()
const { _, getById, update, query, callFn } = require('../../../utils/api')
const { formatDuration, diffMinutes, getWeekdayLabel } = require('../../../utils/date')

Page({
  data: {
    lesson: null,
    loading: true,
    showComplete: false,
    attendedIds: [],
    showLeaveDialog: false,
    leaveStudentId: '',
    leaveReason: ''
  },

  onLoad(options) {
    if (options.id) {
      this.loadLesson(options.id)
    }
  },

  async loadLesson(id) {
    this.setData({ loading: true })
    try {
      const lesson = await getById('lessons', id)
      if (lesson) {
        const duration = diffMinutes(lesson.start_ts, lesson.end_ts)
        lesson.durationText = formatDuration(duration)
        lesson.weekday = getWeekdayLabel(lesson.day_of_week)
        this.setData({ lesson, loading: false, attendedIds: lesson.students.filter(s => s.status === 'scheduled').map(s => s.student_id) })
      }
    } catch (err) {
      console.error('加载课程失败:', err)
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  // 标记完成弹窗
  showCompleteDialog() {
    this.setData({ showComplete: true })
  },

  hideCompleteDialog() {
    this.setData({ showComplete: false })
  },

  onCompletePopupChange(e) {
    this.setData({ showComplete: e.detail.visible })
  },

  onAttendChange(e) {
    this.setData({ attendedIds: e.detail })
  },

  // 切换出勤状态
  toggleAttend(e) {
    const sid = e.currentTarget.dataset.sid
    const ids = [...this.data.attendedIds]
    const idx = ids.indexOf(sid)
    if (idx > -1) {
      ids.splice(idx, 1)
    } else {
      ids.push(sid)
    }
    this.setData({ attendedIds: ids })
  },

  // 保留旧方法作为兼容，实际使用 onAttendChange

  // 确认完成课程
  async confirmComplete() {
    wx.showLoading({ title: '处理中...' })
    try {
      const res = await callFn('completeLesson', {
        lesson_id: this.data.lesson._id,
        attended_student_ids: this.data.attendedIds
      })
      wx.hideLoading()
      wx.showToast({ title: '已完成', icon: 'success' })
      this.setData({ showComplete: false })
      this.loadLesson(this.data.lesson._id)
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: err.message || '操作失败', icon: 'none' })
    }
  },

  // 请假弹窗
  showLeaveDialog(e) {
    const sid = e.currentTarget.dataset.sid
    this.setData({ showLeaveDialog: true, leaveStudentId: sid, leaveReason: '' })
  },

  hideLeaveDialog() {
    this.setData({ showLeaveDialog: false })
  },

  onLeavePopupChange(e) {
    this.setData({ showLeaveDialog: e.detail.visible })
  },

  onLeaveReasonInput(e) {
    this.setData({ leaveReason: e.detail.value })
  },

  // 确认请假
  async confirmLeave() {
    wx.showLoading({ title: '处理中...' })
    try {
      await callFn('requestLeave', {
        lesson_id: this.data.lesson._id,
        student_id: this.data.leaveStudentId,
        reason: this.data.leaveReason
      })
      wx.hideLoading()
      wx.showToast({ title: '已请假', icon: 'success' })
      this.setData({ showLeaveDialog: false })
      this.loadLesson(this.data.lesson._id)
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: err.message || '操作失败', icon: 'none' })
    }
  },

  // 写反馈
  goToFeedback(e) {
    const sid = e.currentTarget.dataset.sid
    wx.navigateTo({
      url: `../feedback-edit/feedback-edit?lesson_id=${this.data.lesson._id}&student_id=${sid}`
    })
  },

  // 补课
  goToReschedule(e) {
    const sid = e.currentTarget.dataset.sid
    wx.navigateTo({
      url: `../lesson-schedule/lesson-schedule?mode=makeup&lesson_id=${this.data.lesson._id}&student_id=${sid}`
    })
  }
})
