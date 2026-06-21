// custom-tab-bar/index.js - 自定义底部导航（TDesign）
const app = getApp()

const teacherTabs = [
  { pagePath: '/pages/teacher/index/index', text: '今日', icon: 'home' },
  { pagePath: '/pages/teacher/schedule/schedule', text: '课表', icon: 'calendar' },
  { pagePath: '/pages/teacher/students/students', text: '学生', icon: 'usergroup' },
  { pagePath: '/pages/teacher/mine/mine', text: '我的', icon: 'user' }
]

const parentTabs = [
  { pagePath: '/pages/parent/index/index', text: '首页', icon: 'home' },
  { pagePath: '/pages/parent/schedule/schedule', text: '课表', icon: 'calendar' },
  { pagePath: '/pages/parent/feedback-list/feedback-list', text: '反馈', icon: 'chat' },
  { pagePath: '/pages/parent/mine/mine', text: '我的', icon: 'user' }
]

Component({
  data: {
    selected: 0,
    role: 'teacher',
    tabs: []
  },

  attached() {
    this.updateTabs()
  },

  methods: {
    updateTabs() {
      const role = app.globalData.role || wx.getStorageSync('role') || 'teacher'
      const tabs = role === 'teacher' ? teacherTabs : parentTabs
      this.setData({ role, tabs })
    },

    // 切换 Tab（TDesign change 事件返回 value）
    switchTab(e) {
      const index = e.detail.value
      const tab = this.data.tabs[index]
      if (!tab) return

      this.setData({ selected: index })
      wx.reLaunch({ url: tab.pagePath })
    },

    // 由页面调用，更新选中状态
    updateSelected(index) {
      this.setData({ selected: index })
    }
  }
})
