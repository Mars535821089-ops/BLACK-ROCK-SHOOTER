# 项目理解总结

审计基线：`c13f8dcbcbf2`。本报告覆盖该提交的全部 216 个已跟踪文件；完整清单见 `tracked-project-tree.md`。

## 1. 整体用途

项目交付一个名为 `BLACK★ROCK SHOOTER` 的 Codex 自定义 Pet。生产交付是 Sprite v2：8×11 网格、单格 192×208、精灵表 1536×2288、73 个有效动画帧，官方显示范围 80/113/224px。角色按 idle、左右奔跑、挥手、跳跃、失败、等待、运行、审阅九种状态和 16 个视线方向切换动画。

项目同时保留一个与生产交付隔离的、固定 Codex 版本的 448px 原生补丁取证实验。该实验只能生成并检查暂存 app；由于签名/公证信任链限制，`live-safe` 门不满足时必须拒绝修改正在使用的应用。

## 2. 文件分类

- 业务源码：`src/*.ts`。
- 命令与离线处理：`scripts/*`、`install.sh`、`package.json` scripts。
- 预览前端：`preview/index.html`、`preview/main.ts`。
- 配置：`package.json`、`package-lock.json`、`tsconfig.json`、`vitest.config.ts`、`playwright.config.ts`、`.gitignore`。
- 测试：`tests/*.test.ts`、`tests/preview.spec.ts`，全程只读未修改。
- 静态资源：`assets/master`、`assets/key-poses`、`assets/frames`、`assets/references`。
- 可安装产物：`dist/blueflame/pet.json`、`dist/blueflame/spritesheet.webp`。
- 验证证据：`work/frame-review`、`work/preview-evidence`、`work/task-10`。
- 文档/历史记录：`README.md`、`docs/`、`.superpowers/sdd/`、`LICENSE`。
- 第三方代码：仓库不跟踪 vendor/node_modules；第三方依赖由 lockfile 固定。

## 3. 全部程序入口与触发点

1. `tsx src/cli.ts validate|build|install|contact-sheet`
   - 由 `validate:pet`、`build:pet`、`install:pet`、`capture:evidence` 调用。
   - `process.argv[1].endsWith("cli.ts")` 是 ESM CLI 入口保护；测试导入时不会自动执行。
2. `./install.sh`
   - README 的直接安装/Release 安装入口，只复制已构建的 `pet.json` 与 `spritesheet.webp`，有旧版本则先备份。
3. `vite` → `preview/index.html` → `preview/main.ts`
   - `npm run preview` 与 Playwright `webServer` 触发；DOM 事件、定时器和媒体查询驱动预览。
4. `scripts/generate-supersampled-frames.mjs`
   - `npm run render:frames` 触发，离线生成 73 帧。
5. `scripts/create-quality-evidence.mjs`、`compare-frame-quality.mjs`、`analyze-preview-pixels.mjs`
   - 分别由 `capture:baseline`、`capture:quality`、`capture:evidence` 触发。
6. `scripts/native-pet-patcher.ts`
   - `npm run patch:native-pet -- analyze|verify|stage|apply|restore` 触发；调用 macOS 系统工具并适配 `NativePetBundlePatcher`。
7. Vitest/Playwright 测试入口
   - `npm test` 与 `npm run test:e2e`；仅用于验证，未修改。

## 4. 模块与公开符号

- `pet-spec.ts`：`PET_SPEC`、`STATES`、`STATE_NAMES` 定义协议；`cellFor`、`weaponVisibleFor` 提供坐标与武器可见性查询。
- `validate-frame.ts`：`validateFrame` 返回完整错误列表；`assertFrame` 将失败转为带路径异常。
- `assemble-spritesheet.ts`：校验并按状态行/视线方向将帧合成为无损透明 WebP。
- `contact-sheet.ts`：`lookCellFor` 计算视线格；`createContactSheet` 生成审阅 PNG。
- `manifest.ts`：生成并写入严格的 Sprite v2 manifest。
- `install-pet.ts`：使用 staging、校验、备份和 rename 完成原子安装；失败恢复原目标并清理 staging。
- `cli.ts`：解析命令、遍历 73 帧、严格校验构建物并编排构建/安装/证据流程。
- `supersample-frame.ts`：高分辨率源门、alpha 边界计算、4×中间帧降采样与安全透明边缘处理。
- `pixel-qa.ts`：统计占用、偏绿、低 alpha 高亮、透明 RGB 与 alpha 分桶。
- `native-pet-patch.ts`：固定版本/哈希/目标字符串，检查 ASAR 状态，执行等长替换，更新文件及分块完整性，备份/恢复关键 bundle 文件。
- `native-pet-bundle.ts`：验证 original/patched-staged/live-safe 三种信任状态，执行 stage/apply/restore 及整包交换失败回滚。

## 5. 数据流

### 生产帧与安装

`assets/master + assets/key-poses` → 去绿溢色/裁边/旋转/叠加 → 768×832 中间帧 → Lanczos3 降采样 → `assets/frames` 73 PNG → 几何/alpha 校验 → 无损 `dist/blueflame/spritesheet.webp` + `pet.json` → staging 复验 → `~/.codex/pets/blueflame`。

### 预览与质量证据

`dist/blueflame/spritesheet.webp + PET_SPEC/STATES` → Vite 页面 → 状态/尺寸 DOM 控件 → CSS 背景坐标动画 → Playwright 截图 → pixel QA；另将新旧帧统一缩放到 192/224/80，输出联系表和对比 JSON。

### 原生补丁取证实验

命令行参数 → 检查 app 版本/ASAR 状态/whole hash/header hash/逐文件块完整性/代码签名/Gatekeeper → 复制到暂存 app → 固定等长替换 → 更新 ASAR 与 plist 完整性 → ad-hoc 签名 → 分类为 patched-staged。`apply` 在任何写操作前检查 ChatGPT 未运行且 staged 满足 `live-safe`；不满足则拒绝。交换后失败会恢复 displaced bundle 并复验原模式/哈希。

## 6. 分支、异常与边界

- 缺帧：生产构建抛出精确路径；测试专用 `allowMissingStates` 可跳过。
- 非 PNG、尺寸错误、无 alpha：累积错误；断言入口抛出带路径异常。
- manifest 或 WebP 元数据不严格相等：构建/安装拒绝。
- 安装 slug 可能逃逸目录：正则拒绝；复制、校验、替换失败均清理或回滚。
- reduced-motion：预览固定第一帧；普通模式每 160ms 环绕。
- 高分辨率源小于 384×416或中间帧不是 768×832：拒绝放大/最终化。
- ASAR 目标缺失、替换次数不符、partial/unexpected、头大小变化、块哈希不符：拒绝写入或验证失败。
- App 正在运行：apply/restore 在任何 bundle mutation 前拒绝；未知/腐败状态拒绝。
- 交换失败：分别收集 swap 与 rollback 错误；回滚不完整时抛出 `AggregateError`，不吞错。

## 7. 依赖与外部环境

- Node.js 20+；TypeScript/tsx；Sharp/libvips；Vite；Vitest；Playwright；`@electron/asar`。
- 环境变量：`CODEX_HOME` 控制 Pet 安装根目录；`PLAYWRIGHT_USE_SYSTEM_CHROME=1` 可选择系统 Chrome。
- 文件系统：读取素材/帧/ASAR，写构建物、证据、staging、backup。
- macOS 工具：`codesign`、`spctl`、`plutil`、`PlistBuddy`、`ditto`、`pgrep`。
- 无数据库、无运行时网络请求、无 API Key。
- npm 安装报告已有 1 个 moderate、3 个 high 依赖漏洞；本任务禁止依赖升级或业务变更，因此只列为人工风险，不执行 `npm audit fix`。

## 8. 文本调用关系

```text
package scripts
├─ validate:pet ─> cli.main ─> parseCommand ─> runCommand(validate) ─> validateAll ─> assertFrame ─> validateFrame
├─ build:pet ───> cli.main ─> runCommand(build)
│                 ├─ validateAll
│                 ├─ assembleSpritesheet ─> assertFrame
│                 ├─ writeManifest ─> createManifest
│                 └─ validateBuild ─> createManifest + Sharp metadata
├─ install:pet ─> cli.main ─> runCommand(install) ─> validateBuild ─> installPet ─> validateBuild
├─ capture:evidence ─> createContactSheet + Playwright preview + analyzePixelQa
├─ render:frames ─> generate script ─> assertHighResolutionSource + finalizeSupersampledFrame
├─ capture:quality/baseline ─> evidence scripts ─> STATE_NAMES/STATES + Sharp
└─ patch:native-pet ─> native-pet-patcher.main
   ├─ MacBundleBackend ─> inspectArchive/patchArchiveInPlace/verifyArchiveIntegrity
   └─ runNativePetPatcherCommand ─> NativePetBundlePatcher.verify/stage/apply/restore

preview/index.html ─(string selectors/module entry)─> preview/main.ts
preview/main.ts ─> PET_SPEC + STATE_NAMES + STATES
DOM change/input callbacks ─> play/setSize
play ─> framePosition + window.setInterval callback
```

测试直接引用所有公开业务模块；README/package scripts 直接引用 shell/CLI/质量/补丁入口。公开导出即使只在测试中出现，也按“对外公开 API/预留接口”保护，不以静态调用数判死。

## 9. 审计结论

TypeScript 严格未使用检查为零；全局扫描没有调试断点、恒真/恒假分支、大块注释旧业务代码或可证明无读取变量。所有 console 输出均为 CLI 结果或顶层错误；所有注释均解释安全门、图像算法或动作意图。故本轮没有满足用户删除规则的源码，清理结果是零删除、零业务 diff。
