# Native Pet 448px patch

This repository contains a version-pinned patcher for Codex `26.707.72221`.
It extends the floating Pet range from 80–224px to 80–448px without changing
packed file sizes. The patcher updates all renderer/main-process limits,
recomputes ASAR file/block integrity, and updates `ElectronAsarIntegrity`.

Commands:

```sh
npm run patch:native-pet -- analyze --app /Applications/ChatGPT.app
npm run patch:native-pet -- stage --app /Applications/ChatGPT.app
npm run patch:native-pet -- verify --app /path/to/ChatGPT-patched.app
npm run patch:native-pet -- apply --app /Applications/ChatGPT.app
npm run patch:native-pet -- restore --app /Applications/ChatGPT.app
```

`apply` intentionally refuses to mutate the notarized live app unless a safe
OpenAI-equivalent signing path exists. An ad-hoc signature would lose the
official Developer ID/notarization trust chain and may affect updates or
keychain access. `restore` never quits ChatGPT and refuses while it is running.

Official Codex updates replace `app.asar`. Re-run `analyze` after an update;
the patcher rejects every version or exact source/hash combination it has not
been tested against.
