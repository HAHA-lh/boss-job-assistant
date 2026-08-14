# 发布与更新

## GitHub 版本管理

推送到 `main` 会自动运行测试和构建。推送形如 `v0.1.4` 的标签会自动：

1. 安装锁定依赖。
2. 运行测试和生产构建。
3. 校验 Git 标签与 Manifest 版本一致。
4. 生成扩展 ZIP 和 SHA-256 校验文件。
5. 创建 GitHub Release。

发布新版本前，需要同步修改：

- `package.json`
- `package-lock.json`
- `src/manifest.ts`
- `CHANGELOG.md`

运行：

```powershell
npm install --package-lock-only
npm run ci
git add .
git commit -m "release: v0.1.4"
git tag v0.1.4
git push origin main --tags
```

## 开发者模式更新

从 GitHub Release 下载 ZIP，解压到固定目录，然后在 `chrome://extensions` 点击该扩展卡片的“重新加载”。Chrome 不会自动替换已解压扩展目录。

## Chrome 自动更新

普通 Windows/macOS Chrome 的自动更新需要把扩展发布到 Chrome Web Store。发布后，用户从商店安装；以后每次提升 Manifest 版本、上传新 ZIP 并通过审核，Chrome 会自动更新。

GitHub Actions 已负责生成可上传商店的 ZIP。后续接入 Chrome Web Store API 时，需要在 GitHub Actions Secrets 中保存商店项目 ID 和 OAuth 凭据，不能把凭据或扩展签名私钥提交到仓库。

自托管 CRX 自动更新仅适用于受企业策略管理的 Chrome 环境，不适合普通个人 Windows Chrome。
