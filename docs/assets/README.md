# Approved artwork and facial textures

- `kim-ajae-original.png`: exact byte-for-byte copy of the user-uploaded repository file `2b00a0d8-191f-4885-9bb0-b69c95f599fe.png` (1086×1448 RGBA). The uploaded file remains unchanged at repository root.
- `face-talk-blink.png`: image-edit-derived texture for speaking and closed eyes, based on the approved PNG. Only eye and mouth masks are sampled by the renderer.
- `face-smile/laugh/angry/surprised/sigh/focus/exhale.png`: expression texture candidates edited from the same approved source. Only the bounded brow, eye and mouth masks are used; their body, glasses and head outlines are never rendered.

The default neutral canvas is drawn directly from the approved original. Generated face textures are **derived artwork**, not claims of exact pixel identity. Registration and feathered masks are defined in `public/avatar.js`. The rig never replaces the original head, glasses, nose, beard outline, gray tracksuit or crossed arms with generated versions. The small mouth stage compresses only the mouth texture; it does not stretch the whole face.

No separate arm or prop art has been supplied. All five special reaction buttons remain present but disabled. To enable them faithfully, supply transparent source layers with a clean torso behind the crossed arms, separate left/right arms and hands, plus keyboard/slam hands, cup/drinking hand, gamepad/gripping hands, raised arms, and face-covering hand. Use the same 1086×1448 registration or document matching anchors.
