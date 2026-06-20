// components/student-tag/index.js
Component({
  properties: {
    name: { type: String, value: '' },
    status: { type: String, value: 'scheduled' },
    selected: { type: Boolean, value: false }
  },
  methods: {
    onTap() {
      this.triggerEvent('tap')
    }
  }
})
