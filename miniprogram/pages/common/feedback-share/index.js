// pages/common/feedback-share/index.js - 反馈分享落地页
const app = getApp()
const { getById, getTempFileURLs } = require('../../../utils/api')

Page({
  data: {
    feedback: null,
    photoUrls: [],
    loading: true
  },

  onLoad(options) {
    if (options.feedback_id) {
      this.loadFeedback(options.feedback_id)
    }
  },

  async loadFeedback(id) {
    try {
      const feedback = await getById('feedbacks', id)
      if (!feedback) {
        wx.showToast({ title: '反馈不存在', icon: 'none' })
        this.setData({ loading: false })
        return
      }
      this.setData({ feedback, loading: false })

      if (feedback.photos && feedback.photos.length > 0) {
        try {
          const urls = await getTempFileURLs(feedback.photos)
          this.setData({ photoUrls: urls })
        } catch (e) {
          console.error('获取照片链接失败:', e)
        }
      }
    } catch (err) {
      console.error('加载反馈失败:', err)
      this.setData({ loading: false })
    }
  },

  previewPhoto(e) {
    const index = e.currentTarget.dataset.index
    wx.previewImage({
      current: this.data.photoUrls[index],
      urls: this.data.photoUrls
    })
  },

  onShareAppMessage() {
    return {
      title: `${this.data.feedback ? this.data.feedback.course_name : ''}课程反馈`,
      path: `/pages/common/feedback-share/index?feedback_id=${this.data.feedback ? this.data.feedback._id : ''}`
    }
  }
})
