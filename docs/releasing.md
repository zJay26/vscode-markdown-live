# 发布与更新

## 给 Agent 的指令

完成功能修改后，可以直接说：

> 请完成相关测试，更新版本号和 CHANGELOG，提交更改、推送远端，并发布 Markdown Live 的新版本到现有 VS Code Marketplace 扩展。核对商店可安装版本与源码提交；需要登录或验证码时再叫我。

固定身份为 `zJay.markdown-live-zjay`。只调整 `displayName`、介绍或图标不需要更换扩展身份。不要为每次更新重新创建扩展、改 `publisher` 或改 `name`。

## 哪个文件控制什么

| 内容 | 文件 |
| --- | --- |
| 商店名称、短介绍、图标、版本号 | `package.json` |
| Marketplace 详细介绍 | `README.md` |
| 英文介绍 | `README.en.md` |
| 功能动图与录制说明 | `docs/demo/` |
| 版本更新记录 | `CHANGELOG.md` |
| 验证范围与结果 | `VALIDATION.md` |

商店正文来自已发布 VSIX 中的 README。只推送 GitHub 不会同步更新商店正文或扩展代码；修改这些内容后，也应递增版本并重新发布。图片使用公开 HTTPS 地址，重要发布宜固定到已推送提交，避免图片与已发布正文脱节。

## 一次发布的顺序

1. 检查工作区状态与其他聊天的改动，确认准备发布的范围。
2. 完成功能修改和适当验证；更新 `CHANGELOG.md`，用 `npm version patch --no-git-tag-version` 等命令同步 `package.json` 与锁文件版本。
3. 运行 `npm run typecheck`、`npm test`。界面或编辑行为变化时运行 `npm run test:e2e`；涉及宿主、保存或打包资源时运行对应宿主与安装包测试。记录实际范围。
4. 提交并推送到 `https://github.com/zJay26/vscode-markdown-live`，核对远端提交和 CI。保证 README 图片已经公开可访问。
5. 运行 `npm run package`，生成 `artifacts/markdown-live-zjay-<版本>.vsix`。在隔离配置下验证最终安装包，记录 SHA-256。打包后不要再修改它声称对应的源码。
6. 在 [Publisher 管理页](https://marketplace.visualstudio.com/manage/publishers/zjay) 对现有扩展选择 **Update** 并上传该 VSIX；如已配置发布凭据，也可使用 `vsce publish --packagePath <该文件>`。沿用现有登录方式；不要把令牌写入仓库或聊天。
7. 等待 Marketplace 校验完成，核对 [公开页面](https://marketplace.visualstudio.com/items?itemName=zJay.markdown-live-zjay) 的版本、名称、图标和介绍图片，并在隔离配置中从商店安装验证。上传成功或 Verifying 不等于已经公开发布。

## 本地如何更新

首次从旧本地扩展迁移时，安装 `zJay.markdown-live-zjay`，再卸载 `markdown-live-local.markdown-live`，避免相同命令出现两份。Windows 与 Remote WSL 各自有扩展安装位置，需要分别迁移。命令 ID 和 `markdownLive.*` 设置键保留，原有文档仍是普通 Markdown。

完成迁移后，保持 VS Code 的扩展自动更新开启即可接收商店版本，也可在扩展页面手动选择更新。更新下载、应用和当前窗口重新载入可能不是同一时刻；以扩展详情中的已安装版本为准。如果有未保存的文件，先保存再按 VS Code 提示重新载入。

官方说明：[扩展发布](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)、[扩展安装与自动更新](https://code.visualstudio.com/docs/configure/extensions/extension-marketplace)。
