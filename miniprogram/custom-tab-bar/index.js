// custom-tab-bar/index.js - 自定义底部导航
const app = getApp()

const teacherTabs = [
  {
    pagePath: '/pages/teacher/index/index',
    text: '今日',
    iconPath: '/assets/icons/tab-home.png',
    selectedIconPath: '/assets/icons/tab-home-active.png',
    iconSvg: 'home'
  },
  {
    pagePath: '/pages/teacher/schedule/schedule',
    text: '课表',
    iconPath: '/assets/icons/tab-schedule.png',
    selectedIconPath: '/assets/icons/tab-schedule-active.png',
    iconSvg: 'calendar'
  },
  {
    pagePath: '/pages/teacher/students/students',
    text: '学生',
    iconPath: '/assets/icons/tab-student.png',
    selectedIconPath: '/assets/icons/tab-student-active.png',
    iconSvg: 'users'
  },
  {
    pagePath: '/pages/teacher/mine/mine',
    text: '我的',
    iconPath: '/assets/icons/tab-mine.png',
    selectedIconPath: '/assets/icons/tab-mine-active.png',
    iconSvg: 'user'
  }
]

const parentTabs = [
  {
    pagePath: '/pages/parent/index/index',
    text: '首页',
    iconSvg: 'home'
  },
  {
    pagePath: '/pages/parent/schedule/schedule',
    text: '课表',
    iconSvg: 'calendar'
  },
  {
    pagePath: '/pages/parent/feedback-list/feedback-list',
    text: '反馈',
    iconSvg: 'message'
  },
  {
    pagePath: '/pages/parent/mine/mine',
    text: '我的',
    iconSvg: 'user'
  }
]

// SVG 图标路径定义
const iconPaths = {
  home: 'M3 12l9-9 9 9M5 10v10a1 1 0 001 1h12a1 1 0 001-1V10',
  homeActive: 'M3 12l9-9 9 9M5 10v10a1 1 0 001 1h12a1 1 0 001-1V10',
  calendar: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z',
  calendarActive: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z',
  users: 'M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-2a4 4 0 10-8 0 4 4 0 008 0zm6 0a3 3 0 11-6 0 3 3 0 016 0z',
  usersActive: 'M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-2a4 4 0 10-8 0 4 4 0 008 0zm6 0a3 3 0 11-6 0 3 3 0 016 0z',
  message: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4-.8L3 20l1.3-3.9A7.96 7.96 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
  messageActive: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4-.8L3 20l1.3-3.9A7.96 7.96 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
  user: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  userActive: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z'
}

Component({
  data: {
    selected: 0,
    role: 'teacher',
    tabs: [],
    iconPaths
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

    // 切换 Tab
    switchTab(e) {
      const index = e.currentTarget.dataset.index
      const tab = this.data.tabs[index]
      if (!tab) return

      this.setData({ selected: index })
      wx.switchTab({ url: tab.pagePath })
    },

    // 由页面调用，更新选中状态
    updateSelected(index) {
      this.setData({ selected: index })
    }
  }
})
