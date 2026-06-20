# 添加 README.md 并推送到 GitHub

## Context
课外排课小程序已完整实现（171个文件，含15个老师端页面、6个家长端页面、2个公共页面、8个组件、11个云函数、9个工具函数）。项目尚未初始化 Git，需要创建 README.md 文档、.gitignore 文件，然后初始化仓库并推送到 `https://github.com/lfvepclr/timetable.git`。

## Tasks

### Task 1: 创建 .gitignore
- 路径: `/Users/spencer/workspace/qoder/timetable/.gitignore`
- 内容: 微信小程序+云开发的标准忽略规则
  - `node_modules/`
  - `miniprogram_npm/`
  - `.DS_Store`
  - `project.private.config.json`
  - `cloudfunctions/*/node_modules/`
  - 云开发本地缓存等

### Task 2: 创建 README.md
- 路径: `/Users/spencer/workspace/qoder/timetable/README.md`
- 内容包含:
  - 项目名称与简介
  - 功能特性列表（排课/预付费/反馈/家长绑定/节假日等）
  - 技术栈（微信原生+云开发）
  - 项目结构说明
  - 快速开始（导入微信开发者工具、配置云环境、创建数据库集合）
  - 云函数部署说明
  - 部署前需替换的配置项清单

### Task 3: Git 初始化与推送
执行命令:
```bash
cd /Users/spencer/workspace/qoder/timetable
git init
git add .
git commit -m "feat: 课外排课小程序完整实现

- 老师端15页面+家长端6页面+2公共页面
- 8个公共组件+11个云函数+9个工具函数
- 支持周模式排课/预付费消耗/课后反馈/家长绑定/节假日管理"
git remote add origin https://github.com/lfvepclr/timetable.git
git branch -M main
git push -u origin main
```

## 验证
- `git status` 显示 clean
- `git remote -v` 显示 origin 指向目标仓库
- GitHub 上可看到完整代码
