// pages/teacher/lesson-detail/lesson-detail.js - 课程详情
const app = getApp()
const { _, getById, update, query, callFn } = require('../../../utils/api')
const { formatDuration, diffMinutes, getWeekdayLabel, getTimestamp, getDayOfWeek } = require('../../../utils/date')
const { TIME_SLOTS, DURATION_OPTIONS } = require('../../../utils/constants')

Page({
  data: {
    lesson: null,
    loading: true,
    showComplete: false,
    attendedIds: [],
    showLeaveDialog: false,
    leaveStudentId: '',
    leaveReason: '',
    showEditTime: false,
    timeSlots: TIME_SLOTS,
    durations: DURATION_OPTIONS,
    editDate: '',
    editStartTimeIndex: 0,
    editDurationIndex: 1,
    editEndTime: ''
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

  // ===== 修改时间 =====
  showEditTimeDialog() {
    const lesson = this.data.lesson
    const startTimeIdx = TIME_SLOTS.indexOf(lesson.start_time)
    const durIdx = DURATION_OPTIONS.findIndex(d => d.value === diffMinutes(lesson.start_ts, lesson.end_ts))
    this.setData({
      showEditTime: true,
      editDate: lesson.date,
      editStartTimeIndex: startTimeIdx >= 0 ? startTimeIdx : 0,
      editDurationIndex: durIdx >= 0 ? durIdx : 1,
      editEndTime: lesson.end_time
    })
  },

  hideEditTimeDialog() {
    this.setData({ showEditTime: false })
  },

  onEditTimePopupChange(e) {
    this.setData({ showEditTime: e.detail.visible })
  },

  onEditDateChange(e) {
    this.setData({ editDate: e.detail.value })
  },

  onEditStartTimeChange(e) {
    const idx = e.detail.value
    this.setData({ editStartTimeIndex: idx })
    this.updateEditEndTime()
  },

  onEditDurationChange(e) {
    this.setData({ editDurationIndex: e.detail.value })
    this.updateEditEndTime()
  },

  updateEditEndTime() {
    const startTime = this.data.timeSlots[this.data.editStartTimeIndex]
    const duration = this.data.durations[this.data.editDurationIndex].value
    const [h, m] = startTime.split(':').map(Number)
    const total = h * 60 + m + duration
    const endH = Math.floor(total / 60)
    const endM = total % 60
    this.setData({ editEndTime: `${endH < 10 ? '0' + endH : endH}:${endM < 10 ? '0' + endM : endM}` })
  },

  async saveEditTime() {
    const startTime = this.data.timeSlots[this.data.editStartTimeIndex]
    const duration = this.data.durations[this.data.editDurationIndex].value
    const endTime = this.data.editEndTime
    const date = this.data.editDate
    const startTs = getTimestamp(date, startTime)
    const endTs = getTimestamp(date, endTime)
    const dayOfWeek = getDayOfWeek(date)

    wx.showLoading({ title: '保存中...' })
    try {
      await update('lessons', this.data.lesson._id, {
        date, start_time: startTime, end_time: endTime,
        start_ts: startTs, end_ts: endTs, day_of_week: dayOfWeek
      })
      wx.hideLoading()
      wx.showToast({ title: '已修改', icon: 'success' })
      this.setData({ showEditTime: false })
      this.loadLesson(this.data.lesson._id)
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: '修改失败', icon: 'none' })
    }
  },

  // ===== 消课 =====
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
      wx.showToast({ title: '已消课', icon: 'success' })
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
  },

  // 去反馈（整课）
  goToFeedbackPage() {
    const firstAttended = this.data.lesson.students.find(s => s.status === 'attended')
    if (firstAttended) {
      wx.navigateTo({
        url: `../feedback-edit/feedback-edit?lesson_id=${this.data.lesson._id}&student_id=${firstAttended.student_id}`
      })
    }
  }
})
