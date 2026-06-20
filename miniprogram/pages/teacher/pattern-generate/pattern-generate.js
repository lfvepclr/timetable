// pages/teacher/pattern-generate/pattern-generate.js - 批量生成排课
const { db, _, query } = require('../../../utils/db')
const { callFn } = require('../../../utils/cloud')
const { formatDate, addDays } = require('../../../utils/date')

Page({
  data: {
    patterns: [],
    selectedPatterns: {},
    endDate: '',
    previewing: false,
    previewResult: null,
    generating: false,
    generated: false
  },

  async onLoad() {
    const defaultEnd = formatDate(addDays(new Date(), 90))
    this.setData({ endDate: defaultEnd })
    await this.loadPatterns()
  },

  async loadPatterns() {
    try {
      const patterns = await query('weekly_patterns', { status: 'active' }, {
        orderBy: ['day_of_week', 'asc'],
        pageSize: 50
      })
      this.setData({ patterns })
    } catch (err) {
      console.error('加载模板失败:', err)
    }
  },

  togglePattern(e) {
    const id = e.currentTarget.dataset.id
    const selected = { ...this.data.selectedPatterns }
    selected[id] = !selected[id]
    this.setData({ selectedPatterns: selected, previewResult: null })
  },

  onEndDateChange(e) {
    this.setData({ endDate: e.detail.value, previewResult: null })
  },

  async preview() {
    const ids = Object.keys(this.data.selectedPatterns).filter(k => this.data.selectedPatterns[k])
    if (ids.length === 0) {
      wx.showToast({ title: '请选择模板', icon: 'none' })
      return
    }
    if (!this.data.endDate) {
      wx.showToast({ title: '请设截止日期', icon: 'none' })
      return
    }

    this.setData({ previewing: true })
    wx.showLoading({ title: '预览中...' })

    try {
      const result = await callFn('generateSchedule', {
        pattern_ids: ids,
        end_date: this.data.endDate,
        preview_only: true
      })
      wx.hideLoading()
      this.setData({ previewResult: result, previewing: false })
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: err.message || '预览失败', icon: 'none' })
      this.setData({ previewing: false })
    }
  },

  async generate() {
    const ids = Object.keys(this.data.selectedPatterns).filter(k => this.data.selectedPatterns[k])
    if (ids.length === 0) return

    this.setData({ generating: true })
    wx.showLoading({ title: '生成中...' })

    try {
      const result = await callFn('generateSchedule', {
        pattern_ids: ids,
        end_date: this.data.endDate,
        preview_only: false
      })
      wx.hideLoading()
      this.setData({ generating: false, generated: true })
      wx.showToast({ title: `已生成${result.inserted}节`, icon: 'success' })
      setTimeout(() => wx.navigateBack(), 1500)
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: err.message || '生成失败', icon: 'none' })
      this.setData({ generating: false })
    }
  },

  goToCreatePattern() {
    wx.navigateTo({ url: '../pattern-edit/pattern-edit' })
  }
})
