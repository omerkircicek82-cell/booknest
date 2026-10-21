const $ = id => document.getElementById(id);
// randomUUID is unavailable on plain HTTP LAN addresses; this ID is only for local history.
const chatId = () => globalThis.crypto?.randomUUID?.() || `chat-${Date.now()}-${Math.random().toString(36).slice(2)}`;
let chats = [];
try { chats = JSON.parse(localStorage.getItem('booknest-chats') || '[]'); if (!Array.isArray(chats)) chats=[]; chats=chats.filter(c=>typeof c.id==='string' && Array.isArray(c.messages)); } catch {}
let current = null, controller = null, password = sessionStorage.getItem('booknest-password') || '';
const headers = () => ({'Content-Type':'application/json',...(password?{Authorization:`Bearer ${password}`}:{})});
const persist = () => {try {localStorage.setItem('booknest-chats',JSON.stringify(chats));}catch {$('error').textContent='Tarayıcı depolama alanı dolu; sohbet kaydedilemedi.';}};
function history() {
  $('history').replaceChildren();
  for (const chat of chats) {const b = document.createElement('button');b.textContent=chat.messages[0]?.content || 'Yeni sohbet';b.classList.toggle('active',chat.id===current?.id);b.onclick=()=>{if(controller)return;current=chat;render();};$('history').append(b);}
}
function bubble(message) {
  const el = document.createElement('article');el.className=`message ${message.role}`;
  const content=document.createElement('div');content.textContent=message.content;el.append(content);
  let thinking=null;
  if (message.thinking) {const details=document.createElement('details');const summary=document.createElement('summary');summary.textContent='Düşünme süreci';thinking=document.createElement('div');thinking.textContent=message.thinking;details.append(summary,thinking);el.append(details);}
  $('messages').append(el);return {el,content,thinking};
}
function render(){ $('welcome').hidden=!!current?.messages.length;$('messages').replaceChildren();for(const m of current?.messages || [])bubble(m);history(); }
async function status(){
  try {const r=await fetch('/api/status',{headers:headers()});const data=await r.json();if(r.status===401){$('status').textContent='● Parola gerekli';return;}if(!r.ok)throw new Error(data.error);$('model').textContent=data.model;$('status').textContent=data.ready?'● Model hazır':'● Model yüklü değil';$('status').classList.toggle('ready',data.ready);}
  catch {$('status').textContent='● Ollama çevrimdışı';}
}
$('settings').onclick=()=>{$('password').value=password;$('dialog').showModal();};
$('mobile-settings').onclick=$('settings').onclick;
$('save').onclick=()=>{password=$('password').value;sessionStorage.setItem('booknest-password',password);status();};
$('new').onclick=()=>{if(controller)return;current=null;$('error').textContent='';render();$('prompt').focus();};
$('stop').onclick=()=>controller?.abort();
document.querySelectorAll('[data-prompt]').forEach(b=>b.onclick=()=>{$('prompt').value=b.dataset.prompt;$('prompt').focus();});
$('prompt').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();$('composer').requestSubmit();}});
$('composer').onsubmit=async e=>{
  e.preventDefault();const prompt=$('prompt').value.trim();if(!prompt||controller)return;
  if(!current){current={id:chatId(),messages:[]};chats.unshift(current);}
  current.messages.push({role:'user',content:prompt});$('prompt').value='';$('error').textContent='';persist();render();
  const previous=current.messages.map(({role,content})=>({role,content}));
  const reply={role:'assistant',content:'',thinking:''};current.messages.push(reply);let view=bubble(reply);
  controller=new AbortController();$('send').hidden=true;$('stop').hidden=false;
  let completed=false;
  try {
    const response=await fetch('/api/chat',{method:'POST',headers:headers(),body:JSON.stringify({messages:previous}),signal:controller.signal});
    if(!response.ok){const error=await response.json();throw new Error(error.error || 'İstek başarısız.');}
    const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';
    const consume=line=>{if(!line.trim())return;const data=JSON.parse(line);if(data.error)throw new Error(data.error);reply.content+=data.message?.content || '';reply.thinking+=data.message?.thinking || '';view.content.textContent=reply.content || 'Düşünüyor…';if(reply.thinking){if(!view.thinking){view.el.remove();view=bubble(reply);}else view.thinking.textContent=reply.thinking;}if(data.done)completed=true;};
    while(true){const {value,done}=await reader.read();buffer+=decoder.decode(value,{stream:!done});let boundary;while((boundary=buffer.indexOf('\n'))>=0){consume(buffer.slice(0,boundary));buffer=buffer.slice(boundary+1);}if(done){if(buffer.trim())consume(buffer);break;}}
    if(!completed)throw new Error('Yanıt tamamlanmadan bağlantı kesildi.');
  } catch(error){$('error').textContent=error.name==='AbortError'?'Yanıt durduruldu.':error.message;}
  finally {if(!reply.content&&!reply.thinking){current.messages.pop();view.el.remove();}persist();controller=null;$('send').hidden=false;$('stop').hidden=true;history();}
};
render();status();
