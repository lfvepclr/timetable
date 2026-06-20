# 课外排课小程序实现计划

## Context（背景与目标）

一位课外辅导老师（单人，非机构）需要一套排课管理工具，解决以下痛点：
- **排课零散**：上课时间集中在周末/节假日/寒暑假的 1.5~2 小时段，需按"周模式"批量预占时段并排到截止日期
- **预付费管理**：学生预买 10/20/30 节课，每上一次消耗一次，请假不消耗且时段可被他人占用
- **反馈传达**：每节课需写上课内容+反馈，要"拍板好看"并能发给家长，家长可查全部历史反馈与剩余课时
- **多视角课表**：老师看全局课表，家长只看自家孩子；课表需折叠无课时段
- **节假日感知**：排课要避开调休工作日，法定假日正常排课，并支持暑假/寒假规律排课

技术决策（已与用户确认）：**微信云开发** + **反馈精美页面与分享图片卡片都要** + **老师分享绑定链接** + **内置法定日历+手动微调**。

---

## 一、技术架构

```
微信小程序客户端 (WXML/WXSS/JS/JSON + 自定义TabBar + Canvas 2D)
  ├─ 主包: 登录/绑定中转/公共组件/TabBar/工具函数 (≤2MB)
  ├─ teacher 分包: 老师端全部页面
  └─ parent 分包: 家长端全部页面
         │
微信云开发 (CloudBase)
  ├─ 云数据库: 11 个集合
  ├─ 云函数: 12 个
  ├─ 云存储: 反馈图/卡片图/二维码/头像
  └─ 微信开放能力: 订阅消息 / 小程序码 / 分享
```

**关键约束**：云函数单次查询≤100条（分批突破）；小程序码 scene≤32字符（用6位绑定码）；Canvas 2D 必须用 `type="2d"` 且不能 `display:none`；订阅消息一次性消耗需多节点引导。

---

## 二、数据模型（云数据库 11 集合）

| 集合 | 用途 | 关键字段 |
|------|------|----------|
| `users` | 用户(老师/家长/学生) | openid, role, name, student_ids[] |
| `students` | 学生档案 | name, grade, school, notes, tags, active |
| `bindings` | 家长-学生绑定 | student_id, parent_openid, relationship, status |
| `courses` | 课程类型 | name, type(1v1/1v2/1v3/class), max_students, default_duration, color |
| `packages` | 预付费课程包 | student_id, course_id, total_lessons, consumed_lessons, remaining, status |
| `weekly_patterns` | 周模式模板 | course_id, day_of_week, start_time, end_time, student_ids[], valid_from, valid_until |
| `lessons` | 排课实例(核心) | date, start_ts, end_ts, students[{student_id,status,consume_record}], lesson_status, pattern_id, feedback_id |
| `feedbacks` | 课后反馈 | lesson_id, student_id, content, performance, homework, teacher_comment, photos[], card_image_url |
| `holidays` | 节假日/调休 | date(唯一), name, is_off_day, year, source(builtin/manual) |
| `vacations` | 暑假/寒假段 | type(summer/winter), year, start_date, end_date |
| `bind_codes` | 绑定邀请码 | code(6位,唯一), student_id, status(pending/used/expired), expire_at |

**lessons 关键索引**：`date+start_ts`(课表查询)、`students.student_id+date`(学生课程)、`start_ts+end_ts`(冲突检测)。

**核心状态机**：
- `lesson_status`: scheduled → completed / cancelled
- 学生级 `status`: scheduled → attended(消耗课时) / on_leave(不消耗，时段释放)
- 1vN 课中单人请假不影响整节课进行

**消耗策略**：同一学生同课程多包时按 `purchase_date` 升序 FIFO 消耗，事务保证原子性。

---

## 三、云函数（12 个）

| 云函数 | 职责 |
|--------|------|
| `login` | code2Session 获取openid，创建/判定用户角色（老师openid预设于环境变量） |
| `generateSchedule` | **核心**：周模式批量生成排课，跳过调休工作日，预览+确认两阶段，分批写入 |
| `checkSlotConflict` | 时段冲突检测（排除cancelled与on_leave学生） |
| `requestLeave` | 学生请假，更新status=on_leave，时段释放 |
| `rescheduleLesson` | 补课重排到空段或加入同类1vN课程 |
| `completeLesson` | **事务**：标记下课，FIFO消耗课时，记录consume_record |
| `saveFeedback` | 保存反馈（上课内容/表现/作业/评语/照片） |
| `generateBindCode` | 生成6位码+小程序码(getUnlimited)，存云存储 |
| `bindStudent` | 家长扫码/点链接进入，校验码→自动绑定（每学生≤2家长） |
| `sendNotification` | 发订阅消息（反馈/排课变更/上课提醒/请假通知） |
| `syncHolidays` | 导入holiday-cn内置JSON，每年定时同步，不覆盖manual记录 |
| `common`(共享模块) | db封装/auth/notify，供其他云函数引用 |

**节假日判断逻辑（关键）**：`is_off_day=true`(法定假日)→正常排课；`is_off_day=false`(调休工作日)→跳过排课；无记录→正常日按周几判断。

---

## 四、页面结构与路由

### 老师端（`pages/teacher/` 分包，TabBar 4 项）
| 页面 | 说明 | Tab |
|------|------|-----|
| `index/index` | 今日课表+近期课程概览+快捷操作 | Tab1 |
| `schedule/schedule` | 课表视图(周/日，时间折叠) | Tab2 |
| `students/students` | 学生管理(列表/搜索/新增) | Tab3 |
| `mine/mine` | 设置/假期管理/同步节假日 | Tab4 |
| `student-detail` | 基本信息+课程包+课表+反馈历史 | — |
| `lesson-detail` | 学生列表+状态管理(请假/补课/完成) | — |
| `lesson-schedule` | 手动排课(选时段/学生/课程) | — |
| `pattern-edit` | 创建/编辑周模式模板 | — |
| `pattern-generate` | 勾选模板→设截止日→预览→确认生成 | — |
| `feedback-edit` | 写上课内容/表现/作业/评语/照片 | — |
| `feedback-card` | Canvas绘制卡片+预览+保存/分享 | — |
| `package-manage` | 购买/查看/编辑课程包 | — |
| `bind-generate` | 选学生→生成二维码/分享链接 | — |
| `holiday-manage` | 查看/微调节假日+配置暑假寒假 | — |

### 家长端（`pages/parent/` 分包，TabBar 4 项）
| 页面 | 说明 | Tab |
|------|------|-----|
| `index/index` | 下一节课信息+剩余课时卡片+最新反馈预览 | Tab1 |
| `schedule/schedule` | 孩子课表(周/日，时间折叠，只读) | Tab2 |
| `feedback-list/feedback-list` | 历史反馈列表(倒序卡片式) | Tab3 |
| `mine/mine` | 孩子信息/课时详情/通知设置 | Tab4 |
| `feedback-detail` | 精美呈现反馈+照片大图+分享 | — |
| `package` | 剩余课时+消耗记录 | — |

### 公共页面（主包）
- `pages/common/bind` — 绑定中转页（扫码scene/分享code → 自动绑定 → 跳家长首页）
- `pages/common/feedback-share` — 反馈分享落地页

**自定义 TabBar**：`custom-tab-bar` 组件按 `app.globalData.role` 动态渲染老师/家长两套 Tab。

---

## 五、核心业务逻辑

### 5.1 周模式排课生成算法
```
对每个 active pattern，从 max(valid_from, today) 到 end_date 逐日遍历:
  IF 当日.day_of_week == pattern.day_of_week:
    查 holidays: 若 is_off_day=false(调休工作日) → 跳过
    (is_off_day=true 法定假日 → 正常排课; 无记录 → 正常排课)
    查 lessons 检测时段冲突 → 记入 conflicts
    无冲突 → 生成 lesson 实例
preview_only=true 仅返回预览; false 则分批批量写入(每批100条)
```

### 5.2 请假与重排
- 请假：学生 status→on_leave，该生在此时段不再占用（冲突检测排除 on_leave）
- 1v1 请假后整段释放可排他人；1vN 仅释放该生名额
- 补课：选新日期时段 → checkSlotConflict → 无课则建 `source=makeup` 新lesson；有同类1vN空位则加入；冲突则提示

### 5.3 预付费消耗（事务）
老师标记下课 → 遍历 attended 学生 → 查该生该课程 active 课程包按 purchase_date ASC 取首个 → `consumed_lessons+=1, remaining-=1`，remaining=0 则 status=exhausted → 记 consume_record。请假学生不在 attended 列表，不消耗。支持误操作回退。

### 5.4 时间折叠显示
课表按 start_ts 排序，相邻课程间隔>30分钟则插入"折叠条"（24px细条显示"Xh空闲"可点击展开）；≤30分钟正常留白。只显示有课时段，无课时段折叠。

### 5.5 反馈卡片生成（Canvas 2D）
off-screen canvas(`position:absolute;left:-9999px`) → 设 dpr 缩放 → 绘制：背景渐变→日期/课程/学生名→上课内容(自动换行)→表现→作业→照片缩略图(≤3张圆角)→老师名+小程序码 → `canvasToTempFilePath` 导出 → 保存相册/上传云存储/`onShareAppMessage`分享。

### 5.6 家长绑定流程
老师选学生→`generateBindCode`生成6位码+小程序码→老师分享卡片(path携code)或二维码→家长扫码(scene=code)或点链接(code)→`bind`页`onLoad`解析code→`bindStudent`云函数校验(未过期/未绑/≤2家长)→自动绑定→跳家长首页。

---

## 六、操作动线

### 老师排课动线
1. 课程类型管理：定义1v1/1v2/班课+默认时长+颜色
2. 学生管理：新增学生 → 学生详情 → 课程包管理 → 购买10/20/30节
3. 周模式编辑：选课程→选周几→选时段→选学生→设生效区间→保存模板
4. 批量生成：勾选模板→设截止日→预览(生成/跳过/冲突)→确认生成
5. 日常调整：课表→点课程→课程详情→请假/补课/完成

### 老师写反馈动线
今日课表/课表→点已完成课程→课程详情→写反馈→(上课内容/表现/作业/评语/照片)→保存→生成分享卡片(Canvas预览)→保存相册/分享家长→通知家长(订阅消息)

### 家长查看动线
首次扫码/点链接→自动绑定→首页(下节课+剩余课时+最新反馈)→课表Tab(时间折叠只读)→反馈Tab(历史列表→详情精美呈现→可转发)→我的Tab(课时详情/通知设置)

### 请假重排动线
老师/家长发起请假(选学生+原因)→requestLeave→时段释放→老师安排补课→选新时段→冲突检测→建补课lesson→通知家长→补课上课时正常消耗课时(原请假课不消耗)

---

## 七、设计系统（UI/UX）

### 风格定位
教育/效率工具类，**干净专业、温和可信、留白舒适**。遵循微信小程序设计规范，原生组件优先，安全区适配。

### 色彩
- 主色：`#4A90D9`（沉稳蓝，信任感）用于主操作/选中态/TabBar
- 辅助：`#52C4A0`（薄荷绿）用于成功/已完成/课时进度
- 强调：`#FF9F5A`（暖橙）用于提醒/请假/待办
- 警示：`#F56C6C` 用于取消/冲突
- 中性：背景 `#F7F8FA`、卡片 `#FFFFFF`、正文 `#1F2937`、次要 `#6B7280`、边框 `#E5E7EB`
- 课程色：每种课程类型可配独立颜色，课表色块区分

### 字体
- 标题：`36rpx / font-weight:600`
- 正文：`28rpx / #1F2937`
- 辅助：`24rpx / #6B7280`
- 数字（课时）：`48rpx / 600` 突出剩余课时

### 组件规范
- **卡片**：`border-radius:16rpx; box-shadow:0 4rpx 16rpx rgba(0,0,0,0.06)`
- **课程色块**：左侧 6rpx 竖条标识课程颜色
- **状态徽章**：圆角胶囊，scheduled蓝/completed绿/on_leave橙/cancelled灰
- **课时进度条**：渐变填充 + 剩余/总数标注
- **折叠条**：24rpx 高，居中文字，可点击展开
- **图标**：统一 SVG 图标集（自绘或 iconfont），禁用 emoji
- **点击反馈**：`hover-class` 透明度变化，150-300ms 过渡
- **间距**：卡片间距 24rpx，内边距 32rpx

### 反馈卡片视觉
- 顶部品牌色渐变背景 + 日期/课程名/学生名大字
- 分区块呈现：今日所学/课堂表现/课后作业/老师评语
- 课堂照片圆角缩略图（≤3张）
- 底部老师署名 + 小程序码（引流）
- 整体留白充足，信息层级清晰

---

## 八、目录结构

```
timetable/
├── project.config.json
├── miniprogram/
│   ├── app.js / app.json / app.wxss / sitemap.json
│   ├── custom-tab-bar/ (index.js/json/wxml/wxss)
│   ├── components/ (lesson-card, time-fold, student-tag, status-badge,
│   │                package-bar, empty-state, confirm-dialog, photo-uploader)
│   ├── pages/
│   │   ├── common/ (bind, feedback-share)
│   │   ├── teacher/ (index, schedule, students, mine, student-detail,
│   │   │             lesson-detail, lesson-schedule, pattern-edit,
│   │   │             pattern-generate, feedback-edit, feedback-card,
│   │   │             package-manage, bind-generate, holiday-manage, settings)
│   │   └── parent/ (index, schedule, feedback-list, mine, feedback-detail, package)
│   ├── utils/ (cloud, db, date, holiday, schedule, canvas-draw, store, subscribe, constants)
│   └── styles/ (variables.wxss, mixins.wxss)
├── cloudfunctions/
│   ├── login, generateSchedule, checkSlotConflict, requestLeave,
│   │   rescheduleLesson, completeLesson, saveFeedback, generateBindCode,
│   │   bindStudent, sendNotification, syncHolidays
│   └── common/ (db, auth, notify 共享模块)
└── docs/ (api, data-model, deploy)
```

`app.json` 配置主包(2页)+teacher分包(15页)+parent分包(6页)+`custom-tab-bar`+`cloud:true`。

---

## 九、微信能力使用

| 能力 | 用途 |
|------|------|
| 订阅消息 | 反馈通知/排课变更/上课提醒/请假通知；多节点引导订阅应对一次性消耗 |
| 小程序码 | `getUnlimited`生成绑定码(scene=6位code) |
| 分享 | `onShareAppMessage`(反馈卡片imageUrl=Canvas图/绑定链接path携code) + `onShareTimeline` |
| 云存储 | 反馈照片`feedbacks/{id}/`、卡片图`cards/{id}.png`、二维码`bind_qr/{code}.png` |
| Canvas 2D | 反馈卡片绘制(type="2d", dpr缩放, 文本换行, 图片异步加载) |

**权限规则**：所有写操作经云函数（保证鉴权+一致性）；前端仅读。users 仅自身可读写；lessons/feedbacks/packages 老师读全部、家长读已绑定学生。

---

## 十、实施优先级

**P0 地基**（先跑通骨架）
- `project.config.json` + `app.json` 分包配置 + `app.js` 登录角色判断
- `login` 云函数 + `custom-tab-bar` 动态TabBar
- 创建全部 11 个数据库集合 + 权限规则
- `syncHolidays` 导入节假日数据

**P1 排课核心**（主价值链）
- `generateSchedule` + `pattern-edit` + `pattern-generate`（周模式→预览→生成）
- `schedule` 课表页（时间折叠组件 `time-fold`）
- `completeLesson`（事务消耗课时）+ `lesson-detail`（请假/补课/完成）
- `students` 学生管理 + `package-manage` 课程包

**P2 反馈与家长端**
- `feedback-edit` + `feedback-card`（Canvas卡片生成/保存/分享）
- `generateBindCode` + `bindStudent` + `bind` 绑定流程
- 家长端 6 页（首页/课表/反馈列表/反馈详情/课时/我的）
- `sendNotification` 订阅消息

**P3 完善**
- `holiday-manage` 假期管理 + 暑假/寒假配置
- `requestLeave`/`rescheduleLesson` 请假重排完整链路
- 性能优化（冗余字段/分页/缓存）+ 订阅消息引导策略

---

## 十一、验证方式

1. **微信开发者工具**：导入项目，开启云开发本地调试，编译预览
2. **排课链路**：老师登录→建课程→建学生→买课包→建周模式→批量生成→课表查看（验证时间折叠+节假日跳过）
3. **消耗链路**：标记下课→确认课时-1→请假学生不消耗→误操作回退恢复
4. **请假重排**：学生请假→时段可排他人→补课到空段→补课上课消耗
5. **反馈链路**：写反馈→生成Canvas卡片→保存相册→分享→家长端查看详情
6. **绑定链路**：老师生成码→家长扫码→自动绑定→家长看到孩子课表/反馈/课时
7. **真机预览**：扫码体验完整流程，验证订阅消息接收与安全区适配

---

## 关键文件清单（实施时创建）

- `miniprogram/app.json`（分包+TabBar+cloud配置）
- `miniprogram/app.js`（登录+角色判断+全局数据）
- `miniprogram/custom-tab-bar/index.*`（动态TabBar）
- `miniprogram/utils/constants.js`（状态枚举/颜色/配置）
- `miniprogram/utils/schedule.js`（冲突检测/时间折叠算法）
- `miniprogram/utils/canvas-draw.js`（卡片绘制/文本换行）
- `cloudfunctions/generateSchedule/index.js`（周模式批量生成核心）
- `cloudfunctions/completeLesson/index.js`（事务消耗课时）
- `cloudfunctions/bindStudent/index.js`（家长绑定）
- `cloudfunctions/syncHolidays/index.js` + `holidays-2025.json`（节假日数据）
