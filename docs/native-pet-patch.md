# Native Pet 448px patch

This repository contains a version-pinned patcher for Codex `26.707.72221`.
It extends the floating Pet range from 80–224px to 80–448px without changing
packed file sizes. The patcher updates all renderer/main-process limits,
recomputes ASAR file/block integrity, and updates `ElectronAsarIntegrity`.

Commands:

```sh
npm run patch:native-pet -- analyze --app /Applications/ChatGPT.app
npm run patch:native-pet -- verify --mode original --app /Applications/ChatGPT.app
npm run patch:native-pet -- stage --app /Applications/ChatGPT.app
npm run patch:native-pet -- verify --mode patched-staged --app work/task-11/ChatGPT-patched.app
npm run patch:native-pet -- verify --mode live-safe --app work/task-11/ChatGPT-patched.app
npm run patch:native-pet -- apply --app /Applications/ChatGPT.app --staged work/task-11/ChatGPT-patched.app
npm run patch:native-pet -- restore --app /Applications/ChatGPT.app
```

Verification modes are deliberately distinct:

- `original` requires the exact original ASAR/header hashes, independently
  verified target integrity, OpenAI Developer ID authority/team, stapled
  notarization, satisfied designated requirement, and Gatekeeper acceptance.
- `patched-staged` requires the exact patched ASAR/header hashes and accepts
  only the known forensic trust classification: ad-hoc outer signature, valid
  content seal, preserved OpenAI designated requirement not satisfied, and
  Gatekeeper rejection. This mode succeeds but labels the bundle untrusted.
- `live-safe` requires the exact patched content plus the original trusted
  OpenAI signing/Gatekeeper posture.

`apply` runs `live-safe` before any mutation. The current forensic stage fails
that gate, so the notarized live app remains untouched. `restore` never quits
ChatGPT, refuses while it is running, and rolls back whole-bundle swap failures
without hiding rollback errors.

Official Codex updates replace `app.asar`. Re-run `analyze` after an update;
the patcher rejects every version or exact source/hash combination it has not
been tested against.
