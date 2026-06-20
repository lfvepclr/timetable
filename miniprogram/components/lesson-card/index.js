// components/lesson-card/index.js
Component({
  properties: {
    lesson: { type: Object, value: null },
    showDate: { type: Boolean, value: false },
    compact: { type: Boolean, value: false },
    clickable: { type: Boolean, value: true }
  },
  methods: {
    onTap() {
      if (!this.data.clickable) return
      this.triggerEvent('tap', { lesson: this.data.lesson })
    },
    getStudentNames(students) {
      if (!students || students.length === 0) return ''
      return students.map(s => s.student_name || s.student_id).join('、')
    }
  }
})
