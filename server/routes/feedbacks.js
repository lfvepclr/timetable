// routes/feedbacks.js — 课后反馈 upsert
const express = require('express')
const router = express.Router()
const db = require('../lib/db')
const { authMiddleware } = require('../lib/auth')

router.use(authMiddleware)

// POST /api/feedbacks/upsert — 保存/更新反馈
router.post('/upsert', (req, res) => {
  try {
    const openid = req.auth.openid
    const {
      lesson_id, student_id,
      content, performance, homework, teacher_comment,
      photos,
    } = req.body

    if (!lesson_id || !student_id) {
      return res.json({ code: -1, message: '缺少必要参数' })
    }

    const lessonRow = db.get('SELECT * FROM lessons WHERE id = ?', lesson_id)
    if (!lessonRow) return res.json({ code: -1, message: '课程不存在' })
    const lesson = db.parseRow('lessons', lessonRow)

    const now = Date.now()
    const existingRow = db.get(
      'SELECT * FROM feedbacks WHERE lesson_id = ? AND student_id = ?',
      lesson_id, student_id
    )

    let feedbackId
    if (existingRow) {
      // 更新
      const existing = db.parseRow('feedbacks', existingRow)
      feedbackId = existing.id
      db.run(
        `UPDATE feedbacks SET content = ?, performance = ?, homework = ?, teacher_comment = ?, photos = ?, updated_at = ? WHERE id = ?`,
        content || '', performance || '', homework || '', teacher_comment || '',
        JSON.stringify(photos || []), now, feedbackId
      )
    } else {
      // 新建
      feedbackId = db.uuid()
      db.run(
        `INSERT INTO feedbacks (id, lesson_id, student_id, course_id, course_name, lesson_date,
          content, performance, homework, teacher_comment, photos, card_image_url, teacher_openid, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        feedbackId, lesson_id, student_id,
        lesson.course_id || null, lesson.course_name || null, lesson.date,
        content || '', performance || '', homework || '', teacher_comment || '',
        JSON.stringify(photos || []), '', openid, now, now
      )

      // 更新课程中的 feedback_id
      db.run(`UPDATE lessons SET feedback_id = ?, updated_at = ? WHERE id = ?`, feedbackId, now, lesson_id)
    }

    res.json({ code: 0, data: { feedback_id: feedbackId } })
  } catch (err) {
    console.error('[feedbacks/upsert] 错误:', err)
    res.json({ code: -1, message: err.message })
  }
})

module.exports = router
