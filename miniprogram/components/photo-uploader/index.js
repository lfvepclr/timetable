// components/photo-uploader/index.js
Component({
  properties: {
    maxCount: { type: Number, value: 9 },
    photos: { type: Array, value: [] }
  },
  methods: {
    choosePhoto() {
      const remain = this.data.maxCount - this.data.photos.length
      if (remain <= 0) {
        wx.showToast({ title: `最多上传${this.data.maxCount}张`, icon: 'none' })
        return
      }
      wx.chooseMedia({
        count: remain,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        sizeType: ['compressed'],
        success: (res) => {
          const newPhotos = res.tempFiles.map(f => f.tempFilePath)
          const allPhotos = [...this.data.photos, ...newPhotos].slice(0, this.data.maxCount)
          this.setData({ photos: allPhotos })
          this.triggerEvent('change', { photos: allPhotos })
        }
      })
    },
    previewPhoto(e) {
      const url = e.currentTarget.dataset.url
      wx.previewImage({
        current: url,
        urls: this.data.photos
      })
    },
    removePhoto(e) {
      const index = e.currentTarget.dataset.index
      const photos = [...this.data.photos]
      photos.splice(index, 1)
      this.setData({ photos })
      this.triggerEvent('change', { photos })
    }
  }
})
