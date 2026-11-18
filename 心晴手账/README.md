# 心晴手账 · 情绪与日程管理站

五页面响应式 Web 作业项目：今日概览、心情记录、日程安排、心晴日历、气象报告。
原生 HTML/CSS/JavaScript，无第三方运行依赖；Node.js 提供本机运行和文件自动保存，线上可完全静态部署。

## 数据与代码分离

- **公开代码**：`public/` 及开发、测试、发布文件。
- **本机版个人数据**：双击启动脚本后，自动保存到 `E:\ZeroTier One\data\desktop\records.json`，下次打开自动读取；上一版备份为 `records.json.bak`。数据目录在代码仓库之外，不上传云端。
- **公开网页版个人数据**：各自浏览器 localStorage，键名 `tianqing.records.v1`，不发送到网站服务器。
- **ZeroTier账号版数据**：分享服务中的账号、密码哈希和个人记录保存在 `E:\ZeroTier One\data\accounts`，按账号隔离；同一账号可跨设备读取，不自动导入旧日记。
- **旧版记录**：旧 `data/records.json` 已原样移至服务器 `backups/cleanup-*/archived/tianqing-project/data/records.json`，可手动导入；旧数据接口已移除。
- **备份文件**：使用“数据与备份 → 导出记录”下载 JSON；备份应放在仓库之外。
- **迁移数据**：使用“导入记录”选择旧版 records.json 或导出的备份，确认后替换当前模式的记录。导入前请先导出当前数据。

本机版同一 Windows 用户共享一份本机记录，更换浏览器也能读取，清理浏览器数据不会删除本机文件。网页版每个设备、浏览器、域名的数据独立；同一浏览器配置访问同一站点共用记录。这两种模式无需账号、不自动同步；ZeroTier分享版新增独立账号，详见 [LOGIN.md](LOGIN.md)。各模式记录均未额外加密，请定期备份。完整说明见 [PRIVACY.md](PRIVACY.md)。

## 本地运行

安装 Node.js 20 或更新版本。运行 `npm start` 或双击 `启动心晴.cmd`，打开 http://127.0.0.1:3177 。默认仅本机访问。服务准备好后自动打开页面，重复双击会复用现有服务。

本机版会在首次保存文件前，自动迁移当前浏览器已有的记录（保留浏览器副本）。服务器 `backups/cleanup-*/archived/tianqing-project/data/records.json` 中归档的旧记录和其他浏览器的记录仍可手动导入一次。默认固定使用 `http://localhost:3177`。网页版请保留原先使用的网站地址：`localhost` 与 `127.0.0.1` 属于不同来源，浏览器存储不互通，可通过导出/导入迁移。也可使用任意静态服务器托管 public 文件夹。

## 功能

- 情绪天气、心情强度、标签和日记；一天可记录多条，按时间线展示，可独立修改、删除，并可附带最多3张照片。
- 日程增删改查、完成状态、日期、四象限优先级、时长、时间冲突提示。
- 九种日程分类：学习、工作、生活、运动、娱乐、健康、社交、家庭、其他；支持自定义分类并记住最近8个名称。
- 一句话生成可编辑草稿：支持相对日期、周几、具体日期、中文时间、时长、提前提醒；多条用分号分隔。这是规则解析，不是在线 AI。
- 情绪日历、近7/30天统计、近七天平均强度图、可配置节奏的呼吸引导（支持减少动态效果）。
- 导入/导出记录，手机和电脑布局适配。
- 提醒仅在页面打开时检查，后台可能延迟，不是系统闹钟。

## 发布到 GitHub 与 GitHub Pages

代码上传和网站上线是两步。项目包含 `.github/workflows/pages.yml`，推送代码时只运行测试；手动运行发布工作流时只发布 public 目录；它不需要数据库、API 密钥或个人记录。

1. 在 GitHub 创建空仓库。在此项目目录初始化 Git，默认分支设为 main。
2. `git add .` 后先检查 `git diff --cached --name-only`，确认没有 data、备份、日志或私密配置。不要使用 `git add -f` 添加这些文件。
3. 提交代码，设置你自己的仓库 remote 并推送 main。
4. 在仓库 Settings → Pages → Build and deployment → Source 选择 GitHub Actions。
5. 在 Actions 中运行 Publish website，等待成功。发布地址通常为 `https://用户名.github.io/仓库名/`。

官方说明：https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages

前端资源均使用相对路径，支持仓库子路径。访客首次打开是空白记录，使用时只写入自己的浏览器。托管商可能保存常规访问日志。

`.gitignore` 对 Git 上传生效，对网页手动上传文件不生效；使用网页上传时同样不要选择数据或备份文件。若个人数据曾被提交，需要清理 Git 历史后再公开；删除文件或新增忽略规则不会删除旧提交中的数据。

## 文件结构

- public/index.html：页面入口
- public/style.css：响应式样式
- public/app.js：五个页面与交互
- public/parser.js：一句话日程解析与分类
- public/storage.js：浏览器存储、导入数据校验
- server.js：静态网页、本机文件保存与可选分享账号路由；本机文件模式只监听回环地址
- accounts.js、public/auth.js：独立账号、密码哈希、会话与登录界面
- accounts.test.js、account-client.test.js：账号隔离、安全边界与前端存储模式测试
- desktop-launch.js：等待服务准备好后打开页面，重复启动复用服务
- public/runtime.js、public/data-store.js：按运行配置选择账号文件、本机文件或浏览器存储，静态托管默认浏览器模式
- test.js、privacy.test.js：解析、存储隔离和数据访问边界测试
- .github/workflows/pages.yml：测试并发布 GitHub Pages

## 检查

`npm test` 运行全部测试（包括本机保存、服务重启恢复、会话与写入冲突保护）。个人记录不包含在测试中，测试不读写真实浏览器记录。



数据结构v2的兼容迁移、图片限制、备份位置和验证范围见 [MIGRATION.md](MIGRATION.md)。


- 气象分析：随近7/30天自动总结天气分布、按记录日等权的平均强度、记录覆盖和日程完成情况；前后两个周期各有至少3个记录日才比较变化，分析在当前设备完成。


通过ZeroTier给朋友使用：见 [ZEROTIER.md](ZEROTIER.md)。当前电脑的项目分享脚本和 `E:\ZeroTier One\start.cmd` 共用本机配置的3000端口；未配置本机端口的源码默认3180。个人记录模式仍使用3177端口。分享版需要注册登录，完整使用和迁移说明见 [LOGIN.md](LOGIN.md)。


账号版个人中心：登录后可查看自己的资料、记录统计，编辑昵称、天气头像与简介；原登录用户名保持不变。详见 [LOGIN.md](LOGIN.md)。
