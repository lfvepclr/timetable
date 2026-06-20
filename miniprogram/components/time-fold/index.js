// components/time-fold/index.js
Component({
  properties: {
    segments: { type: Array, value: [] }
  },
  data: {
    expandedFolds: {}  // 记录哪些折叠条被展开
  },
  methods: {
    // 点击折叠条展开/收起
    toggleFold(e) {
      const index = e.currentTarget.dataset.index
      const expanded = { ...this.data.expandedFolds }
      expanded[index] = !expanded[index]
      this.setData({ expandedFolds: expanded })
    },
    // 点击课程
    onLessonTap(e) {
      const lesson = e.currentTarget.dataset.lesson
      this.triggerEvent('lessontap', { lesson })
    }
  }
})
