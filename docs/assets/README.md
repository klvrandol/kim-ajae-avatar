# Seated default pose

`kim-ajae-seated-original.png` is the byte-identical runtime copy of the user-uploaded root file `kim-ajae-seated-original.png.png` (1086×1448 RGBA). The root upload is preserved. It is the default in both server and Pages modes. Hands, desk, keyboard, mouse and chair are always taken directly from this new original.

Existing facial textures below are retained. `seatedFaceRegistration` in `public/avatar.js` maps each source eye, eyebrow and mouth patch onto the corresponding region of the new seated face. These are affine coordinate mappings, not a redraw of the original. No complete old portrait or old body is composited into the new pose. The neutral/closed-mouth state is pixel-identical to the seated source. The old crossed-arm original stays archived; it is not the default.

# Approved artwork and facial textures

- `kim-ajae-original.png`: exact byte-for-byte copy of the user-uploaded repository file `2b00a0d8-191f-4885-9bb0-b69c95f599fe.png` (1086×1448 RGBA). The uploaded file remains unchanged at repository root.
- `face-talk-blink.png`: image-edit-derived texture for speaking and closed eyes, based on the approved PNG. Only eye and mouth masks are sampled by the renderer.
- `face-smile/laugh/angry/surprised/sigh/focus/exhale.png`: expression texture candidates edited from the same approved source. Only the bounded brow, eye and mouth masks are used; their body, glasses and head outlines are never rendered.

The default neutral canvas is now drawn directly from the seated original. Generated face textures are **derived artwork**, not claims of exact pixel identity. Registration and feathered masks are defined in `public/avatar.js`. The rig never replaces the original head, glasses, nose, beard outline, gray tracksuit, seated arms or desk props with generated versions. The small mouth stage compresses only the mouth texture; it does not stretch the whole face.

The uploaded full keyboard slam pose is available and enabled. The other four reaction buttons remain disabled. To enable those faithfully, supply transparent source layers with a clean torso and desk behind the seated arms, separate left/right arms and hands, plus cup/drinking hand, gamepad/gripping hands, raised arms, and face-covering hand. Use the same 1086×1448 registration or document matching anchors.

## Keyboard slam

`kim-ajae-keyboard-slam.png` is a byte-identical copy of the user upload at repository root (1374×1145 RGBA). No generated or replacement art is used. A shared 1448×1448 transparent frame holds the seated portrait at x=181 and the complete slam texture at x=-340, y=-111.4, uniform scale 1.32. The slam desk bottom is anchored to y=1400; the head is aligned with the seated head in size and vertical position. The landscape PNG extends outside the frame; the peripheral left mouse/desk/effect area is clipped, while the head, punching fist and keyboard remain visible. CSS preserves the prior seated portrait's visible size. The leaning head and punching arm motion belong to the uploaded pose itself. Previously, fitting the full landscape image at scale 1.05 made the head smaller and lower. The canvas and the normal pose are unchanged; only the slam camera framing changed.

During the 1200ms reaction, facial patches and blink rendering are suspended. The microphone continues analysing so the current mouth stage can resume on return. The selected expression is held and buttons are temporarily disabled. A new trigger restarts the duration; repeated state broadcasts do not. Expired reaction timestamps do not replay on reconnect. Coffee/gamepad/cheer/facepalm still need separate approved art.
