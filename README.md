# 课外排课助手

专为课外辅导老师（单人，非机构）打造的微信小程序排课管理工具。支持周模式批量排课、预付费课时管理、课后反馈生成与分享、家长绑定查看等核心功能。

## 功能特性

### 老师端
- **今日课表**：当日课程概览 + 近期课程 + 快捷操作入口
- **课表视图**：周/日视图切换，无课时段自动折叠，课程色块区分
- **学生管理**：学生档案 CRUD、搜索、课程包管理、反馈历史
- **周模式排课**：选课程 → 选周几/时段 → 选学生 → 设生效区间 → 批量生成排课（预览 + 确认两阶段）
- **手动排课/补课**：手动排课支持冲突检测；补课可创建新课程或加入同类 1vN 课程
- **课后反馈**：填写上课内容/课堂表现/课后作业/老师评语 + 上传课堂照片
- **反馈卡片**：Canvas 2D 绘制精美反馈卡片，支持保存相册、分享家长、订阅消息通知
- **课程包管理**：预付费 10/20/30 节课，FIFO 消耗策略，事务保证原子性
- **家长绑定**：生成 6 位绑定码 + 小程序码，分享链接给家长扫码绑定
- **假期管理**：内置法定节假日 + 调休数据，支持手动微调、寒暑假配置
- **通知设置**：反馈通知/排课变更/上课提醒/请假通知，订阅消息多节点引导

### 家长端
- **首页**：下一节课信息 + 剩余课时卡片 + 最新反馈预览
- **课表**：孩子课表（周/日视图，时间折叠，只读）
- **反馈列表**：历史反馈倒序卡片式展示，支持照片预览
- **反馈详情**：精美呈现反馈内容 + 课堂照片大图 + 转发分享
- **课时详情**：课程包剩余/消耗统计 + 消耗记录
- **通知设置**：反馈/排课变更/上课提醒开关

### 核心机制
- **节假日感知排课**：调休工作日（is_off_day=false）跳过排课；法定假日正常排课
- **预付费消耗**：同一学生同课程多包按 purchase_date 升序 FIFO 消耗，事务保证原子性
- **请假不消耗**：学生请假 status→on_leave，不消耗课时，时段释放可被他人占用
- **时间折叠**：课表按 start_ts 排序，相邻课程间隔 >30 分钟插入折叠条
- **1vN 灵活请假**：1v1 请假整节释放；1vN 仅释放该生名额，不影响整节课进行

## 技术栈

| 技术 | 说明 |
|------|------|
| 微信小程序原生 | WXML / WXSS / JS / JSON |
| 微信云开发 | 云数据库 + 云函数 + 云存储 |
| 自定义 TabBar | 按角色动态渲染老师/家长两套 Tab |
| 分包加载 | 主包 + teacher 分包 + parent 分包 |
| Canvas 2D API | 反馈卡片绘制（type="2d", dpr 缩放, 文本换行） |
| 云数据库事务 | 课时消耗原子操作 |
| 订阅消息 | 一次性消耗，多节点引导 |
| 小程序码 | getUnlimited 生成绑定码（scene ≤ 32 字符） |

## 项目结构

```
timetable/
├── project.config.json              # 小程序项目配置
├── .gitignore
├── README.md
├── miniprogram/
│   ├── app.js / app.json / app.wxss  # 应用入口（云开发初始化 + 登录鉴权 + 角色判断）
│   ├── sitemap.json
│   ├── custom-tab-bar/               # 自定义底部导航（老师/家长动态切换）
│   ├── components/                    # 8 个公共组件
│   │   ├── status-badge/              # 状态徽章
│   │   ├── lesson-card/               # 课程卡片
│   │   ├── time-fold/                 # 时间折叠容器
│   │   ├── empty-state/               # 空状态占位
│   │   ├── package-bar/               # 课时进度条
│   │   ├── student-tag/               # 学生标签
│   │   ├── confirm-dialog/            # 确认弹窗
│   │   └── photo-uploader/            # 照片上传
│   ├── pages/
│   │   ├── common/                    # 公共页面（主包）
│   │   │   ├── bind/                  # 绑定中转页
│   │   │   └── feedback-share/        # 反馈分享落地页
│   │   ├── teacher/                   # 老师端（分包，15 页面）
│   │   │   ├── index/                 # Tab1 今日课表
│   │   │   ├── schedule/              # Tab2 课表视图
│   │   │   ├── students/              # Tab3 学生管理
│   │   │   ├── mine/                  # Tab4 我的
│   │   │   ├── student-detail/        # 学生详情
│   │   │   ├── lesson-detail/         # 课程详情
│   │   │   ├── lesson-schedule/       # 手动排课/补课
│   │   │   ├── pattern-edit/          # 周模式编辑
│   │   │   ├── pattern-generate/      # 批量生成排课
│   │   │   ├── feedback-edit/         # 写反馈
│   │   │   ├── feedback-card/         # Canvas 反馈卡片
│   │   │   ├── package-manage/        # 课程包管理
│   │   │   ├── bind-generate/         # 生成绑定码
│   │   │   ├── holiday-manage/        # 假期管理
│   │   │   └── settings/              # 通知设置
│   │   └── parent/                    # 家长端（分包，6 页面）
│   │       ├── index/                 # Tab1 首页
│   │       ├── schedule/              # Tab2 课表
│   │       ├── feedback-list/         # Tab3 反馈列表
│   │       ├── mine/                  # Tab4 我的
│   │       ├── feedback-detail/       # 反馈详情
│   │       └── package/               # 课时详情
│   ├── utils/                         # 工具函数
│   │   ├── constants.js               # 全局常量与枚举
│   │   ├── cloud.js                   # 云函数调用封装
│   │   ├── db.js                      # 云数据库操作封装
│   │   ├── date.js                    # 日期处理
│   │   ├── holiday.js                 # 节假日判断逻辑
│   │   ├── schedule.js                # 排课辅助（冲突检测/时间折叠）
│   │   ├── canvas-draw.js             # Canvas 绘图（反馈卡片）
│   │   ├── store.js                   # 轻量状态管理
│   │   └── subscribe.js               # 订阅消息引导
│   └── styles/
│       ├── variables.wxss             # CSS 变量定义
│       └── mixins.wxss                # 混入样式
└── cloudfunctions/
    ├── login/                         # 登录鉴权 + 角色判断
    ├── generateSchedule/              # 周模式批量生成排课（核心）
    ├── checkSlotConflict/             # 时段冲突检测
    ├── completeLesson/                # 事务消耗课时（核心）
    ├── saveFeedback/                  # 保存课后反馈
    ├── requestLeave/                  # 学生请假
    ├── rescheduleLesson/              # 补课重排
    ├── generateBindCode/              # 生成绑定码 + 小程序码
    ├── bindStudent/                   # 家长绑定学生
    ├── sendNotification/              # 发送订阅消息
    ├── syncHolidays/                  # 同步法定节假日
    │   ├── index.js
    │   ├── holidays-2025.json         # 2025 年节假日数据
    │   └── package.json
    └── common/                        # 共享模块（参考模板）
        ├── db.js
        ├── auth.js
        └── notify.js
```

## 数据模型（11 个集合）

| 集合 | 用途 | 关键字段 |
|------|------|----------|
| `users` | 用户（老师/家长） | openid, role, name, student_ids[] |
| `students` | 学生档案 | name, grade, school, notes, active |
| `bindings` | 家长-学生绑定 | student_id, parent_openid, relationship, status |
| `courses` | 课程类型 | name, type(1v1/1v2/1v3/class), max_students, default_duration, color |
| `packages` | 预付费课程包 | student_id, course_id, total_lessons, consumed_lessons, remaining, status |
| `weekly_patterns` | 周模式模板 | course_id, day_of_week, start_time, end_time, student_ids[], valid_from, valid_until |
| `lessons` | 排课实例（核心） | date, start_ts, end_ts, students[{student_id,status}], lesson_status, pattern_id, feedback_id |
| `feedbacks` | 课后反馈 | lesson_id, student_id, content, performance, homework, teacher_comment, photos[], card_image_url |
| `holidays` | 节假日/调休 | date(唯一), name, is_off_day, year, source(builtin/manual) |
| `vacations` | 暑假/寒假段 | type(summer/winter), year, start_date, end_date |
| `bind_codes` | 绑定邀请码 | code(6位), student_id, status(pending/used/expired), expire_at |

## 快速开始

### 1. 导入项目

1. 打开 **微信开发者工具**
2. 选择「导入项目」
3. 项目目录指向本仓库根目录
4. AppID 填入你的小程序 AppID

### 2. 开通云开发

1. 在开发者工具中点击「云开发」按钮开通
2. 创建云环境，记下**环境 ID**
3. 在 `miniprogram/app.js` 中将 `cloudEnv` 替换为你的环境 ID：
   ```js
   cloudEnv: 'your-env-id'
   ```

### 3. 创建数据库集合

在云开发控制台创建以下 11 个集合：

```
users, students, bindings, courses, packages, weekly_patterns,
lessons, feedbacks, holidays, vacations, bind_codes
```

**权限规则**：所有集合设置为「仅创建者可读写」（老师端通过云函数操作保证数据一致性）。

### 4. 部署云函数

右键 `cloudfunctions/` 下每个文件夹，选择「上传并部署：云端安装依赖」。共 11 个云函数：

```
login, generateSchedule, checkSlotConflict, completeLesson,
saveFeedback, requestLeave, rescheduleLesson, generateBindCode,
bindStudent, sendNotification, syncHolidays
```

### 5. 同步节假日数据

部署 `syncHolidays` 后，在开发者工具云开发面板手动触发一次，或在小程序「我的」页面点击「同步法定节假日」。

### 6. 配置老师身份

在 `cloudfunctions/login/index.js` 中，将老师 openid 配置到环境变量 `TEACHER_OPENID`，或在云函数中硬编码。

## 部署前需替换的配置

| 文件 | 配置项 | 说明 |
|------|--------|------|
| `miniprogram/app.js` | `cloudEnv` | 替换为实际云开发环境 ID |
| `miniprogram/utils/constants.js` | `SUBSCRIBE_TEMPLATES` | 替换为小程序后台配置的订阅消息模板 ID |
| `cloudfunctions/login/index.js` | 老师 openid | 通过环境变量或硬编码配置 |
| `cloudfunctions/sendNotification/index.js` | `templateId` | 替换为实际订阅消息模板 ID |

## 云函数说明

| 云函数 | 职责 |
|--------|------|
| `login` | code2Session 获取 openid，创建/判定用户角色 |
| `generateSchedule` | 周模式批量生成排课，跳过调休工作日，预览+确认两阶段 |
| `checkSlotConflict` | 时段冲突检测（排除 cancelled 与 on_leave 学生） |
| `requestLeave` | 学生请假，更新 status=on_leave，时段释放 |
| `rescheduleLesson` | 补课重排到空段或加入同类 1vN 课程 |
| `completeLesson` | 事务：标记下课，FIFO 消耗课时，支持回退 |
| `saveFeedback` | 保存反馈（上课内容/表现/作业/评语/照片） |
| `generateBindCode` | 生成 6 位码 + 小程序码（getUnlimited） |
| `bindStudent` | 家长扫码/点链接进入，校验码→自动绑定（每学生 ≤2 家长） |
| `sendNotification` | 发订阅消息（反馈/排课变更/上课提醒/请假通知） |
| `syncHolidays` | 导入内置节假日 JSON，不覆盖 manual 记录 |

## License

MIT
