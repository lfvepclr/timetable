// components/package-bar/index.js
Component({
  properties: {
    consumed: { type: Number, value: 0 },
    total: { type: Number, value: 0 },
    showLabel: { type: Boolean, value: true }
  },
  data: {
    percent: 0,
    remaining: 0
  },
  observers: {
    'consumed, total': function (consumed, total) {
      const remaining = Math.max(0, total - consumed)
      const percent = total > 0 ? Math.round((consumed / total) * 100) : 0
      this.setData({ percent, remaining })
    }
  }
})
