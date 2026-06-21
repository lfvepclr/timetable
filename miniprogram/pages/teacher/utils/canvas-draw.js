// pages/teacher/utils/canvas-draw.js - Canvas 绘图工具（反馈卡片生成）

/**
 * 文本自动换行
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} text
 * @param {number} maxWidth
 * @param {number} lineHeight
 * @returns {Array} 行数组
 */
function wrapText(ctx, text, maxWidth, lineHeight) {
  const lines = []
  let currentLine = ''

  for (let i = 0; i < text.length; i++) {
    const testLine = currentLine + text[i]
    if (ctx.measureText(testLine).width > maxWidth && currentLine) {
      lines.push(currentLine)
      currentLine = text[i]
    } else {
      currentLine = testLine
    }
  }
  if (currentLine) {
    lines.push(currentLine)
  }
  return lines
}

/**
 * 绘制多行文本
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} text
 * @param {number} x
 * @param {number} y
 * @param {number} maxWidth
 * @param {number} lineHeight
 * @param {number} maxLines 最大行数
 * @returns {number} 绘制后的 y 坐标
 */
function drawText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
  const lines = wrapText(ctx, text, maxWidth, lineHeight)
  const drawLines = maxLines ? lines.slice(0, maxLines) : lines

  drawLines.forEach((line, i) => {
    // 最后一行如果被截断，加省略号
    let drawLine = line
    if (maxLines && i === maxLines - 1 && lines.length > maxLines) {
      while (ctx.measureText(drawLine + '...').width > maxWidth && drawLine.length > 0) {
        drawLine = drawLine.slice(0, -1)
      }
      drawLine += '...'
    }
    ctx.fillText(drawLine, x, y + i * lineHeight)
  })

  return y + drawLines.length * lineHeight
}

/**
 * 绘制圆角矩形
 */
function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + width - radius, y)
  ctx.arcTo(x + width, y, x + width, y + radius, radius)
  ctx.lineTo(x + width, y + height - radius)
  ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius)
  ctx.lineTo(x + radius, y + height)
  ctx.arcTo(x, y + height, x, y + height - radius, radius)
  ctx.lineTo(x, y + radius)
  ctx.arcTo(x, y, x + radius, y, radius)
  ctx.closePath()
}

/**
 * 绘制圆角图片
 */
function drawRoundImage(ctx, image, x, y, width, height, radius) {
  ctx.save()
  roundRect(ctx, x, y, width, height, radius)
  ctx.clip()
  ctx.drawImage(image, x, y, width, height)
  ctx.restore()
}

/**
 * 绘制反馈卡片
 * @param {object} canvas canvas节点
 * @param {object} ctx 2D上下文
 * @param {number} dpr 设备像素比
 * @param {object} data 反馈数据 { studentName, courseName, date, content, performance, homework, teacherComment, photos[], teacherName, qrImage }
 * @param {object} images 已加载的图片对象
 */
function drawFeedbackCard(canvas, ctx, dpr, data, images) {
  const W = 375
  const H = 720
  const padding = 32

  // 设置画布尺寸
  canvas.width = W * dpr
  canvas.height = H * dpr
  ctx.scale(dpr, dpr)

  // 1. 背景渐变
  const bgGradient = ctx.createLinearGradient(0, 0, 0, H)
  bgGradient.addColorStop(0, '#F7F9FC')
  bgGradient.addColorStop(1, '#FFFFFF')
  ctx.fillStyle = bgGradient
  ctx.fillRect(0, 0, W, H)

  // 2. 顶部品牌色渐变区域
  const headerGradient = ctx.createLinearGradient(0, 0, W, 0)
  headerGradient.addColorStop(0, '#5B7CF9')
  headerGradient.addColorStop(1, '#8BA4FB')
  ctx.fillStyle = headerGradient
  roundRect(ctx, padding, 24, W - padding * 2, 120, 16)
  ctx.fill()

  // 3. 顶部日期
  ctx.fillStyle = 'rgba(255,255,255,0.8)'
  ctx.font = '13px sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText(data.date || '', padding + 24, 56)

  // 4. 课程名称
  ctx.fillStyle = '#FFFFFF'
  ctx.font = 'bold 20px sans-serif'
  ctx.fillText(data.courseName || '', padding + 24, 88)

  // 5. 学生姓名
  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  ctx.font = '14px sans-serif'
  ctx.fillText(data.studentName || '', padding + 24, 116)

  // 6. 内容区域起点
  let y = 176

  // 绘制各区块
  const sections = [
    { title: '今日所学', content: data.content, icon: 'book' },
    { title: '课堂表现', content: data.performance, icon: 'star' },
    { title: '课后作业', content: data.homework, icon: 'edit' },
    { title: '老师评语', content: data.teacherComment, icon: 'heart' }
  ]

  sections.forEach(section => {
    if (!section.content) return

    // 区块标题
    ctx.fillStyle = '#5B7CF9'
    ctx.font = 'bold 15px sans-serif'
    ctx.fillText(section.title, padding, y)
    y += 24

    // 区块内容
    ctx.fillStyle = '#374151'
    ctx.font = '13px sans-serif'
    y = drawText(ctx, section.content, padding, y, W - padding * 2, 22, 4)
    y += 16

    // 分隔线
    ctx.strokeStyle = '#E5E7EB'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(padding, y)
    ctx.lineTo(W - padding, y)
    ctx.stroke()
    y += 20
  })

  // 7. 课堂照片
  if (images && images.photos && images.photos.length > 0) {
    const photoSize = (W - padding * 2 - 16) / 3
    images.photos.slice(0, 3).forEach((img, i) => {
      const px = padding + i * (photoSize + 8)
      drawRoundImage(ctx, img, px, y, photoSize, photoSize, 8)
    })
    y += photoSize + 24
  }

  // 8. 底部老师署名 + 小程序码
  const footerY = H - 80
  ctx.fillStyle = '#6B7280'
  ctx.font = '12px sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText(`授课老师：${data.teacherName || ''}`, padding, footerY)

  if (images && images.qr) {
    const qrSize = 56
    drawRoundImage(ctx, images.qr, W - padding - qrSize, footerY - qrSize + 12, qrSize, qrSize, 8)
    ctx.textAlign = 'right'
    ctx.fillStyle = '#9CA3AF'
    ctx.font = '10px sans-serif'
    ctx.fillText('扫码体验', W - padding, footerY + 24)
  }
}

/**
 * 加载图片（返回 Promise）
 */
function loadImage(canvas, src) {
  return new Promise((resolve, reject) => {
    const img = canvas.createImage()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

module.exports = {
  wrapText,
  drawText,
  roundRect,
  drawRoundImage,
  drawFeedbackCard,
  loadImage
}
