# 清理无用组件 + 修复 custom-tab-bar 双导航栏

## Context

用户反馈底部出现多个导航栏（tab bar）。经排查，根因是 `custom-tab-bar/index.wxml` 存在**重复内容**：第1-4行是新的 TDesign `t-tab-bar` 实现，第5-24行是旧的 SVG 自定义 tab-bar（Write 工具追加旧代码的老问题），两者同时渲染。`index.wxss` 同样有重复的旧样式。

此外，上一轮已放弃 Skyline 改用原生导航栏，但 `components/custom-navbar/` 组件目录仍残留（4个文件），13个页面 JS 中仍残留 `navHeight`/`navBar` 死代码，`app.json` 中 `t-avatar` 全局注册已不再使用（已替换为原生 view+text）。

## Task 1: 修复 custom-tab-bar 重复内容（根因）

**文件**：
- `miniprogram/custom-tab-bar/index.wxml` — 删除第5-24行旧 SVG tab-bar，仅保留第1-4行 TDesign 实现
- `miniprogram/custom-tab-bar/index.wxss` — 删除第9-74行旧样式，仅保留第1-8行 `.tab-bar-root` 样式
- `miniprogram/custom-tab-bar/index.json` — 添加 `t-tab-bar` 和 `t-tab-bar-item` 到 usingComponents（确保 `lazyCodeLoading: "requiredComponents"` 下正确加载）

## Task 2: 删除 custom-navbar 组件

**删除目录**：`miniprogram/components/custom-navbar/`（index.js、index.json、index.wxml、index.wxss）

确认：无任何 WXML/JSON 文件引用该组件（grep 验证通过）。

## Task 3: 清理 app.json 无用全局组件

**文件**：`miniprogram/app.json`
- 从 `usingComponents` 移除 `"t-avatar"` 行（已替换为原生 view+text，0处引用）

## Task 4: 清理 navBar/navHeight 死代码

`navHeight` 在 0 个 WXML 中使用，纯死代码。涉及 14 个文件：

- `miniprogram/app.js` — 移除 globalData.navBar 初始值（第11行）和 onLaunch 中 navBar 尺寸计算代码块（第24-38行）
- `miniprogram/pages/teacher/index/index.js` — 移除 data.navHeight（第12行）和 onLoad 中 navBar 获取（第37-38行）
- `miniprogram/pages/teacher/students/students.js` — 移除 data.navHeight + onLoad navBar
- `miniprogram/pages/teacher/student-detail/student-detail.js` — 同上
- `miniprogram/pages/teacher/schedule/schedule.js` — 同上
- `miniprogram/pages/teacher/mine/mine.js` — 同上
- `miniprogram/pages/teacher/lesson-detail/lesson-detail.js` — 同上
- `miniprogram/pages/teacher/feedback-edit/feedback-edit.js` — 同上
- `miniprogram/pages/teacher/feedback-card/feedback-card.js` — 同上
- `miniprogram/pages/teacher/bind-generate/bind-generate.js` — 同上
- `miniprogram/pages/teacher/settings/settings.js` — 同上
- `miniprogram/pages/parent/index/index.js` — 移除 data.navHeight
- `miniprogram/pages/parent/mine/mine.js` — 同上
- `miniprogram/pages/common/feedback-share/index.js` — 同上

## 验证

1. 微信开发者工具编译成功，无报错
2. 底部仅显示一个 TDesign tab-bar（不再有重复）
3. 所有页面正常渲染，导航栏行为正常
4. 控制台无组件找不到的警告
