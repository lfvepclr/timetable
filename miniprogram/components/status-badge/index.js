// components/status-badge/index.js
Component({
  properties: {
    status: { type: String, value: 'scheduled' },
    type: { type: String, value: 'lesson' } // 'lesson' | 'student'
  },
  data: {
    labelMap: {
      scheduled: '待上课',
      completed: '已完成',
      cancelled: '已取消',
      attended: '已出勤',
      on_leave: '请假'
    },
    classMap: {
      scheduled: 'badge-blue',
      completed: 'badge-green',
      cancelled: 'badge-gray',
      attended: 'badge-green',
      on_leave: 'badge-orange'
    }
  }
})
