// pages/teacher/course-edit/course-edit.js - 课程创建/编辑
const { _, query, add, update, getById } = require('../../../utils/api')
const { COURSE_COLORS, COURSE_TYPE_CONFIG, DURATION_OPTIONS } = require('../../../utils/constants')

Page({
  data: {
    isEdit: false,
    courseId: '',
    form: {
      name: '',
      type: '1v1',
      max_students: 1,
      default_duration: 120,
      color: '#5B7CF9',
      active: true
    },
    colors: COURSE_COLORS,
    courseTypes: Object.keys(COURSE_TYPE_CONFIG).map(k => ({
      value: k,
      label: COURSE_TYPE_CONFIG[k].label,
      maxStudents: COURSE_TYPE_CONFIG[k].maxStudents
    })),
    durations: DURATION_OPTIONS,
    selectedTypeIndex: 0,
    selectedDurationIndex: 1,
    saving: false
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ isEdit: true, courseId: options.id })
      wx.setNavigationBarTitle({ title: '编辑课程' })
      this.loadCourse(options.id)
    } else {
      wx.setNavigationBarTitle({ title: '新建课程' })
    }
  },

  async loadCourse(id) {
    try {
      const course = await getById('courses', id)
      if (course) {
        const typeIndex = this.data.courseTypes.findIndex(t => t.value === course.type)
        const durIndex = this.data.durations.findIndex(d => d.value === course.default_duration)
        this.setData({
          form: {
            name: course.name || '',
            type: course.type || '1v1',
            max_students: course.max_students || 1,
            default_duration: course.default_duration || 120,
            color: course.color || '#5B7CF9',
            active: course.active !== false
          },
          selectedTypeIndex: typeIndex >= 0 ? typeIndex : 0,
          selectedDurationIndex: durIndex >= 0 ? durIndex : 1
        })
      }
    } catch (err) {
      console.error('加载课程失败:', err)
    }
  },

  onNameInput(e) {
    this.setData({ 'form.name': e.detail.value })
  },

  onTypeChange(e) {
    const index = e.detail.value
    const typeInfo = this.data.courseTypes[index]
    if (typeInfo) {
      this.setData({
        selectedTypeIndex: index,
        'form.type': typeInfo.value,
        'form.max_students': typeInfo.maxStudents
      })
    }
  },

  onDurationChange(e) {
    const index = e.detail.value
    const duration = this.data.durations[index]
    if (duration) {
      this.setData({
        selectedDurationIndex: index,
        'form.default_duration': duration.value
      })
    }
  },

  onColorChange(e) {
    this.setData({ 'form.color': e.currentTarget.dataset.color })
  },

  async save() {
    const { name, type } = this.data.form
    if (!name || !name.trim()) {
      wx.showToast({ title: '请输入课程名称', icon: 'none' })
      return
    }
    if (!type) {
      wx.showToast({ title: '请选择课程类型', icon: 'none' })
      return
    }

    this.setData({ saving: true })
    wx.showLoading({ title: '保存中...' })

    try {
      const data = {
        ...this.data.form,
        name: name.trim(),
        updated_at: Date.now()
      }

      if (this.data.isEdit) {
        await update('courses', this.data.courseId, data)
      } else {
        data.created_at = Date.now()
        await add('courses', data)
      }

      wx.hideLoading()
      wx.showToast({ title: '保存成功', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 1000)
    } catch (err) {
      wx.hideLoading()
      console.error('保存课程失败:', err)
      wx.showToast({ title: '保存失败', icon: 'none' })
    } finally {
      this.setData({ saving: false })
    }
  }
})
