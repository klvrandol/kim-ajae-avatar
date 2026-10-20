import {createAvatar,expressionNames,reactionNames} from './avatar.js';
import {mouthFromLevel} from './audio.js';
const $=s=>document.querySelector(s);
const overlay=location.pathname==='/avatar';
let avatar;
if(overlay){document.documentElement.classList.add('overlay');const stage=document.createElement('div');stage.id='overlay-stage';document.body.append(stage);avatar=createAvatar(stage);}
else avatar=createAvatar($('#avatar-mount'));
let state={expression:'neutral',mouth:0};
let lastReceived=0;
const events=new EventSource('/events');
events.onmessage=e=>{lastReceived=Date.now();state=JSON.parse(e.data);avatar.update(state);if(!overlay){$('#expression-label').textContent=expressionNames[state.expression];document.querySelectorAll('[data-expression]').forEach(b=>{const active=b.dataset.expression===state.expression;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});}};
// Stop stale lip movements when a controller closes or disconnects.
setInterval(()=>{if(Date.now()-lastReceived>800 && state.mouth){state.mouth=0;avatar.update(state);}},300);
async function send(patch){const res=await fetch('/state',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(patch)});if(!res.ok)throw Error('상태 전달 실패');}
if(!overlay){
 const faces=['😐','☺','😠','😳','😑','🧐'];
 Object.entries(expressionNames).forEach(([key,label],i)=>{const button=document.createElement('button');button.dataset.expression=key;button.title=`${label} (${i+1})`;button.innerHTML=`<span class="face-icon">${faces[i]}</span><span>${label}</span><kbd>${i+1}</kbd>`;button.onclick=()=>send({expression:key}).catch(report);$('#expressions').append(button);});
 const keys=['q','w','e','r','t'],icons=['⌨','☕','🎮','🙌','🫣'];
 Object.entries(reactionNames).forEach(([key,label],i)=>{const button=document.createElement('button');button.dataset.reaction=key;button.innerHTML=`<span>${icons[i]} ${label}</span><kbd>${keys[i].toUpperCase()}</kbd>`;button.onclick=()=>send({reaction:key}).catch(report);$('#reactions').append(button);});
 document.addEventListener('keydown',e=>{if(e.repeat||e.ctrlKey||e.metaKey||e.altKey||['INPUT','SELECT','TEXTAREA','BUTTON'].includes(e.target.tagName))return;const index=Number(e.key)-1;if(index>=0&&index<6)send({expression:Object.keys(expressionNames)[index]}).catch(report);const r=keys.indexOf(e.key.toLowerCase());if(r>=0)send({reaction:Object.keys(reactionNames)[r]}).catch(report);});
 let stream,context,analyser,audioTimer,active=false,pending=false,lastSent=0,starting=false,demoTimer;
 for(const id of ['sensitivity','strength']){try {const saved=localStorage.getItem(id);if(saved!==null && Number(saved)>0)$('#'+id).value=saved;}catch{}const update=()=>{$('#'+id+'-value').value=Number($('#'+id).value).toFixed(1)+'×';try{localStorage.setItem(id,$('#'+id).value);}catch{}};$('#'+id).oninput=update;update();}
 async function devices(){if(!navigator.mediaDevices)return;const list=await navigator.mediaDevices.enumerateDevices();const value=$('#device').value;$('#device').replaceChildren(new Option('시스템 기본 마이크',''));list.filter(d=>d.kind==='audioinput').forEach((d,i)=>$('#device').add(new Option(d.label||`마이크 ${i+1}`,d.deviceId)));$('#device').value=value;}
 function status(message){$('#mic-status').textContent=message;}
 function stop(){active=false;clearInterval(audioTimer);stream?.getTracks().forEach(t=>t.stop());stream=null;context?.close().catch(()=>{});context=null;$('#mic-toggle').textContent='마이크 켜기';$('#mic-badge').textContent='OFF';$('#mic-badge').classList.remove('on');$('#meter-fill').style.width='0%';$('#level-text').textContent='0%';send({mouth:0,level:0}).catch(report);status('마이크가 꺼져 있습니다.');}
 async function start(){if(starting)return;starting=true;$('#mic-toggle').disabled=true;clearInterval(demoTimer);try{if(!navigator.mediaDevices?.getUserMedia)throw Error('마이크는 localhost 또는 HTTPS 연결에서 사용할 수 있습니다.');const deviceId=$('#device').value;stream=await navigator.mediaDevices.getUserMedia({audio:{deviceId:deviceId?{exact:deviceId}:undefined,echoCancellation:true,noiseSuppression:true,autoGainControl:false},video:false});context=new AudioContext();await context.resume();analyser=context.createAnalyser();analyser.fftSize=1024;context.createMediaStreamSource(stream).connect(analyser);active=true;stream.getAudioTracks()[0].onended=stop;await devices();$('#mic-toggle').textContent='마이크 끄기';$('#mic-badge').textContent='LIVE';$('#mic-badge').classList.add('on');status('마이크 연결됨 · 오디오는 이 기기에서만 분석됩니다.');const data=new Float32Array(analyser.fftSize);let smoothed=0;
 function tick(){if(!active)return;const now=performance.now();analyser.getFloatTimeDomainData(data);let sum=0;for(const value of data)sum+=value*value;const rms=Math.sqrt(sum/data.length);smoothed=smoothed*.4+rms*.6;const result=mouthFromLevel(smoothed,Number($('#sensitivity').value),Number($('#strength').value));$('#meter-fill').style.width=result.level*100+'%';$('#level-text').textContent=Math.round(result.level*100)+'%';if(now-lastSent>65 && !pending){pending=true;lastSent=now;send(result).catch(()=>status('아바타 연결 끊김 · 서버 연결을 확인하세요.')).finally(()=>pending=false);}}audioTimer=setInterval(tick,33);tick();
 }catch(err){stop();status(err.name==='NotAllowedError'?'마이크 권한이 거부되었습니다. 브라우저 사이트 설정에서 허용하세요.':err.name==='NotFoundError'?'마이크 장치를 찾을 수 없습니다. 연결 후 다시 시도하세요.':err.message);}finally{starting=false;$('#mic-toggle').disabled=false;}}
 $('#mic-toggle').onclick=()=>active?stop():start();$('#device').onchange=()=>{if(active){stop();start();}};devices().catch(()=>{});navigator.mediaDevices?.addEventListener('devicechange',()=>devices().catch(()=>{}));
 $('#demo').onclick=()=>{if(active){toast('마이크를 끈 뒤 테스트해주세요.');return;}clearInterval(demoTimer);let count=0;demoTimer=setInterval(()=>{send({mouth:[0,1,2,1][count++%4]}).catch(report);if(count>=20){clearInterval(demoTimer);send({mouth:0}).catch(report);}},100);};
 const sourceUrl=new URL('/avatar',location.href).href;$('#obs-url').textContent=sourceUrl;
 $('#copy-url').onclick=async()=>{try{await navigator.clipboard.writeText(sourceUrl);toast('OBS 소스 주소를 복사했습니다.');}catch{ $('#guide').open=true;toast('아래 안내의 주소를 직접 복사하세요.');}};
 $('#open-avatar').onclick=()=>window.open(sourceUrl,'kim-ajae-overlay','popup,width=800,height=800');
 $('#help-toggle').onclick=()=>{$('#guide').open=!$('#guide').open;if($('#guide').open)$('#guide').scrollIntoView({behavior:'smooth',block:'center'});};
 events.onerror=()=>status('서버 재연결 중입니다. 실행 상태를 확인하세요.');
 window.addEventListener('pagehide',()=>{stream?.getTracks().forEach(t=>t.stop());navigator.sendBeacon('/state',new Blob([JSON.stringify({mouth:0,level:0})],{type:'application/json'}));});
}
let toastTimer;
function toast(message){$('#toast').textContent=message;$('#toast').style.display='block';clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').style.display='none',3500);}
function report(){toast('서버 연결을 확인하세요.');}
