// pages/teacher/feedback-card/feedback-card.js - Canvas反馈卡片生成
const app = getApp()
const { getById, update, callFn, uploadFile, getTempFileURLs } = require('../../../utils/api')
const canvasDraw = require('../utils/canvas-draw')

Page({
  data: {
    feedback: null,
    student: null,
    lesson: null,
    loading: true,
    cardReady: false,
    cardTempPath: '',
    saving: false,
    notifying: false
  },

  onLoad(options) {
    if (options.feedback_id) {
      this.feedbackId = options.feedback_id
      this.loadData()
    }
  },

  async loadData() {
    try {
      const feedback = await getById('feedbacks', this.feedbackId)
      if (!feedback) {
        wx.showToast({ title: '反馈不存在', icon: 'none' })
        return
      }
      this.setData({ feedback })

      // 加载学生和课程信息
      if (feedback.student_id) {
        const student = await getById('students', feedback.student_id)
        this.setData({ student })
      }
      if (feedback.lesson_id) {
        const lesson = await getById('lessons', feedback.lesson_id)
        this.setData({ lesson })
      }

      // 获取老师信息
      const teacherInfo = app.globalData.userInfo || wx.getStorageSync('userInfo')

      // 获取照片临时链接
      let photoUrls = []
      if (feedback.photos && feedback.photos.length > 0) {
        try {
          photoUrls = await getTempFileURLs(feedback.photos)
        } catch (e) {
          console.error('获取照片链接失败:', e)
        }
      }

      this.setData({ loading: false })

      // 延迟绘制，确保 canvas 节点已渲染
      setTimeout(() => {
        this.drawCard(teacherInfo, photoUrls)
      }, 300)
    } catch (err) {
      console.error('加载反馈失败:', err)
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  async drawCard(teacherInfo, photoUrls) {
    try {
      const query = wx.createSelectorQuery()
      query.select('#feedbackCanvas')
        .fields({ node: true, size: true })
        .exec(async (res) => {
          if (!res[0]) {
            console.error('Canvas节点未找到')
            return
          }

          const canvas = res[0].node
          const ctx = canvas.getContext('2d')
          const dpr = app.globalData.systemInfo ? app.globalData.systemInfo.pixelRatio : 2

          const { feedback, student, lesson } = this.data

          // 加载照片
          const photoImages = []
          for (const url of photoUrls.slice(0, 3)) {
            try {
              const img = await canvasDraw.loadImage(canvas, url)
              photoImages.push(img)
            } catch (e) {
              console.error('加载图片失败:', e)
            }
          }

          // 绘制卡片
          canvasDraw.drawFeedbackCard(canvas, ctx, dpr, {
            date: lesson ? `${lesson.date} ${lesson.start_time}-${lesson.end_time}` : feedback.lesson_date,
            courseName: feedback.course_name || '',
            studentName: student ? student.name : '',
            content: feedback.content,
            performance: feedback.performance,
            homework: feedback.homework,
            teacherComment: feedback.teacher_comment,
            teacherName: teacherInfo ? teacherInfo.name : '老师'
          }, { photos: photoImages })

          // 导出图片
          wx.canvasToTempFilePath({
            canvas,
            success: (res) => {
              this.setData({ cardTempPath: res.tempFilePath, cardReady: true })
            },
            fail: (err) => {
              console.error('导出图片失败:', err)
              wx.showToast({ title: '生成卡片失败', icon: 'none' })
            }
          })
        })
    } catch (err) {
      console.error('绘制卡片失败:', err)
      wx.showToast({ title: '绘制失败', icon: 'none' })
    }
  },

  // 保存到相册
  async saveToAlbum() {
    if (!this.data.cardTempPath) {
      wx.showToast({ title: '卡片未生成', icon: 'none' })
      return
    }

    this.setData({ saving: true })
    try {
      // 请求相册权限
      const { authSetting } = await wx.getSetting()
      if (!authSetting['scope.writePhotosAlbum']) {
        await wx.authorize({ scope: 'scope.writePhotosAlbum' })
      }

      await wx.saveImageToPhotosAlbum({
        filePath: this.data.cardTempPath
      })

      wx.showToast({ title: '已保存到相册', icon: 'success' })

      // 上传到服务端
      const key = `media/cards/${this.feedbackId}.png`
      await uploadFile(this.data.cardTempPath, key)

      // 更新反馈记录
      await update('feedbacks', this.feedbackId, {
        card_image_url: key
      })
    } catch (err) {
      console.error('保存失败:', err)
      if (err.errMsg && err.errMsg.includes('auth deny')) {
        wx.showModal({
          title: '需要相册权限',
          content: '请在设置中允许保存到相册',
          confirmText: '去设置',
          success: (res) => {
            if (res.confirm) wx.openSetting()
          }
        })
      } else {
        wx.showToast({ title: '保存失败', icon: 'none' })
      }
    }
    this.setData({ saving: false })
  },

  // 发送通知给家长
  async notifyParent() {
    if (!this.data.feedback) return

    this.setData({ notifying: true })
    try {
      await callFn('sendNotification', {
        type: 'feedback',
        student_id: this.data.feedback.student_id,
        lesson_id: this.data.feedback.lesson_id,
        feedback_id: this.feedbackId,
        extra_data: {
          content: this.data.feedback.content.substring(0, 20)
        }
      }).then(res => {
        if (res && res.sent > 0) {
          wx.showToast({ title: '已通知家长', icon: 'success' })
        } else {
          wx.showToast({ title: '本地模式不支持推送通知', icon: 'none' })
        }
      })
    } catch (err) {
      console.error('通知失败:', err)
      wx.showToast({ title: '通知失败', icon: 'none' })
    }
    this.setData({ notifying: false })
  },

  // 分享
  onShareAppMessage() {
    return {
      title: `${this.data.student ? this.data.student.name : ''}的课程反馈`,
      path: `/pages/common/feedback-share/index?feedback_id=${this.feedbackId}`,
      imageUrl: this.data.cardTempPath || ''
    }
  },

  onShareTimeline() {
    return {
      title: `${this.data.student ? this.data.student.name : ''}的课程反馈`,
      imageUrl: this.data.cardTempPath || ''
    }
  }
})
