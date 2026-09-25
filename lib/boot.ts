import { HE_PLACES, HOODS } from './places';

/**
 * A search box that works before React loads. On a 2s-RTT link the app code arrives
 * ~6s after the first paint, so the landing HTML carries this markup plus a ~2KB script.
 * It is rendered through dangerouslySetInnerHTML so hydration never touches its DOM.
 * Hand-off: a pick is stored in window.__boot.pick (or passed to window.__bootPick once
 * React is up); text still in the box moves to the React picker when the box loses focus.
 */
export const BOOT_HTML = `<section class="card"><h2>לאן?</h2><div class="picker"><div class="searchrow"><div class="ac">`
  + `<input placeholder="עיר, שכונה או שם מלון" aria-label="חיפוש עיר, אזור או מקום לינה" enterkeyhint="search" autocomplete="off" role="combobox">`
  + `<ul class="ac-list" role="listbox" hidden></ul></div><button class="btn primary" type="button">חפש</button></div>`
  + `<p class="boot-wait" hidden>טוען את האזור…</p></div></section>`;

const LOCAL = [...HOODS, ...HE_PLACES].map(p => [p.name, p.en, +p.lat.toFixed(4), +p.lon.toFixed(4), p.country ?? '']);

const JS = `document.addEventListener('DOMContentLoaded',function(){try{var O=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');O.unobserve(e.target)}})},{rootMargin:'0px 0px -8% 0px'});document.querySelectorAll('.reveal').forEach(function(el){O.observe(el)})}catch(e){}});
(function(){var B=document.getElementById('boot');if(!B)return;var W=window,I=B.querySelector('input'),L=B.querySelector('ul'),R=[],t,c=0,
LOC=__LOCAL__,ICON={hotel:'🏨',guest_house:'🏡',hostel:'🛏️',alpine_hut:'🏔️',motel:'🛣️'},OT={N:'node',W:'way',R:'relation'},
STAY='hotel,hostel,guest_house,motel,apartment,chalet,camp_site,alpine_hut'.split(',').map(function(x){return'&osm_tag=tourism:'+x}).join('');
W.__boot={};
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
function pick(s){if(!s)return;W.__boot.pick=s;I.blur();L.hidden=true;B.querySelector('.boot-wait').hidden=false;if(W.__bootPick)W.__bootPick(s)}
document.addEventListener('click',function(e){var x=e.target.closest&&e.target.closest('.hero .btn.glass');if(x&&!W.__hyd){B.hidden=false;I.focus()}},true);
I.addEventListener('input',function(){clearTimeout(t);t=setTimeout(find,220)});
I.addEventListener('keydown',function(e){if(e.key=='Enter')pick(R[0])});
B.querySelector('.searchrow>.btn').addEventListener('click',function(){pick(R[0])});
L.addEventListener('mousedown',function(e){e.preventDefault()});
L.addEventListener('click',function(e){var b=e.target.closest('button');if(b)pick(R[+b.dataset.i])});
I.addEventListener('blur',function(){if(W.__bootBlur&&!W.__boot.pick)setTimeout(function(){if(document.activeElement!==I)W.__bootBlur(I.value)},150)});
})();`;

export const BOOT_JS = JS.replace('__LOCAL__', JSON.stringify(LOCAL));
