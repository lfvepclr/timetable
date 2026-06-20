// pages/teacher/feedback-edit/feedback-edit.js - 写课后反馈
const { getById, query, update } = require('../../../utils/db')
const { callFn, uploadFile } = require('../../../utils/cloud')
const { formatDate } = require('../../../utils/date')

Page({
  data: {
    lessonId: '',
    studentId: '',
    lesson: null,
    student: null,
    feedback: {
      content: '',
      performance: '',
      homework: '',
      teacher_comment: ''
    },
    photos: [],
    saving: false,
    existingFeedbackId: ''
  },

  onLoad(options) {
    if (options.lesson_id) {
      this.setData({ lessonId: options.lesson_id })
    }
    if (options.student_id) {
      this.setData({ studentId: options.student_id })
    }
    this.loadData()
  },

  async loadData() {
    try {
      const lesson = await getById('lessons', this.data.lessonId)
      if (lesson) {
        this.setData({ lesson })
      }

      const student = await getById('students', this.data.studentId)
      if (student) {
        this.setData({ student })
        wx.setNavigationBarTitle({ title: `${student.name}的反馈` })
      }

      // 检查是否已有反馈
      const existing = await query('feedbacks', {
        lesson_id: this.data.lessonId,
        student_id: this.data.studentId
      })
      if (existing.length > 0) {
        const fb = existing[0]
        this.setData({
          feedback: {
            content: fb.content || '',
            performance: fb.performance || '',
            homework: fb.homework || '',
            teacher_comment: fb.teacher_comment || ''
          },
          photos: fb.photos || [],
          existingFeedbackId: fb._id
        })
      }
    } catch (err) {
      console.error('加载数据失败:', err)
    }
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ [`feedback.${field}`]: e.detail.value })
  },

  onPhotosChange(e) {
    this.setData({ photos: e.detail.photos })
  },

  async handleSave() {
    if (this.data.saving) return

    const { content } = this.data.feedback
    if (!content.trim()) {
      wx.showToast({ title: '请填写上课内容', icon: 'none' })
      return
    }

    this.setData({ saving: true })
    wx.showLoading({ title: '保存中...' })

    try {
      // 上传照片
      const photoFileIds = []
      for (const photo of this.data.photos) {
        if (photo.startsWith('cloud://')) {
          photoFileIds.push(photo)
        } else {
          const cloudPath = `feedbacks/${this.data.lessonId}/${Date.now()}_${Math.random().toString(36).slice(6)}.jpg`
          const fileID = await uploadFile(photo, cloudPath)
          photoFileIds.push(fileID)
        }
      }

      const result = await callFn('saveFeedback', {
        lesson_id: this.data.lessonId,
        student_id: this.data.studentId,
        content: this.data.feedback.content,
        performance: this.data.feedback.performance,
        homework: this.data.feedback.homework,
        teacher_comment: this.data.feedback.teacher_comment,
        photos: photoFileIds
      })

      wx.hideLoading()
      this.setData({ saving: false })

      wx.showToast({ title: '保存成功', icon: 'success' })

      // 跳转生成卡片
      const feedbackId = result.feedback_id
      setTimeout(() => {
        wx.redirectTo({
          url: `../feedback-card/feedback-card?feedback_id=${feedbackId}`
        })
      }, 1000)
    } catch (err) {
      wx.hideLoading()
      this.setData({ saving: false })
      console.error('保存反馈失败:', err)
      wx.showToast({ title: err.message || '保存失败', icon: 'none' })
    }
  }
})
