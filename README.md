# FoundryX FRC 官网

[foundryx.xyz](https://foundryx.xyz/) 的中英文官网。首页在访客选择语言后播放两秒欢迎动画，站内可原地切换语言。内容包含 FRC 介绍、历年成绩、导师、基地、知识库及四类报名和合作表单。

## 本地运行

使用 Node.js 24 LTS（最低 22.13）、npm 和 Python 3.9 或更高版本。在项目根目录运行：

```sh
npm ci
npm run build
npm test
npm run dev
```

打开 [本地开发站](http://127.0.0.1:8879/)。可用 `PORT` 设置端口。开发服务器在 `work/` 创建独立的 SQLite 数据库。

首次构建会从正式站下载缺少的 18 个赛事视频，约 2.23 GB。构建逐个校验 `src/site/media-manifest.json` 中的长度与 SHA-256。已有完整静态站副本时，可离线复用其媒体目录：

```sh
FOUNDRYX_MEDIA_DIR=/path/to/dist/client/assets npm run build
```

欢迎短片、官网图像和字体随源码提供，授权与素材来源见 [ASSET-CREDITS.md](ASSET-CREDITS.md)。

## 源码与验证

| 目录 | 内容 |
| --- | --- |
| `src/site/` | 页面生成、语言字典、导航、咨询表单与共享静态资源 |
| `src/welcome/`、`src/immersive/`、`src/campus/` | 欢迎动画、首页互动和基地楼层模型 |
| `src/components/` | 原始界面组件及授权说明 |
| `src/server/` | 本地预览、腾讯云报名接口及 Worker 适配 |
| `db/`、`drizzle/` | 报名表结构和数据库迁移 |
| `tests/` | 导航兼容、入站流程、表单保存和通知回归 |

`npm test` 使用内存数据库和模拟通知服务，不发送实际邮件。页面检查验证 HTML、资源引用、锚点、文章与问题数量。涉及页面交互的改动还应在浏览器里验证桌面、窄屏、键盘与中英文切换。

## 导出

运行 `python3 src/site/export.py` 可在 `exports/` 生成两个独立 HTML 预览和完整网站 ZIP。独立 HTML 内嵌欢迎动画和首屏素材，正文赛事视频从正式站播放。ZIP 含完整视频，可在解压后的 `FoundryX/` 目录运行 `python3 -m http.server 8000` 浏览静态站。

## 腾讯云运行方式

Nginx 提供 `dist/client/`，兼容无扩展名地址；只把 `/api/inquiries` 转发到回环地址上的 Node 服务，并保留原始 Host。API 以项目内的 `src/server/production.mjs` 为入口，可用 `npm run start:api` 启动。

| 配置 | 用途 |
| --- | --- |
| `FOUNDRYX_PUBLIC_ORIGIN` | 正式来源，例如 `https://foundryx.xyz` |
| `FOUNDRYX_DB_PATH` | 持久化 SQLite 文件的绝对路径，应位于静态目录外 |
| `FOUNDRYX_API_PORT` | 回环监听端口，默认 8885 |
| `FOUNDRYX_ADDITIONAL_ORIGINS` | 可选，逗号分隔的额外来源 |
| `FOUNDRYX_NOTIFICATION_EMAIL` | 可选，表单保存成功后的通知邮箱，通过服务环境注入 |

更新上线前备份变更文件并保留原数据库、配置及旧指纹资源。可用 `GET /api/inquiries` 无写入地确认反向代理及服务可达，预期状态为 405。表单全链路保存测试使用本地数据库。
