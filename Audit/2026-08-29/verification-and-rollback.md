# 校验、回归与回滚方案

## 清理前备份

- 权威远端：`origin/main`。
- 清理前提交：`c13f8dcbcbf2`。
- 所有审计在独立分支 `codex/safe-redundancy-cleanup-20260829` 和独立工作树进行。
- 推送前创建轻量备份 tag 指向清理前提交；不 force push。

## 必跑校验

```bash
npm ci
npm run typecheck
npx tsc --noEmit --noUnusedLocals --noUnusedParameters
npm test
npm run validate:pet
npm run build:pet
npm run test:e2e
git diff --check
```

## 2026-08-29 实测结果

- `npm run typecheck`：通过。
- `npx tsc --noEmit --noUnusedLocals --noUnusedParameters`：通过，零未使用诊断。
- `npm test`：11 个测试文件、62 个测试全部通过。
- `npm run validate:pet`：73 frames valid；0 errors。
- `npm run build:pet`：通过。
- `npm run test:e2e`：5 个 Playwright 测试全部通过。
- `git diff --check`：通过。
- `git diff --exit-code HEAD -- src scripts preview tests install.sh package*.json tsconfig.json vitest.config.ts playwright.config.ts`：通过，业务源码/测试/配置逐字节无变更。

## 功能回归清单

1. 73 个 PNG 路径、尺寸、格式、alpha 全部有效。
2. 8×11 无损 WebP 合成位置和透明空格不变。
3. manifest 四字段严格一致。
4. build 的执行顺序、目的路径和构建后复验不变。
5. install 的 CODEX_HOME/home fallback、slug 隔离、staging、backup、失败恢复不变。
6. 九种状态、武器规则、16 个方向、160ms 节拍、reduced-motion 不变。
7. 80/113/224px 页面尺寸、背景网格映射和无横向溢出不变。
8. 73 帧唯一性、四像素透明边界、偏绿/透明 RGB QA 不变。
9. ASAR original/patched/partial/unexpected 分类、whole/header/block hash 校验不变。
10. running-app 拒绝、签名/Gatekeeper 信任门、stage/apply/restore 和失败回滚不变。
11. 不运行安装命令、不修改 `/Applications/ChatGPT.app`、不启动/重启 Codex。

## 回滚

若审计文档提交后需要整体撤回：

```bash
git revert <审计提交哈希>
git push origin main
```

若尚未推送，仅删除隔离分支/工作树即可；主分支始终保留在清理前基线。严禁使用 `git reset --hard` 或 force push。

## 完整清理后源码

本轮确认删除项为零，因此清理后全部源码与基线 `c13f8dcbcbf2` 的业务源码逐字节相同。完整目录结构和全部源码由该 Git 提交及本仓库工作树提供，不在报告中复制二进制资源或重复粘贴 216 个文件。
