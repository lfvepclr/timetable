// components/confirm-dialog/index.js
Component({
  properties: {
    show: { type: Boolean, value: false },
    title: { type: String, value: '提示' },
    content: { type: String, value: '' },
    confirmText: { type: String, value: '确认' },
    cancelText: { type: String, value: '取消' },
    confirmColor: { type: String, value: '#4A90D9' }
  },
  methods: {
    onConfirm() {
      this.triggerEvent('confirm')
    },
    onCancel() {
      this.triggerEvent('cancel')
    },
    stopPropagation() {}
  }
})
