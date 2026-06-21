// pages/parent/feedback-detail/feedback-detail.js - 反馈详情精美呈现
const app = getApp()
const { getById, getTempFileURLs } = require('../../../utils/api')

Page({
  data: {
    feedback: null,
    photoUrls: [],
    loading: true,
    previewVisible: false,
    previewUrls: [],
    previewIndex: 0
  },

  onLoad(options) {
    if (options.id) {
      this.loadFeedback(options.id)
    }
  },

  async loadFeedback(id) {
    try {
      const feedback = await getById('feedbacks', id)
      if (!feedback) {
        wx.showToast({ title: '反馈不存在', icon: 'none' })
        return
      }
      this.setData({ feedback, loading: false })

      // 获取照片临时链接
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
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  // 预览照片
  previewPhoto(e) {
    const index = e.currentTarget.dataset.index
    wx.previewImage({
      current: this.data.photoUrls[index],
      urls: this.data.photoUrls
    })
  },

  // 分享
  onShareAppMessage() {
    return {
      title: `${this.data.feedback ? this.data.feedback.course_name : ''}课程反馈`,
      path: `/pages/common/feedback-share/index?feedback_id=${this.data.feedback._id}`,
      imageUrl: this.data.feedback.card_image_url || ''
    }
  },

  onShareTimeline() {
    return {
      title: `${this.data.feedback ? this.data.feedback.course_name : ''}课程反馈`,
      imageUrl: this.data.feedback.card_image_url || ''
    }
  }
})
