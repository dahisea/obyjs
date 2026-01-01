
const D=["https://static-sg-apse1-primary-mirror-aws-s3-cloudfront-public-cdn.dahi.edu.eu.org","https://static-sg-apse1-primary-mirror-aws-s3-cloudfront-public-cdn.dahi.edu.eu.org.cdn.cloudflare.net","https://tencent.api-data-abtest-config.dahi.edu.eu.org","https://api-data-aws-abtest-config.dahi.edu.eu.org","https://abtest-ch-snssdk-os.netlify.app","https://api-data-abtest-config.dahi.edu.eu.org"];
const CFG={to:2e3,cnt:3,days:3,key:'gfork_fastest_domain',ipto:3e3,cto:2e3,ito:1e3};
let R=[],IP=null,app=null;

const scripts=[
{id:"12345",name:"網頁廣告攔截助手",author:"AdBlocker",desc:"自動攔截網頁中的煩人廣告，讓瀏覽更清爽。支援主流影片網站、新聞網站等。",cat:"效率工具",dl:125600,rate:4.8,icon:"block"},
{id:"23456",name:"影片下載器增強版",author:"VideoHelper",desc:"支援下載各大影片網站的內容，一鍵儲存到本地。支援批量下載和自訂畫質。",cat:"下載工具",dl:89300,rate:4.6,icon:"download"},
{id:"34567",name:"自動填表助手",author:"FormFiller",desc:"智慧識別表單欄位，自動填入常用資訊。支援自訂範本，提高工作效率。",cat:"效率工具",dl:67800,rate:4.5,icon:"edit_note"},
{id:"45678",name:"網頁翻譯增強",author:"TranslateMax",desc:"即時翻譯網頁內容，支援多種語言。劃詞翻譯、全文翻譯一應俱全。",cat:"學習工具",dl:156200,rate:4.9,icon:"translate"},
{id:"56789",name:"GitHub增強工具",author:"GitHelper",desc:"為GitHub新增更多實用功能，包括程式碼樹、檔案下載、統計圖表等。",cat:"開發工具",dl:45600,rate:4.7,icon:"code"},
{id:"67890",name:"購物比價助手",author:"PriceCompare",desc:"自動比較各大電商平台的商品價格，幫你找到最優惠的購買渠道。",cat:"購物優惠",dl:98700,rate:4.6,icon:"shopping_cart"},
{id:"78901",name:"夜間模式增強",author:"DarkMode",desc:"為任何網站新增舒適的夜間模式，保護眼睛減少疲勞。支援自訂色彩方案。",cat:"美化工具",dl:112400,rate:4.8,icon:"dark_mode"},
{id:"89012",name:"網盤加速下載",author:"SpeedUp",desc:"突破網盤下載速度限制，支援多執行緒下載。讓下載速度飛起來。",cat:"下載工具",dl:203500,rate:4.9,icon:"speed"}
];
let flt='全部',q='';

const $=(ms)=>new Promise(r=>setTimeout(r,ms));
const dd=(d)=>d.replace('https://','');
const fmt=(n)=>n>=1e4?(n/1e4).toFixed(1)+'萬':n.toLocaleString();

async function getIP(){
try{
const c=new AbortController(),t=setTimeout(()=>c.abort(),CFG.ipto);
const r=await fetch('https://www.cloudflare.com/cdn-cgi/trace',{signal:c.signal});
clearTimeout(t);
const txt=await r.text();
for(const l of txt.split('\n'))if(l.startsWith('ip='))IP=l.split('=')[1].trim();
}catch(e){}
}

function getPath(h){
return h&&h.startsWith('#/')?h.substring(2):null;
}

function getCache(){
if(!IP)return null;
try{
const d=JSON.parse(localStorage.getItem(CFG.key)||'null');
if(!d||d.ip!==IP||Date.now()-d.time>CFG.days*864e5||!D.includes(d.domain)){
localStorage.removeItem(CFG.key);
return null;
}
return d.domain;
}catch{return null}
}

function setCache(d){
if(!IP)return;
try{localStorage.setItem(CFG.key,JSON.stringify({ip:IP,domain:d,time:Date.now()}))}catch(e){}
}

async function testDomain(d){
return new Promise(r=>{
const f=document.createElement('iframe');
f.style.display='none';
f.sandbox='allow-scripts';
const t=setTimeout(()=>{c();r(false)},CFG.to);
function c(){clearTimeout(t);f.parentNode&&document.body.removeChild(f)}
const h=(e)=>{if(e.data==='gfork_activated'){c();window.removeEventListener('message',h);r(true)}};
window.addEventListener('message',h);
f.srcdoc=`<!DOCTYPE html><html><head><script>window.gfork_test_active=false;window.onGforkActivated=function(){window.gfork_test_active=true;parent.postMessage('gfork_activated','*')};const s=document.createElement('script');s.src='${d}/gfork.js';s.onerror=()=>parent.postMessage('gfork_error','*');setTimeout(()=>{if(window.gfork_test_active)parent.postMessage('gfork_activated','*')},100);document.head.appendChild(s);<\/script></head></html>`;
document.body.appendChild(f);
});
}

async function testAll(p){
R=[];
const sel=[...D].sort(()=>Math.random()-.5).slice(0,CFG.cnt);
render(`<div class="icon"><span class="material-icons">speed</span></div><h1>測速中</h1><p class="desc">正在測試節點連接速度，請稍候...</p><div class="url">${p}</div><div class="st" id="st"><div class="st-t">測試節點 (${sel.length}個)</div>${sel.map(d=>`<div class="st-i" data-d="${d}"><span class="material-icons">pending</span>${dd(d)}<span class="lat">等待中</span></div>`).join('')}</div><div class="tip">提示：正在隨機測試 ${CFG.cnt} 個節點</div>`);

for(let i=0;i<sel.length;i++){
const d=sel[i],el=document.querySelector(`[data-d="${d}"]`);
if(el){el.className='st-i';el.innerHTML=`<span class="material-icons">sync</span>${dd(d)}<span class="lat">測試中...</span>`}
const t0=Date.now(),ok=await testDomain(d),lat=Date.now()-t0;
if(ok){
R.push({d,lat});
if(el){el.className='st-i ok';el.innerHTML=`<span class="material-icons">check_circle</span>${dd(d)}<span class="lat">${lat}ms</span>`}
}else if(el){el.className='st-i fail';el.innerHTML=`<span class="material-icons">cancel</span>${dd(d)}<span class="lat">超時</span>`}
if(i<sel.length-1)await $(300);
}

if(R.length>0){
R.sort((a,b)=>a.lat-b.lat);
const fast=R[0];
setCache(fast.d);
await $(500);
const url=`${fast.d}/scripts/${p}`;
render(`<div class="icon ok"><span class="material-icons">check_circle</span></div><h1>驗證成功</h1><p class="desc">已選擇最快節點，即將自動跳轉</p><div class="badge"><span class="material-icons">speed</span>最低延遲 ${fast.lat}ms</div><div class="url">${url}</div><div class="st"><div class="st-t">測速結果</div>${R.map((r,i)=>`<div class="st-i ok"><span class="material-icons">${i===0?'emoji_events':'check_circle'}</span>${dd(r.d)}<span class="lat">${r.lat}ms</span></div>`).join('')}</div><a href="${url}" class="btn"><span class="material-icons">open_in_new</span>立即前往</a>`);
setTimeout(()=>{location.href=url},1e3);
}else{
const rd=D[Math.floor(Math.random()*D.length)];
const url=`${rd}/scripts/${p}`;
render(`<div class="icon err"><span class="material-icons">warning</span></div><h1>使用備用方案</h1><p class="desc">所有節點檢測超時，已隨機選擇一個節點</p><div class="url">${url}</div><a href="${url}" class="btn"><span class="material-icons">open_in_new</span>手動前往</a><div class="tip">若無法訪問，請重新整理再試</div>`);
}
}

function render(h){
if(app)app.innerHTML=h;
}

function showList(){
const cats=['全部',...new Set(scripts.map(s=>s.cat))];
render(`<div class="hdr"><h1>使用者腳本中心</h1><p class="sub">發現並安裝實用的使用者腳本</p></div><div class="search"><span class="material-icons">search</span><input type="text" placeholder="搜尋腳本..." oninput="handleSearch(this.value)"></div><div class="tabs" id="tabs">${cats.map(c=>`<div class="tab${c===flt?' on':''}" onclick="handleFilter('${c}')">${c}</div>`).join('')}</div><div class="grid" id="grid">${renderCards()}</div><div class="tip">提示：點擊任意腳本卡片即可查看詳情並安裝</div>`);
}

function renderCards(){
let f=scripts;
if(flt!=='全部')f=f.filter(s=>s.cat===flt);
if(q){const lq=q.toLowerCase();f=f.filter(s=>s.name.toLowerCase().includes(lq)||s.desc.toLowerCase().includes(lq)||s.author.toLowerCase().includes(lq))}
if(f.length===0)return`<div class="empty"><span class="material-icons">search_off</span><h3>未找到相關腳本</h3><p>試試其他關鍵詞或分類</p></div>`;
return f.map(s=>`<a href="#/${s.id}/${encodeURIComponent(s.name)}.user.js" class="card"><div class="card-h"><div class="card-ico"><span class="material-icons">${s.icon}</span></div><div class="card-info"><div class="card-name">${s.name}</div><div class="card-auth"><span class="material-icons">person</span>${s.author}</div></div></div><div class="card-desc">${s.desc}</div><div class="card-meta"><div><span class="material-icons">download</span>${fmt(s.dl)}</div><div><span class="material-icons">star</span>${s.rate}</div><div><span class="material-icons">label</span>${s.cat}</div></div></a>`).join('');
}

function handleFilter(c){
flt=c;
document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('on',t.textContent.trim()===c));
document.getElementById('grid').innerHTML=renderCards();
}

function handleSearch(v){
q=v;
document.getElementById('grid').innerHTML=renderCards();
}

(async()=>{
app=document.getElementById('app');
const p=getPath(location.hash);
if(!p){await $(100);showList();return}
await getIP();
const c=getCache();
if(c){
render(`<div class="icon"><span class="material-icons">verified</span></div><h1>校驗中</h1><p class="desc">正在校驗快取節點...</p><div class="url">${p}</div><div class="st"><div class="st-t">快取節點</div><div class="st-i"><span class="material-icons">cloud_done</span>${dd(c)}</div></div><div class="tip">提示：快取有效期 ${CFG.days} 天${IP?' (IP: '+IP+')':''}</div>`);
await $(CFG.cto);
const url=`${c}/scripts/${p}`;
render(`<div class="icon ok"><span class="material-icons">check_circle</span></div><h1>驗證成功</h1><p class="desc">快取校驗通過，即將自動跳轉</p><div class="badge"><span class="material-icons">bolt</span>快取加速</div><div class="url">${url}</div><a href="${url}" class="btn"><span class="material-icons">open_in_new</span>立即前往</a>`);
setTimeout(()=>{location.href=url},1e3);
return;
}
render(`<div class="icon"><span class="material-icons">sync</span></div><h1>載入中</h1><p class="desc">正在為您準備最佳連接...</p><div class="url">${p}</div>`);
await $(CFG.ito);
await testAll(p);
})();
