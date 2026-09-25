import { HE_PLACES, HOODS } from './places';

/**
 * A search box that works before React loads. On a 2s-RTT link the app code arrives
 * ~6s after the first paint, so the landing HTML carries this markup plus a ~2KB script.
 * It is rendered through dangerouslySetInnerHTML so hydration never touches its DOM.
 * Hand-off: a pick is stored in window.__boot.pick (or passed to window.__bootPick once
 * React is up); text still in the box moves to the React picker when the box loses focus.
 */
export const BOOT_HTML = `<div class="boot-search" hidden><section class="card"><h2>לאן?</h2><div class="picker"><div class="searchrow"><div class="ac">`
  + `<input placeholder="עיר, שכונה או שם מלון" aria-label="חיפוש עיר, אזור או מקום לינה" enterkeyhint="search" autocomplete="off" role="combobox">`
  + `<ul class="ac-list" role="listbox" hidden></ul></div><button class="btn primary" type="button">חפש</button></div>`
  + `<p class="boot-wait" hidden>טוען את האזור…</p></div></section></div><div class="boot-list" hidden></div>`;

const LOCAL = [...HOODS, ...HE_PLACES].map(p => [p.name, p.en, +p.lat.toFixed(4), +p.lon.toFixed(4), p.country ?? '']);

const JS = `document.addEventListener('DOMContentLoaded',function(){try{var O=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');O.unobserve(e.target)}})},{rootMargin:'0px 0px -8% 0px'});document.querySelectorAll('.reveal').forEach(function(el){O.observe(el)})}catch(e){}});
(function(){var B=document.getElementById('boot');if(!B)return;var S=B.querySelector('.boot-search'),V=B.querySelector('.boot-list'),W=window,P=[],I=B.querySelector('input'),L=B.querySelector('ul'),R=[],t,c=0,
LOC=__LOCAL__,ICON={hotel:'🏨',guest_house:'🏡',hostel:'🛏️',alpine_hut:'🏔️',motel:'🛣️'},OT={N:'node',W:'way',R:'relation'},
STAY='hotel,hostel,guest_house,motel,apartment,chalet,camp_site,alpine_hut'.split(',').map(function(x){return'&osm_tag=tourism:'+x}).join('');
W.__boot=W.__boot||{};
var sw=0;function reg(){if(sw++||!('serviceWorker' in navigator))return;navigator.serviceWorker.register('/sw.js').catch(function(){})}addEventListener('load',reg);setTimeout(reg,5000);
function nm(s){return(s||'').replace(/[׳'"\`]/g,'').trim().toLowerCase()}
function fl(c){return c&&c.length==2?String.fromCodePoint.apply(null,c.toUpperCase().split('').map(function(x){return 127397+x.charCodeAt(0)})):''}
function es(s){return String(s||'').replace(/[&<>"]/g,function(x){return'&#'+x.charCodeAt(0)+';'})}
function draw(){if(!R.length){L.hidden=true;L.innerHTML='';return}var h='',last;R.forEach(function(s,i){if(s.type!==last){h+='<li class="ac-head" aria-hidden="true">'+(s.type=='stay'?'מקומות לינה':'ערים ואזורים')+'</li>';last=s.type}
h+='<li role="option"><button type="button" data-i="'+i+'"><span class="ac-icon'+(s.type=='stay'?' stay':'')+'">'+(s.type=='stay'?(ICON[s.kind]||'🏨'):'📍')+'</span><span class="ac-text"><b dir="auto">'+es(s.name)+'</b>'+(s.sub?'<small dir="auto">'+es(s.sub)+'</small>':'')+'</span><span class="ac-flag">'+fl(s.country)+'</span></button></li>'});L.innerHTML=h;L.hidden=false}
function ph(q,tags){return fetch('https://photon.komoot.io/api/?q='+encodeURIComponent(q)+'&limit=12&lang=en'+tags+'&lat=27.7172&lon=85.324&location_bias_scale=0.3').then(function(r){return r.ok?r.json():{}}).then(function(j){return j.features||[]},function(){return[]})}
function find(){var q=nm(I.value),n=++c;if(q.length<2){R=[];draw();return}
var loc=LOC.filter(function(p){return[p[0],p[1]].some(function(x){x=nm(x);return x.indexOf(q)==0||x.split(/[ ,\\-]+/).some(function(w){return w.indexOf(q)==0})})}).slice(0,4).map(function(p){return{type:'area',name:p[0],sub:p[1],lat:p[2],lon:p[3],country:p[4]}});
R=loc;draw();if(/[\\u0590-\\u05FF]/.test(q)&&loc.length)return;
Promise.all([ph(q,STAY),ph(q,'&osm_tag=place')]).then(function(a){if(n!==c||W.__bootGone)return;var st=[],ar=[];a[0].concat(a[1]).forEach(function(f){var p=f.properties||{};if(!p.name)return;var g=f.geometry.coordinates,town=p.city||p.town||p.village||p.district||p.county,cc=(p.countrycode||'').toUpperCase();
if(p.osm_key=='tourism'){if(OT[p.osm_type])st.push({type:'stay',name:p.name,lat:g[1],lon:g[0],country:cc,kind:p.osm_value,city:town,placeId:'osm-'+OT[p.osm_type]+'-'+p.osm_id,sub:[town,p.country].filter(Boolean).join(', ')})}
else ar.push({type:'area',name:p.name,lat:g[1],lon:g[0],country:cc,sub:[p.osm_value=='city'?null:town,p.state,p.country].filter(Boolean).join(', ')})});
R=loc.concat(ar).slice(0,5).concat(st.slice(0,5));draw()})}
function km(a,b,c,d){return Math.hypot((c-a)*111,(d-b)*111*Math.cos(a*Math.PI/180))}
function dst(d){return d<1?Math.round(d*1000)+' מ׳':d.toFixed(1)+' ק״מ'}
function area(lat,lon,name,cc){W.__bootAreaName=name;if(W.__hyd&&!W.__bootAreaOk)return;var KH={hotel:'מלון',guest_house:'גסטהאוס',hostel:'הוסטל',alpine_hut:'טי-האוס / לודג׳',motel:'מוטל',lodge:'לודג׳'};W.__bootArea={lat:lat,lon:lon,p:fetch('/api/area?lat='+lat+'&lon='+lon).then(function(r){return r.ok?r.json():null}).catch(function(){return null})};
var sk='';for(var k=0;k<4;k++)sk+='<li class="card skeleton row-skel"></li>';
V.innerHTML='<header class="header scrolled"><span class="brand"><img src="/icons/v2/icon-96.webp" alt="" width="32" height="32"><span>מחיר ללילה</span></span><nav><span class="chip ghost-slot" aria-hidden="true"></span></nav></header><main class="wrap"><div class="area-head"><div><p class="muted small">מקומות לינה</p><h1 class="area-title">'+(cc?'<span class="flag">'+fl(cc)+'</span>':'')+'<bdi>'+es(name)+'</bdi></h1></div><div class="row"><button class="icon-btn" type="button" aria-label="המיקום שלי">📍</button><button class="icon-btn" type="button" aria-label="שנה אזור">🔎</button></div></div><div class="gate gate-slot" aria-hidden="true">&nbsp;</div><button class="btn sleep block" type="button">😴 אני ישן כאן עכשיו · דיווח ב-10 שניות</button><div class="map map-loading">טוען מפה…</div><ul class="places">'+sk+'</ul></main>';V.hidden=false;
W.__bootArea.p.then(function(j){if(!j||!V.isConnected)return;var c=j.counts||{},ps=(j.places||[]).map(function(p){return{id:p.id,name:p.name,kind:p.kind,lat:p.lat,lon:p.lon,country:p.country||cc,d:km(lat,lon,p.lat,p.lon)}});
(j.reported||[]).forEach(function(r){if(!ps.some(function(p){return p.id==r.id}))ps.push({id:r.id,name:r.name,kind:r.kind||'guest_house',lat:r.lat,lon:r.lon,country:r.country||cc,d:km(lat,lon,r.lat,r.lon)})});ps.sort(function(a,b){return a.d-b.d});
if(!ps.length)return;P=ps;var U=V.querySelector('.places'),k=ps.filter(function(p){return c[p.id]}).length;U.insertAdjacentHTML('beforebegin','<div class="seg filter"><button type="button" class="on">הכל ('+ps.length+')</button><button type="button">עם מחירים ('+k+')</button></div>');U.innerHTML=ps.map(function(p,i){var n=c[p.id]||0;return'<li><button class="card place" type="button" data-i="'+i+'"><div class="thumb sm ph ph-'+es(p.kind)+'" aria-hidden="true"><span>'+(ICON[p.kind]||'🏠')+'</span></div><span class="place-body"><span class="name" dir="auto">'+es(p.name)+'</span><span class="muted small">'+(KH[p.kind]||'לינה')+' · '+dst(p.d)+'</span></span>'+(n?'<span class="badge price-wait" aria-label="טוען מחיר"><i></i></span>':'<span class="badge empty">עוד אין מחיר</span>')+'</button></li>'}).join('')})}
V.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('.places button[data-i]');if(!b)return;var p=P[+b.dataset.i];if(!p||!Number.isFinite(p.lat)||!Number.isFinite(p.lon))return;V.querySelectorAll('.places button').forEach(function(x){x.disabled=true});b.setAttribute('aria-busy','true');pick({type:'stay',placeId:p.id,name:p.name,kind:p.kind,lat:p.lat,lon:p.lon,country:p.country,city:W.__bootAreaName==='האזור'?undefined:W.__bootAreaName})});
var AT=(new URLSearchParams(location.search).get('at')||'').split(',').map(Number);
if(AT.length==2&&AT.every(isFinite)&&!location.search.match(/[?&](invite|login)=/))area(AT[0],AT[1],'האזור');
function pick(s){if(!s)return;W.__boot.pick=s;W.__bootEarlyPick=s;I.blur();L.hidden=true;B.querySelector('.boot-wait').hidden=false;if(s.type!='stay'&&!W.__bootPick){area(s.lat,s.lon,s.name,s.country)}if(W.__bootPick)W.__bootPick(s)}
document.addEventListener('click',function(e){var x=e.target.closest&&e.target.closest('.hero .btn.glass');if(x&&!W.__hyd){S.hidden=false;I.focus()}},true);
I.addEventListener('input',function(){clearTimeout(t);t=setTimeout(find,220)});
I.addEventListener('keydown',function(e){if(e.key=='Enter')pick(R[0])});
B.querySelector('.searchrow>.btn').addEventListener('click',function(){pick(R[0])});
L.addEventListener('mousedown',function(e){e.preventDefault()});
L.addEventListener('click',function(e){var b=e.target.closest('button');if(b)pick(R[+b.dataset.i])});
I.addEventListener('blur',function(){if(W.__bootBlur&&!W.__boot.pick)setTimeout(function(){if(document.activeElement!==I)W.__bootBlur(I.value)},150)});
})();`;

export const BOOT_JS = JS.replace('__LOCAL__', JSON.stringify(LOCAL));
