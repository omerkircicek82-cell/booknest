import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 3000);
const model = process.env.OLLAMA_MODEL || 'deepseek-r1';
const base = (process.env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
const password = process.env.ACCESS_PASSWORD;
const files = {'/':['index.html','text/html; charset=utf-8'],'/app.js':['app.js','text/javascript; charset=utf-8'],'/style.css':['style.css','text/css; charset=utf-8']};
files['/eglence'] = files['/'];
files['/eglence/'] = files['/'];
const json = (res, status, value) => { res.writeHead(status, {'Content-Type':'application/json; charset=utf-8'}); res.end(JSON.stringify(value)); };
http.createServer(async (req,res) => {
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','same-origin');
  res.setHeader('Content-Security-Policy',"default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'");
  const path = req.url?.split('?')[0];
  if (path.startsWith('/api/')) {
    res.setHeader('Cache-Control','no-store');
    if (password) {
      const provided = Buffer.from(req.headers.authorization || '');
      const expected = Buffer.from(`Bearer ${password}`);
      if (provided.length !== expected.length || !timingSafeEqual(provided,expected)) return json(res,401,{error:'Erişim parolası geçersiz.'});
    }
    if (req.method === 'GET' && path === '/api/status') {
      try {
        const upstream = await fetch(`${base}/api/tags`,{signal:AbortSignal.timeout(5000)});
        if (!upstream.ok) throw new Error();
        const data = await upstream.json();
        const available = data.models?.some(m => m.name === model || m.name === `${model}:latest`);
        return json(res,200,{model,ready:!!available});
      } catch { return json(res,503,{error:'Ollama bağlantısı kurulamadı. Sunucu adresini kontrol edin.'}); }
    }
    if (req.method === 'POST' && path === '/api/chat') {
      if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}` && req.headers.origin !== `https://${req.headers.host}`) return json(res,403,{error:'Geçersiz kaynak.'});
      let size = 0, chunks = [];
      try {
        for await (const chunk of req) { size += chunk.length; if(size > 131072) return json(res,413,{error:'Sohbet çok uzun. Yeni sohbet başlatın.'}); chunks.push(chunk); }
        const {messages, mode} = JSON.parse(Buffer.concat(chunks));
        if (!Array.isArray(messages) || !messages.length || messages.length > 80 || messages.some(m => !['user','assistant'].includes(m.role) || typeof m.content !== 'string' || m.content.length > 20000)) return json(res,400,{error:'Geçersiz mesajlar.'});
        const modelMessages = mode === 'fun' ? [{role:'system',content:'Türkçe, samimi ve eğlenceli bir yardımcı olarak yanıt ver. Kullanıcının hitap adı aptülfettah oğulları. Arayüz her yanıtının başına bu hitabı otomatik ekler; hitabı tekrar yazmadan soruyu doğrudan yanıtla. Bilgileri doğru ve anlaşılır aktar.'}, ...messages] : messages;
        const controller = new AbortController();
        const disconnected = () => controller.abort();
        res.on('close',disconnected);
        const timer = setTimeout(()=>controller.abort(),600000);
        try {
          const upstream = await fetch(`${base}/api/chat`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model,messages:modelMessages,stream:true}),signal:controller.signal});
          if (!upstream.ok) return json(res,502,{error:'Model yanıt veremedi. Ollama model ayarını kontrol edin.'});
          res.writeHead(200,{'Content-Type':'application/x-ndjson','X-Accel-Buffering':'no'});
          for await (const chunk of upstream.body) {
            if (!res.write(chunk)) await new Promise(resolve => {res.once('drain',resolve);res.once('close',resolve);});
          }
          res.end();
        } finally {clearTimeout(timer);res.off('close',disconnected);}
      } catch { if (!res.headersSent) json(res,502,{error:'Yanıt alınamadı. Ollama bağlantısını kontrol edin.'}); else res.end(JSON.stringify({error:'Bağlantı kesildi.'})+'\n'); }
      return;
    }
    return json(res,404,{error:'Bulunamadı.'});
  }
  if (req.method !== 'GET' || !files[path]) {res.writeHead(404);return res.end('Bulunamadı');}
  try {const [name,type] = files[path];res.writeHead(200,{'Content-Type':type});res.end(await readFile(fileURLToPath(new URL(`./public/${name}`,import.meta.url))));} catch {res.writeHead(500);res.end();}
}).listen(port,host,()=>console.log(`Booknest AI listening on ${host}:${port}`));
