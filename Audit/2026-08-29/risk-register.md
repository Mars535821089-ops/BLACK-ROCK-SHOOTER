# 冗余风险分级清单

## 【确认可安全移除】

无。

判定依据：全仓阅读、入口映射、测试合同、package/README 触发点、动态边界扫描与 `tsc --noUnusedLocals --noUnusedParameters` 交叉后，没有任何业务源码同时满足“全局无调用、无外部入口、无动态触发、非公开 API、非配置/常量、非异常兜底”的全部条件。

## 【高度疑似冗余，人工复核】

### `src/native-pet-patch.ts:307-338`

片段：`assertExpectedVersion`、`backupBundleFiles`、`restoreBundleFiles`。

理由：当前生产 CLI 的版本验证由 `NativePetBundlePatcher.verify` 完成，整包流程由 `MacBundleBackend.copyBundle` 处理；这三个导出目前主要由测试直接调用，未接入当前 `scripts/native-pet-patcher.ts` 主路径。

保留理由：它们是公开导出，承担版本门和关键文件级备份/恢复的预留安全接口，且用户明确禁止删除公开 API、异常/回滚逻辑和预留扩展接口。禁止自动删除。

### `.superpowers/sdd/` 与 `work/` 历史报告/验证证据

片段：任务 7/8/10/11 与 final-fixes 报告、前后对比图片/JSON。

理由：不参与运行时执行，体积较大，表面上可能被误判为冗余。

保留理由：它们是可审核、可复现实验与回滚证据，不属于“业务源码内部冗余代码”；用户本次只允许清理业务源码。禁止自动删除。

## 【不可判定，禁止改动】

- `preview/index.html` 的 id/class/data-testid/ARIA 与 `preview/main.ts`/Playwright 的字符串选择器：模板/字符串动态引用。
- `preview/main.ts` 的 DOM 事件、`setInterval`、`matchMedia` 回调：浏览器框架回调。
- `src/cli.ts` 的 `process.argv`、`process.env`、依赖注入对象和 CLI 自执行保护：配置/运行时驱动。
- `scripts/*.mjs` 的顶层 await、process.argv、数组回调和文件约定：命令/配置驱动。
- `scripts/native-pet-patcher.ts` 的系统命令输出解析与 `BundleBackend` 方法：外部进程/接口回调。
- `src/native-pet-patch.ts` 的 `PATCH_TARGETS`、哈希、版本、替换次数与 ASAR 路径：安全配置和字符串驱动。
- `src/native-pet-bundle.ts` 的信任分类、catch/finally、rollback 与 `AggregateError`：安全门和异常兜底。
- 所有 `tests/`：用户明确禁止修改。
- `install.sh`：README 公开的独立用户入口，不是 TypeScript 安装器的无调用副本。

## 非代码风险（不在本次修改范围）

- `npm ci` 报告 4 个依赖漏洞（1 moderate、3 high）及废弃依赖警告。依赖升级可能改变 lockfile/运行行为，不属于冗余清理，未执行自动修复。
- 原生 448px 补丁固定于 Codex `26.707.72221`；官方更新后必须重新 analyze，当前代码按未知版本拒绝。
