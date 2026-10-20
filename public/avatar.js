// The approved PNG is always the base. Only feathered eye/brow/mouth regions use edited textures.
export const expressionNames = {
  neutral: "기본 무표정",
  smile: "피식 웃음",
  laugh: "크게 웃음",
  angry: "화남",
  surprised: "당황",
  sigh: "어이없음",
  focus: "집중",
  exhale: "한숨",
};
export const reactionNames = {
  slam: "키보드 슬램",
  coffee: "커피 마시기",
  gamepad: "게임패드",
  cheer: "환호",
  facepalm: "얼굴 가리기",
};
export const unavailableReactions = new Set(Object.keys(reactionNames));
// Existing facial textures remain in their source coordinates. These affine maps
// register each small region to the seated original, without touching hands or props.
export const seatedFaceRegistration = {
  mouth: [0.902527, -0.005892, 0.012531, 0.908202, 31.767902, 17.744303],
  leftEye: [0.910888, -0.007072, 0.01595, 0.906931, 25.340935, 20.645081],
  rightEye: [0.924868, -0.015335, 0.011947, 0.916835, 19.872063, 20.844062],
  leftBrow: [0.933044, -0.01394, 0.031617, 0.952566, 10.74503, 6.921513],
  rightBrow: [0.909239, -0.030333, 0.005732, 0.930016, 31.200042, 25.475858],
  laughMouth: [0.902527, -0.005892, 0.012531, 0.908202, 31.767902, 17.744303],
};
const W = 1086,
  H = 1448;
const regions = {
  mouth: {
    rect: [411, 600, 213, 145],
    polygon: [
      [431, 628],
      [450, 612],
      [577, 611],
      [606, 649],
      [599, 705],
      [568, 728],
      [466, 728],
      [422, 692],
    ],
  },
  laughMouth: {
    rect: [374, 558, 303, 189],
    polygon: [
      [399, 603],
      [432, 566],
      [644, 566],
      [668, 607],
      [654, 701],
      [610, 736],
      [446, 736],
      [384, 664],
    ],
  },
  leftEye: {
    rect: [298, 428, 150, 105],
    polygon: [
      [311, 449],
      [429, 435],
      [439, 478],
      [420, 512],
      [322, 519],
      [307, 493],
    ],
  },
  rightEye: {
    rect: [538, 397, 168, 110],
    polygon: [
      [551, 418],
      [678, 404],
      [694, 438],
      [678, 481],
      [571, 495],
      [550, 463],
    ],
  },
  leftBrow: {
    rect: [283, 305, 174, 108],
    polygon: [
      [299, 333],
      [424, 318],
      [451, 378],
      [433, 406],
      [295, 406],
    ],
  },
  rightBrow: {
    rect: [493, 278, 226, 141],
    polygon: [
      [505, 302],
      [695, 291],
      [715, 369],
      [550, 392],
      [508, 413],
    ],
  },
};
function loadImage(name) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(Error("캐릭터 자산을 불러오지 못했습니다: " + name));
    image.src = new URL("./assets/" + name, import.meta.url).href;
  });
}
export function createAvatar(mount) {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  canvas.className = "avatar portrait-avatar";
  canvas.setAttribute("role", "img");
  canvas.setAttribute(
    "aria-label",
    "원본 김씨 아재: 검정 뿔테안경과 회색 삼선 츄리닝, 책상 앞에서 키보드와 마우스를 잡고 앉은 모습",
  );
  mount.replaceChildren(canvas);
  const ctx = canvas.getContext("2d", { alpha: true });
  let original,
    talk,
    expression = "neutral",
    mouth = 0,
    blink = false,
    disposed = false,
    blinkTimer;
  const faces = new Map(),
    patches = new Map();
  function patch(image, key, small = false) {
    const cacheKey = image.src + "|" + key + "|" + small;
    if (patches.has(cacheKey)) return patches.get(cacheKey);
    const {
      rect: [x, y, w, h],
      polygon,
    } = regions[key];
    const layer = document.createElement("canvas");
    layer.width = w;
    layer.height = h;
    const c = layer.getContext("2d");
    if (small) {
      c.translate(-x, 636 - y);
      c.scale(1, 0.55);
      c.drawImage(image, 0, -630, W, H);
    } else c.drawImage(image, -x, -y, W, H);
    const mask = document.createElement("canvas");
    mask.width = w;
    mask.height = h;
    const m = mask.getContext("2d");
    m.filter = "blur(2px)";
    m.beginPath();
    (small
      ? [
          [436, 630],
          [454, 622],
          [575, 622],
          [594, 644],
          [590, 675],
          [567, 692],
          [457, 692],
          [429, 667],
        ]
      : polygon
    ).forEach(([px, py], i) =>
      i ? m.lineTo(px - x, py - y) : m.moveTo(px - x, py - y),
    );
    m.closePath();
    m.fill();
    c.resetTransform();
    c.globalCompositeOperation = "destination-in";
    c.drawImage(mask, 0, 0);
    patches.set(cacheKey, layer);
    return layer;
  }
  function drawPatch(image, key, small = false) {
    const [x, y] = regions[key].rect;
    ctx.save();
    ctx.transform(...seatedFaceRegistration[key]);
    ctx.drawImage(patch(image, key, small), x, y);
    ctx.restore();
  }
  function draw() {
    if (!original || disposed) return;
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(original, 0, 0, W, H);
    const face = faces.get(expression);
    if (face) {
      for (const key of [
        "leftBrow",
        "rightBrow",
        "leftEye",
        "rightEye",
        "mouth",
      ])
        drawPatch(
          face,
          key === "mouth" && expression === "laugh" ? "laughMouth" : key,
        );
    }
    if (talk && blink && expression !== "laugh") {
      drawPatch(talk, "leftEye");
      drawPatch(talk, "rightEye");
    }
    const speaking = expression === "laugh" ? 0 : mouth;
    if (talk && speaking) drawPatch(talk, "mouth", speaking === 1);
    canvas.dataset.expression = expression;
    canvas.dataset.mouth = String(mouth);
    canvas.dataset.blink = String(blink);
  }
  function scheduleBlink() {
    blinkTimer = setTimeout(
      () => {
        if (disposed) return;
        blink = true;
        draw();
        blinkTimer = setTimeout(() => {
          blink = false;
          draw();
          scheduleBlink();
        }, 125);
      },
      3300 + Math.random() * 3500,
    );
  }
  const expressionLoads = [
    "laugh",
    "smile",
    "angry",
    "surprised",
    "sigh",
    "focus",
    "exhale",
  ].map((key) =>
    loadImage("face-" + key + ".png").then((image) => {
      faces.set(key, image);
      draw();
    }),
  );
  const ready = Promise.all([
    ...expressionLoads,
    loadImage("kim-ajae-seated-original.png").then((image) => {
      original = image;
      draw();
    }),
    loadImage("face-talk-blink.png").then((image) => {
      talk = image;
    }),
  ])
    .then(() => {
      canvas.dataset.ready = "true";
      draw();
      scheduleBlink();
    })
    .catch((error) => {
      mount.dataset.error = error.message;
      canvas.setAttribute("aria-label", error.message);
      throw error;
    });
  ready.catch(() => {});

  return {
    ready,
    update(state) {
      expression =
        state.expression in expressionNames ? state.expression : "neutral";
      mouth = Math.max(0, Math.min(2, Math.round(state.mouth || 0)));
      draw();
    },
    dispose() {
      disposed = true;
      clearTimeout(blinkTimer);
    },
  };
}
