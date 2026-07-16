# Frame review

- [x] Same face and eye color in all 73 frames
- [x] Same seven-head body ratio and foot baseline
- [x] Same jacket, star, belt, gloves, shorts, and boots
- [x] Full body visible in every frame
- [x] Full sword visible only in approved weapon states
- [x] Left and right movement are authored correctly
- [x] Transparent edges are clean
- [x] No frame-to-frame scale jumps

## Review evidence

- Full native contact sheet: `work/frame-review/contact-sheet.png`
- Representative sequence at 224 px: `work/frame-review/representative-224.png`
- Representative sequence at 80 px: `work/frame-review/representative-80.png`
- Reproduce the contact sheet and all 9 states at 80, 113, and 224 px with `npm run capture:evidence`.
- Reproduce the complete 73-frame native/224/80 galleries and before/after metrics with `npm run capture:quality`.
- Production frames come only from the approved 900–1750 px master/key-pose sources, render on a 768 × 832 intermediate cell, and downsample once to 192 × 208 with Lanczos3.
- Automated preview coverage verifies each state's configured sprite row, final frame, and frame wrap.
- All state sequences contain unique files and visible pose/translation/rotation/gaze changes.
- Chroma QA: zero green-dominant residual pixels and all four corner samples transparent in all 73 frames.
- Native alpha QA: every occupied bound retains at least 4 fully transparent pixels on all four sides.
