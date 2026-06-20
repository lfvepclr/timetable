// utils/constants.js - 全局常量与枚举

// 用户角色
const ROLE = {
  TEACHER: 'teacher',
  PARENT: 'parent',
  STUDENT: 'student'
}

// 课程类型
const COURSE_TYPE = {
  ONE_V_ONE: '1v1',
  ONE_V_TWO: '1v2',
  ONE_V_THREE: '1v3',
  CLASS: 'class'
}

// 课程类型配置
const COURSE_TYPE_CONFIG = {
  '1v1': { label: '1对1', maxStudents: 1 },
  '1v2': { label: '1对2', maxStudents: 2 },
  '1v3': { label: '1对3', maxStudents: 3 },
  'class': { label: '班课', maxStudents: 20 }
}

// 课节整体状态
const LESSON_STATUS = {
  SCHEDULED: 'scheduled',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
}

// 学生级状态（课节内）
const STUDENT_STATUS = {
  SCHEDULED: 'scheduled',
  ATTENDED: 'attended',
  ON_LEAVE: 'on_leave'
}

// 排课来源
const LESSON_SOURCE = {
  PATTERN: 'pattern',
  MANUAL: 'manual',
  MAKEUP: 'makeup'
}

// 课程包状态
const PACKAGE_STATUS = {
  ACTIVE: 'active',
  EXHAUSTED: 'exhausted',
  REFUNDED: 'refunded'
}

// 绑定码状态
const BIND_CODE_STATUS = {
  PENDING: 'pending',
  USED: 'used',
  EXPIRED: 'expired'
}

// 周模式状态
const PATTERN_STATUS = {
  ACTIVE: 'active',
  PAUSED: 'paused',
  ARCHIVED: 'archived'
}

// 课程预设颜色
const COURSE_COLORS = [
  '#4A90D9', '#52C4A0', '#FF9F5A', '#A78BFA',
  '#F56C6C', '#36CFC9', '#FFD666', '#FF85C0'
]

// 周几映射
const WEEKDAYS = [
  { value: 1, label: '周一', short: '一' },
  { value: 2, label: '周二', short: '二' },
  { value: 3, label: '周三', short: '三' },
  { value: 4, label: '周四', short: '四' },
  { value: 5, label: '周五', short: '五' },
  { value: 6, label: '周六', short: '六' },
  { value: 7, label: '周日', short: '日' }
]

// 课时包预设选项
const PACKAGE_OPTIONS = [10, 20, 30]

// 默认上课时段范围
const TIME_RANGE = {
  START: 8,   // 8:00
  END: 21,    // 21:00
  DEFAULT_DURATION: 120  // 默认2小时(分钟)
}

// 时长选项（分钟）
const DURATION_OPTIONS = [
  { value: 90, label: '1.5小时' },
  { value: 120, label: '2小时' }
]

// 状态显示配置
const STATUS_DISPLAY = {
  // 课节状态
  scheduled: { label: '待上课', badgeClass: 'badge-blue' },
  completed: { label: '已完成', badgeClass: 'badge-green' },
  cancelled: { label: '已取消', badgeClass: 'badge-gray' },
  // 学生状态
  attended: { label: '已出勤', badgeClass: 'badge-green' },
  on_leave: { label: '请假', badgeClass: 'badge-orange' }
}

// 订阅消息模板ID（需在小程序后台配置后替换）
const SUBSCRIBE_TEMPLATES = {
  FEEDBACK: 'tmpl_feedback_id',
  SCHEDULE_CHANGE: 'tmpl_schedule_change_id',
  CLASS_REMINDER: 'tmpl_class_reminder_id',
  LEAVE_NOTICE: 'tmpl_leave_notice_id'
}

// 假期类型
const VACATION_TYPE = {
  SUMMER: 'summer',
  WINTER: 'winter'
}

module.exports = {
  ROLE,
  COURSE_TYPE,
  COURSE_TYPE_CONFIG,
  LESSON_STATUS,
  STUDENT_STATUS,
  LESSON_SOURCE,
  PACKAGE_STATUS,
  BIND_CODE_STATUS,
  PATTERN_STATUS,
  COURSE_COLORS,
  WEEKDAYS,
  PACKAGE_OPTIONS,
  TIME_RANGE,
  DURATION_OPTIONS,
  STATUS_DISPLAY,
  SUBSCRIBE_TEMPLATES,
  VACATION_TYPE
}
