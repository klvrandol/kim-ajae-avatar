import {
  createAvatar,
  expressionNames,
  reactionNames,
  unavailableReactions,
} from "./avatar.js?pose=seated-v1";
import { mouthFromLevel, createMouthTracker } from "./audio.js";
const $ = (s) => document.querySelector(s);
const staticMode = window.KIM_AJAE_STATIC === true;
const overlay =
  location.pathname === "/avatar" ||
  new URLSearchParams(location.search).get("overlay") === "1";
let avatar;
if (overlay) {
  document.documentElement.classList.add("overlay");
  const stage = document.createElement("div");
  stage.id = "overlay-stage";
  document.body.append(stage);
  avatar = createAvatar(stage);
} else avatar = createAvatar($("#avatar-mount"));
avatar.ready.catch((error) => {
  if (!overlay) $("#mic-status").textContent = error.message;
});
let state = { expression: "neutral", mouth: 0 };
let lastReceived = 0;
function receive(next) {
  lastReceived = Date.now();
  state = next;
  avatar.update(state);
  if (!overlay) {
    $("#expression-label").textContent = expressionNames[state.expression];
    document.querySelectorAll("button[data-expression]").forEach((b) => {
      const active = b.dataset.expression === state.expression;
      b.classList.toggle("active", active);
      b.setAttribute("aria-pressed", String(active));
    });
  }
}
const channel =
  staticMode && typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel("kim-ajae-pages-v1")
    : null;
const events = staticMode ? null : new EventSource("/events");
if (events) events.onmessage = (e) => receive(JSON.parse(e.data));
if (channel) {
  channel.onmessage = (e) => {
    if (e.data.type === "request") {
      channel.postMessage({ type: "state", state });
    } else if (e.data.type === "state") receive(e.data.state);
  };
  channel.postMessage({ type: "request" });
}
receive(state);
// Stop stale lip movements when a controller closes or disconnects.
setInterval(() => {
  if (Date.now() - lastReceived > 800 && state.mouth) {
    state.mouth = 0;
    avatar.update(state);
  }
}, 300);
async function send(patch) {
  if (staticMode) {
    const next = { ...state, ...patch };
    if ("reaction" in patch) next.reactionAt = Date.now();
    receive(next);
    channel?.postMessage({ type: "state", state: next });
    return;
  }
  const res = await fetch("/state", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw Error("상태 전달 실패");
}
if (!overlay || staticMode) {
  const faces = ["😐", "😏", "😆", "😠", "😳", "😑", "🧐", "😮‍💨"];
  Object.entries(expressionNames).forEach(([key, label], i) => {
    const button = document.createElement("button");
    button.dataset.expression = key;
    button.title = `${label} (${i + 1})`;
    button.innerHTML = `<span class="face-icon">${faces[i]}</span><span>${label}</span><kbd>${i + 1}</kbd>`;
    button.onclick = () => send({ expression: key }).catch(report);
    $("#expressions").append(button);
  });
  const keys = ["q", "w", "e", "r", "t"],
    icons = ["⌨", "☕", "🎮", "🙌", "🫣"];
  Object.entries(reactionNames).forEach(([key, label], i) => {
    const button = document.createElement("button");
    button.dataset.reaction = key;
    button.innerHTML = `<span>${icons[i]} ${label}</span><kbd>${keys[i].toUpperCase()}</kbd>`;
    button.disabled = unavailableReactions.has(key);
    button.title = "원본 스타일의 팔·소품 파츠가 필요합니다";
    button.onclick = () => send({ reaction: key }).catch(report);
    $("#reactions").append(button);
  });
  document.addEventListener("keydown", (e) => {
    if (
      e.repeat ||
      e.ctrlKey ||
      e.metaKey ||
      e.altKey ||
      ["INPUT", "SELECT", "TEXTAREA", "BUTTON"].includes(e.target.tagName)
    )
      return;
    const index = Number(e.key) - 1;
    if (index >= 0 && index < 8)
      send({ expression: Object.keys(expressionNames)[index] }).catch(report);
    const r = keys.indexOf(e.key.toLowerCase());
    if (r >= 0) toast("이 리액션은 원본 스타일의 팔·소품 이미지가 필요합니다.");
  });
  let stream,
    context,
    analyser,
    audioTimer,
    active = false,
    pending = false,
    lastSent = 0,
    starting = false,
    demoTimer;
  for (const id of ["sensitivity", "strength"]) {
    try {
      const saved = localStorage.getItem(id);
      if (saved !== null && Number(saved) > 0) $("#" + id).value = saved;
    } catch {}
    const update = () => {
      $("#" + id + "-value").value = Number($("#" + id).value).toFixed(1) + "×";
      try {
        localStorage.setItem(id, $("#" + id).value);
      } catch {}
    };
    $("#" + id).oninput = update;
    update();
  }
  async function devices() {
    if (!navigator.mediaDevices) return;
    const list = await navigator.mediaDevices.enumerateDevices();
    const value = $("#device").value;
    $("#device").replaceChildren(new Option("시스템 기본 마이크", ""));
    list
      .filter((d) => d.kind === "audioinput")
      .forEach((d, i) =>
        $("#device").add(new Option(d.label || `마이크 ${i + 1}`, d.deviceId)),
      );
    $("#device").value = value;
  }
  function status(message) {
    $("#mic-status").textContent = message;
  }
  function stop() {
    active = false;
    clearInterval(audioTimer);
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    context?.close().catch(() => {});
    context = null;
    $("#mic-toggle").textContent = "마이크 켜기";
    $("#mic-badge").textContent = "OFF";
    $("#mic-badge").classList.remove("on");
    $("#meter-fill").style.width = "0%";
    $("#level-text").textContent = "0%";
    send({ mouth: 0, level: 0 }).catch(report);
    status("마이크가 꺼져 있습니다.");
  }
  async function start() {
    if (starting) return;
    starting = true;
    $("#mic-toggle").disabled = true;
    clearInterval(demoTimer);
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw Error(
          "마이크는 localhost 또는 HTTPS 연결에서 사용할 수 있습니다.",
        );
      const deviceId = $("#device").value;
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
        },
        video: false,
      });
      context = new AudioContext();
      await context.resume();
      analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      context.createMediaStreamSource(stream).connect(analyser);
      active = true;
      stream.getAudioTracks()[0].onended = stop;
      await devices();
      $("#mic-toggle").textContent = "마이크 끄기";
      $("#mic-badge").textContent = "LIVE";
      $("#mic-badge").classList.add("on");
      status("마이크 연결됨 · 오디오는 이 기기에서만 분석됩니다.");
      const data = new Float32Array(analyser.fftSize);
      let smoothed = 0;
      const trackMouth = createMouthTracker();
      function tick() {
        if (!active) return;
        const now = performance.now();
        analyser.getFloatTimeDomainData(data);
        let sum = 0;
        for (const value of data) sum += value * value;
        const rms = Math.sqrt(sum / data.length);
        smoothed = smoothed * 0.4 + rms * 0.6;
        const raw = mouthFromLevel(
          smoothed,
          Number($("#sensitivity").value),
          Number($("#strength").value),
        );
        const result = trackMouth(
          { ...raw, drive: raw.level * Number($("#strength").value) },
          now,
        );
        $("#meter-fill").style.width = result.level * 100 + "%";
        $("#level-text").textContent = Math.round(result.level * 100) + "%";
        if (now - lastSent > 65 && !pending) {
          pending = true;
          lastSent = now;
          send(result)
            .catch(() => status("아바타 연결 끊김 · 서버 연결을 확인하세요."))
            .finally(() => (pending = false));
        }
      }
      audioTimer = setInterval(tick, 33);
      tick();
    } catch (err) {
      stop();
      status(
        err.name === "NotAllowedError"
          ? "마이크 권한이 거부되었습니다. 브라우저 사이트 설정에서 허용하세요."
          : err.name === "NotFoundError"
            ? "마이크 장치를 찾을 수 없습니다. 연결 후 다시 시도하세요."
            : err.message,
      );
    } finally {
      starting = false;
      $("#mic-toggle").disabled = false;
    }
  }
  $("#mic-toggle").onclick = () => (active ? stop() : start());
  $("#device").onchange = () => {
    if (active) {
      stop();
      start();
    }
  };
  devices().catch(() => {});
  navigator.mediaDevices?.addEventListener("devicechange", () =>
    devices().catch(() => {}),
  );
  $("#demo").onclick = () => {
    if (active) {
      toast("마이크를 끈 뒤 테스트해주세요.");
      return;
    }
    clearInterval(demoTimer);
    let count = 0;
    demoTimer = setInterval(() => {
      send({ mouth: [0, 1, 2, 1][count++ % 4] }).catch(report);
      if (count >= 20) {
        clearInterval(demoTimer);
        send({ mouth: 0 }).catch(report);
      }
    }, 100);
  };
  const sourceUrl = staticMode
    ? new URL("?overlay=1", location.href).href
    : new URL("/avatar", location.href).href;
  $("#obs-url").textContent = sourceUrl;
  $("#copy-url").onclick = async () => {
    try {
      await navigator.clipboard.writeText(sourceUrl);
      toast("OBS 소스 주소를 복사했습니다.");
    } catch {
      $("#guide").open = true;
      toast("아래 안내의 주소를 직접 복사하세요.");
    }
  };
  $("#open-avatar").onclick = () =>
    window.open(sourceUrl, "kim-ajae-overlay", "popup,width=800,height=800");
  $("#help-toggle").onclick = () => {
    $("#guide").open = !$("#guide").open;
    if ($("#guide").open)
      $("#guide").scrollIntoView({ behavior: "smooth", block: "center" });
  };
  if (events)
    events.onerror = () =>
      status("서버 재연결 중입니다. 실행 상태를 확인하세요.");
  if (staticMode) {
    $(".session").firstChild.textContent = "";
    $(".session").innerHTML = "<i></i> BROWSER TEST <b>Pages</b>";
    $("#guide").innerHTML =
      `<summary>GitHub Pages · OBS 연결 안내</summary><ol><li>마이크 켜기를 누르고 브라우저 권한을 허용하세요. 별도 설치 없이 이 화면에서 테스트할 수 있습니다.</li><li>투명 화면 열기: 같은 브라우저의 팝업에는 음량과 표정이 전달됩니다. 패널은 하나만 열어 두세요.</li><li>OBS 브라우저 소스 URL: <code>${sourceUrl}</code> 크기 800×800. OBS의 ‘상호작용’에서 마이크 켜기를 누르고 허용한 뒤 ‘조작 숨기기’를 누르세요. H 키로 조작을 다시 표시합니다.</li><li>OBS는 일반 브라우저와 별도 프로세스여서 패널의 음량/표정이 직접 전달되지 않습니다. OBS 화면에서 직접 조작하세요. OBS 버전에 따라 마이크 권한이 지원되지 않으면 Chrome 투명 화면의 윈도우 캡처 또는 기존 로컬 서버 모드를 사용하세요.</li></ol><p>단축키: 표정 1–8, 리액션은 추가 파츠 준비 중 (표정 단축키는 해당 화면에 포커스 필요). 소리는 녹음·업로드하지 않습니다. 투명 모드에서 캡처하기 전에 조작 UI를 숨기세요.</p>`;
    if (overlay) {
      const toolbar = document.createElement("div");
      toolbar.id = "overlay-tools";
      toolbar.innerHTML =
        '<button id="overlay-mic">마이크 켜기 / 끄기</button><button id="overlay-hide">조작 숨기기 (H로 복원)</button><p id="overlay-status" role="status">OBS 상호작용에서 마이크를 켜세요.</p><div id="overlay-expressions"></div><div id="overlay-reactions"></div>';
      document.body.append(toolbar);
      $("#overlay-mic").onclick = () => $("#mic-toggle").click();
      $("#overlay-hide").onclick = () => (toolbar.hidden = true);
      for (const [key, label] of Object.entries(expressionNames)) {
        const b = document.createElement("button");
        b.textContent = label;
        b.onclick = () => send({ expression: key });
        $("#overlay-expressions").append(b);
      }
      for (const [key, label] of Object.entries(reactionNames)) {
        const b = document.createElement("button");
        b.textContent = label;
        b.disabled = unavailableReactions.has(key);
        b.title = "추가 원본 파츠 필요";
        b.onclick = () => send({ reaction: key });
        $("#overlay-reactions").append(b);
      }
      new MutationObserver(() => {
        $("#overlay-status").textContent = $("#mic-status").textContent;
      }).observe($("#mic-status"), { childList: true });
      document.addEventListener("keydown", (e) => {
        if (e.key.toLowerCase() === "h") toolbar.hidden = !toolbar.hidden;
      });
    }
  }
  window.addEventListener("pagehide", () => {
    stream?.getTracks().forEach((t) => t.stop());
    if (staticMode) {
      channel?.postMessage({
        type: "state",
        state: { ...state, mouth: 0, level: 0 },
      });
    } else
      navigator.sendBeacon(
        "/state",
        new Blob([JSON.stringify({ mouth: 0, level: 0 })], {
          type: "application/json",
        }),
      );
  });
}
let toastTimer;
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").style.display = "block";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($("#toast").style.display = "none"), 3500);
}
function report() {
  toast("서버 연결을 확인하세요.");
}
