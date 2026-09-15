(function(){let e=document.createElement(`link`).relList;if(e&&e.supports&&e.supports(`modulepreload`))return;for(let e of document.querySelectorAll(`link[rel="modulepreload"]`))n(e);new MutationObserver(e=>{for(let t of e)if(t.type===`childList`)for(let e of t.addedNodes)e.tagName===`LINK`&&e.rel===`modulepreload`&&n(e)}).observe(document,{childList:!0,subtree:!0});function t(e){let t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),t.credentials=e.crossOrigin===`use-credentials`?`include`:e.crossOrigin===`anonymous`?`omit`:`same-origin`,t}function n(e){if(e.ep)return;e.ep=!0;let n=t(e);fetch(e.href,n)}})();var e=`vert-half-v1`;function t(e){if(!e)return;let t=e.trim();if(!t)return;if(/^\d+$/.test(t))return Number(t);let n=t.split(`:`).map(e=>Number(e));if(!n.some(e=>Number.isNaN(e))){if(n.length===3)return n[0]*3600+n[1]*60+n[2];if(n.length===2)return n[0]*60+n[1]}}function n(e){if(e==null||Number.isNaN(e))return``;let t=Math.max(0,Math.floor(e)),n=Math.floor(t/3600),r=Math.floor(t%3600/60),i=t%60;return n>0?`${n}:${String(r).padStart(2,`0`)}:${String(i).padStart(2,`0`)}`:`${r}:${String(i).padStart(2,`0`)}`}function r(e,t,n){let r=(t||e||``).trim();if(r){if(n==null)return r;try{let e=new URL(r),t=e.hostname.replace(/^www\./,``);if(t===`youtu.be`||t.endsWith(`youtube.com`))return e.searchParams.set(`t`,String(Math.floor(n))),e.toString()}catch{}return`${r}${r.includes(`?`)?`&`:`?`}t=${Math.floor(n)}`}}function i(e){let t=[],n=[],r=``,i=!1,a=e.replace(/\r\n/g,`
`).replace(/\r/g,`
`);for(let e=0;e<a.length;e++){let o=a[e];i?o===`"`?a[e+1]===`"`?(r+=`"`,e++):i=!1:r+=o:o===`"`?i=!0:o===`,`?(n.push(r),r=``):o===`
`?(n.push(r),r=``,n.some(e=>e.trim()!==``)&&t.push(n),n=[]):r+=o}return n.push(r),n.some(e=>e.trim()!==``)&&t.push(n),t}function a(e,...t){let n=e.map(e=>e.trim().toLowerCase());for(let e of t){let t=n.indexOf(e.toLowerCase());if(t>=0)return t}return-1}function o(e){return e.toLowerCase().replace(/[^a-z0-9]+/g,`-`).replace(/^-|-$/g,``).slice(0,48)}function s(e){let t=e.trim();if(!t)return null;let n=t,r=n.match(/^Save\s*[—–-]\s*(.+)$/i);r&&(n=r[1].trim());let i=n.match(/^#?\s*(\d+)\s+(.+)$/);if(i){let e=i[1],t=i[2].trim();return{id:o(`${e}-${t}`),name:`#${e} ${t}`,number:e}}if(r)return{id:o(n),name:n};let a=n.match(/^#(\d+)$/);return a?{id:`num-${a[1]}`,name:`#${a[1]}`,number:a[1]}:{id:o(n),name:n}}function c(e){if(e!=null)return ne(String(e).trim())}function l(e){let t=e.toLowerCase();return/\bgoal\s*against\b/.test(t)||/\bga\b/.test(t)||/^goal\b/.test(t)||/\bscored\b/.test(t)}function u(e,n,r){let o=i(n);if(o.length<2)throw Error(`CSV has no data rows`);let u=o[0],d=a(u,`Period`),f=a(u,`Clock`),p=a(u,`Type`),m=a(u,`Detail`),ee=a(u,`Player / Goalie`,`Player`),te=a(u,`Strength`),ne=a(u,`Video Timestamp`),ie=a(u,`Clip URL`);if(p<0)throw Error(`CSV missing Type column`);let ae=r?.gameId?e.games.find(e=>e.id===r.gameId):void 0,h=ae?.id??y(`game`),g=e;if(!ae){let t=r?.opponent?.trim()||void 0,n=r?.date?.trim()||void 0,i=r?.location?.trim()||void 0;g=de(e,{id:h,label:ue({opponent:t,date:n,location:i,label:r?.gameLabel?.trim()||`Imported game ${new Date().toLocaleDateString()}`}),opponent:t,date:n,location:i,videoUrl:r?.videoUrl,createdAt:new Date().toISOString()})}let _=0,v=0,oe=[];for(let e=1;e<o.length;e++){let n=o[e],r=(n[p]??``).trim().toUpperCase();if(!r){v++;continue}if(r!==`SHOT`&&r!==`GOAL`&&r!==`OPP SHOT`){v++;continue}let i=(m>=0?n[m]:``)??``,a=(ee>=0?n[ee]:``)??``,s=d>=0?n[d]:``,l=f>=0?(n[f]??``).trim():void 0,u=c(s),ae=ne>=0?t(n[ne]):void 0,h=ie>=0&&(n[ie]??``).trim()||void 0,g=re((te>=0?n[te]:``)||i);oe.push({type:r,period:u,clock:l,detail:i,playerRaw:a,videoTs:ae,clipUrl:h,strength:g})}let se=new Set(oe.filter(e=>e.type===`GOAL`).map(e=>`${e.period}|${e.clock}|${e.playerRaw.trim()}`));for(let e of oe){if(e.type===`SHOT`){let t=`${e.period}|${e.clock}|${e.playerRaw.trim()}`;if(se.has(t)){v++;continue}}if(e.type===`SHOT`||e.type===`GOAL`){let t=s(e.playerRaw)??s(e.detail);if(!t){v++;continue}let n={id:t.id,name:t.name,number:t.number,role:`skater`};g=x(g,n);let r={id:y(`shot`),gameId:h,side:`for`,outcome:e.type===`GOAL`?`goal`:`miss`,playerId:n.id,period:e.period,strength:e.strength,clock:e.clock,detail:e.detail||void 0,videoTimestampSec:e.videoTs,clipUrl:e.clipUrl,createdAt:new Date().toISOString(),kind:`shot`};g=fe(g,r),_++}else if(e.type===`OPP SHOT`){let t=s(e.playerRaw),n=s(e.detail),r=t??n,i;if(r){let e={id:r.id,name:r.name,number:r.number,role:`goalie`};g=x(g,e),i=e.id}let a=l(e.detail)?`goal_against`:`save`,o={id:y(`shot`),gameId:h,side:`against`,outcome:a,goalieId:i,period:e.period,strength:e.strength,clock:e.clock,detail:e.detail||void 0,videoTimestampSec:e.videoTs,clipUrl:e.clipUrl,createdAt:new Date().toISOString(),kind:`shot`};g=fe(g,o),_++}}return{season:g,gameId:h,imported:_,skipped:v}}var d=[{number:`3`,name:`Carson Bader`},{number:`10`,name:`Kaden Lasota`},{number:`13`,name:`Blake Youngen`},{number:`14`,name:`Curtis Moyer`},{number:`16`,name:`Sutter Robinson`},{number:`18`,name:`Andrew Raimondi`},{number:`19`,name:`Leo Krebsbach`},{number:`71`,name:`Declan Rayner`},{number:`73`,name:`Calvin Lind`},{number:`77`,name:`Alex Poulin`},{number:`88`,name:`Boston Smith`},{number:`89`,name:`Dellas Potter`},{number:`98`,name:`Hudson Bauer`}],f=[{number:`1`,name:`Emmett Sawchuk`}];function p(e,t,n){return{id:o(`${e}-${t}`),name:`#${e} ${t}`,number:e,role:n}}var m=[...d.map(e=>p(e.number,e.name,`skater`)),...f.map(e=>p(e.number,e.name,`goalie`))];function ee(e){let t=new Map(e.map(e=>[e.id,e]));for(let e of m){let n=t.get(e.id);n?t.set(e.id,{...e,...n,role:n.role??e.role,number:n.number??e.number}):t.set(e.id,e)}let n=[...t.values()].filter(e=>!m.some(t=>t.id===e.id));return[...m.map(e=>t.get(e.id)),...n]}var te=`shotsheet-season-v1`;function ne(e){if(e===1||e===2||e===3||e===`OT`)return e;if(e===`1`||e===`2`||e===`3`)return Number(e);if(typeof e==`string`){let t=e.trim().toLowerCase();if(t===`ot`||t===`overtime`||t===`4`)return`OT`;if(t===`1`||t===`1st`)return 1;if(t===`2`||t===`2nd`)return 2;if(t===`3`||t===`3rd`)return 3}if(typeof e==`number`){if(e===1||e===2||e===3)return e;if(e===4)return`OT`}}function re(e){if(e===`EV`||e===`PP`||e===`SH`)return e;if(typeof e!=`string`)return`EV`;let t=e.trim().toUpperCase();return t===`EV`||t===`ES`||t===`EVEN`||t===`5V5`||t===`5-ON-5`?`EV`:t===`PP`||t===`POWER PLAY`||t===`POWERPLAY`||t.includes(`PP`)?`PP`:t===`SH`||t===`SHG`||t===`PK`||t===`SHORTHANDED`||t===`SHORT-HANDED`||t.includes(`SH`)?`SH`:/\bEV\b/.test(t)?`EV`:/\bPP\b/.test(t)?`PP`:/\bSH\b/.test(t)?`SH`:`EV`}function ie(e){let t=ne(e.period),n=re(e.strength);return{...e,period:t,strength:n}}function ae(e,t){return e>=.5?{x:t,y:2*(1-e)}:{x:t,y:2*e}}function h(t){return t.coordSpace===e}function g(t){if(h(t))return t;let n=t.shots.map(e=>{if(typeof e.x!=`number`||typeof e.y!=`number`)return e;let{x:t,y:n}=ae(e.x,e.y);return{...e,x:t,y:n}});return{...t,version:1,coordSpace:e,shots:n}}function _(e){return g({version:1,coordSpace:e.coordSpace,games:e.games??[],players:ee(e.players??[]),shots:(e.shots??[]).map(ie)})}function v(){return{version:1,coordSpace:e,games:[],players:ee([]),shots:[]}}function oe(){try{let e=localStorage.getItem(te);if(!e)return v();let t=JSON.parse(e);if(!t||t.version!==1)return v();let n=_(t);return h(t)||se(n),n}catch{return v()}}function se(e){localStorage.setItem(te,JSON.stringify(e))}function ce(e){return JSON.stringify(e,null,2)}function le(e){let t=JSON.parse(e);if(!t||typeof t!=`object`)throw Error(`Invalid season JSON`);return _({version:1,coordSpace:t.coordSpace,games:Array.isArray(t.games)?t.games:[],players:Array.isArray(t.players)?t.players:[],shots:Array.isArray(t.shots)?t.shots:[]})}function y(e=`id`){return`${e}_${Math.random().toString(36).slice(2,10)}_${Date.now().toString(36)}`}function b(e){let t=[],n=e.opponent?.trim();n&&t.push(`vs ${n}`);let r=e.date?.trim();r&&t.push(r);let i=e.location?.trim();return i&&t.push(i),t.length?t.join(` · `):e.label?.trim()||`Untitled game`}function ue(e){return b({id:``,label:e.label??``,opponent:e.opponent,date:e.date,location:e.location,createdAt:``})}function x(e,t){let n=e.players.findIndex(e=>e.id===t.id),r=[...e.players];return n>=0?r[n]={...r[n],...t}:r.push(t),{...e,players:r}}function de(e,t){let n=e.games.findIndex(e=>e.id===t.id),r=[...e.games];return n>=0?r[n]={...r[n],...t}:r.push(t),{...e,games:r}}function fe(e,t){return{...e,shots:[...e.shots,t]}}function S(e,t,n){return{...e,shots:e.shots.map(e=>e.id===t?{...e,...n}:e)}}function pe(e,t){return{...e,shots:e.shots.filter(e=>e.id!==t)}}function me(e,t){return e.shots.filter(e=>!(t.gameId!==`all`&&e.gameId!==t.gameId||t.side===`for`&&e.side!==`for`||t.side===`against`&&e.side!==`against`||t.period!==`all`&&e.period!==t.period||t.strength!==`all`&&(e.strength??`EV`)!==t.strength||t.playerId!==`all`&&e.side===`for`&&e.playerId!==t.playerId||t.playerId!==`all`&&e.side===`against`||t.goalieId!==`all`&&e.side===`against`&&e.goalieId!==t.goalieId||t.goalieId!==`all`&&e.side===`for`||t.outcome!==`all`&&e.outcome!==t.outcome))}function he(){return{gameId:`all`,playerId:`all`,goalieId:`all`,side:`both`,period:`all`,strength:`all`,outcome:`all`}}function C(e){return e==null?`?`:e===`OT`?`OT`:String(e)}function ge(e){return e??`EV`}function _e(e){let t={EV:0,PP:0,SH:0};for(let n of e){let e=n.strength??`EV`;t[e]++}return t}function ve(e,t,n){let r=e.getContext(`2d`);if(!r)return;let i=e.width,a=e.height;r.clearRect(0,0,i,a);let o=t.filter(e=>typeof e.x==`number`&&typeof e.y==`number`&&e.x>=0&&e.y>=0);if(o.length===0)return;let s=n?.radius??Math.max(24,Math.min(i,a)*.06),c=n?.maxAlpha??.72,l=document.createElement(`canvas`);l.width=i,l.height=a;let u=l.getContext(`2d`);if(!u)return;for(let e of o){let t=e.x*i,n=e.y*a,r=u.createRadialGradient(t,n,0,t,n,s);r.addColorStop(0,`rgba(0,0,0,0.35)`),r.addColorStop(.45,`rgba(0,0,0,0.12)`),r.addColorStop(1,`rgba(0,0,0,0)`),u.fillStyle=r,u.beginPath(),u.arc(t,n,s,0,Math.PI*2),u.fill()}let d=u.getImageData(0,0,i,a).data,f=0;for(let e=3;e<d.length;e+=4)d[e]>f&&(f=d[e]);if(f===0)return;let p=r.createImageData(i,a);for(let e=0;e<d.length;e+=4){let t=d[e+3]/f;if(t<=.02)continue;let{r:n,g:r,b:i}=ye(t);p.data[e]=n,p.data[e+1]=r,p.data[e+2]=i,p.data[e+3]=Math.floor(c*Math.min(1,t*1.15)*255)}r.putImageData(p,0,0)}function ye(e){let t=Math.max(0,Math.min(1,e));if(t<.25){let e=t/.25;return{r:0,g:Math.floor(80+100*e),b:Math.floor(180+50*e)}}if(t<.5){let e=(t-.25)/.25;return{r:Math.floor(40*e),g:Math.floor(180+50*e),b:Math.floor(230-180*e)}}if(t<.75){let e=(t-.5)/.25;return{r:Math.floor(40+215*e),g:Math.floor(230-30*e),b:Math.floor(50*(1-e))}}let n=(t-.75)/.25;return{r:255,g:Math.floor(200*(1-n)),b:0}}function be(e){let t=e.filter(e=>e.side===`for`),n=t.filter(e=>e.outcome===`goal`).length,r=t.filter(e=>e.outcome===`miss`).length,i=n+r;return{shots:i,goals:n,misses:r,shootingPct:i?n/i*100:0}}function xe(e){let t=e.filter(e=>e.side===`against`),n=t.filter(e=>e.outcome===`save`).length,r=t.filter(e=>e.outcome===`goal_against`).length,i=n+r;return{shotsAgainst:i,saves:n,goalsAgainst:r,savePct:i?n/i*100:0}}function Se(e,t){let n=new Map;for(let e of t)e.side===`for`&&e.playerId&&(n.has(e.playerId)||n.set(e.playerId,[]),n.get(e.playerId).push(e));let r=[];for(let[t,i]of n){let n=e.players.find(e=>e.id===t)??{id:t,name:t};r.push({player:n,stats:be(i)})}return r.sort((e,t)=>t.stats.shots-e.stats.shots),r}function Ce(e,t){let n=new Map;for(let e of t)e.side===`against`&&e.goalieId&&(n.has(e.goalieId)||n.set(e.goalieId,[]),n.get(e.goalieId).push(e));let r=[];for(let[t,i]of n){let n=e.players.find(e=>e.id===t)??{id:t,name:t};r.push({player:n,stats:xe(i)})}return r.sort((e,t)=>t.stats.shotsAgainst-e.stats.shotsAgainst),r}var we=null;function w(e){if(!e)return null;let t=e.trim();if(!t)return null;try{let e=new URL(t),n=e.hostname.replace(/^www\./,``);if(n===`youtu.be`){let t=e.pathname.split(`/`).filter(Boolean)[0];return t&&/^[\w-]{6,}$/.test(t)?t:null}if(n.endsWith(`youtube.com`)||n.endsWith(`youtube-nocookie.com`)){if(e.pathname.startsWith(`/embed/`)||e.pathname.startsWith(`/shorts/`)){let t=e.pathname.split(`/`).filter(Boolean)[1];return t&&/^[\w-]{6,}$/.test(t)?t:null}let t=e.searchParams.get(`v`);if(t&&/^[\w-]{6,}$/.test(t))return t}}catch{}return t.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|shorts\/|watch\?.*?v=))([\w-]{6,})/)?.[1]??null}function Te(){return typeof window>`u`?Promise.reject(Error(`no window`)):window.YT?.Player?Promise.resolve():we||(we=new Promise((e,t)=>{let n=window.onYouTubeIframeAPIReady;if(window.onYouTubeIframeAPIReady=()=>{try{n?.()}catch{}e()},document.querySelector(`script[data-yt-iframe-api]`)){let n=Date.now(),r=()=>{if(window.YT?.Player){e();return}if(Date.now()-n>2e4){t(Error(`YouTube IFrame API timeout`));return}requestAnimationFrame(r)};r();return}let r=document.createElement(`script`);r.src=`https://www.youtube.com/iframe_api`,r.async=!0,r.dataset.ytIframeApi=`1`,r.onerror=()=>{we=null,t(Error(`Failed to load YouTube IFrame API`))},document.head.appendChild(r),window.setTimeout(()=>{window.YT?.Player||(we=null,t(Error(`YouTube IFrame API timeout`)))},2e4)}),we)}function Ee(e){return{getCurrentTime(){try{let t=e?.getCurrentTime?.();return typeof t==`number`&&!Number.isNaN(t)?t:0}catch{return 0}},pause(){try{e?.pauseVideo?.()}catch{}},play(){try{e?.playVideo?.()}catch{}},seekTo(t){try{e?.seekTo?.(Math.max(0,t),!0)}catch{}},destroy(){try{e?.destroy?.()}catch{}},getVideoData(){try{return e?.getVideoData?.()??{}}catch{return{}}}}}async function De(e,t,n={}){if(await Te(),!window.YT?.Player)throw Error(`YouTube API unavailable`);let r=n.origin||(typeof location<`u`?location.origin:void 0);return new Promise((i,a)=>{let o=!1,s=null;try{e.innerHTML=``;let c=document.createElement(`div`);e.appendChild(c);let l=new window.YT.Player(c,{videoId:t,width:`100%`,height:`100%`,playerVars:{enablejsapi:1,origin:r,playsinline:1,rel:0,modestbranding:1,controls:1,fs:1},events:{onReady:()=>{s=Ee(l),o=!0,n.onReady?.(s),i(s)},onError:e=>{let t=e?.data??-1;n.onError?.(t),o||(o=!0,a(Error(`YouTube player error ${t}`)))}}})}catch(e){a(e instanceof Error?e:Error(String(e)))}})}var Oe=`/ShotSheet/`,ke=`shotsheet-active-game`,Ae=document.querySelector(`#app`),T=oe(),E=he(),je=`our_shot`,D=`place`,O=1,k=`EV`,A=null,j=null,M=null,N=!1,Me=!0,P=!1,F=!1,I=!1,L=null,Ne,R=`home`,z=null,B=null,Pe=!0,Fe=`our_shot`,V=null,Ie=null,H=0,U=!1,W=null,Le=0;function Re(){try{let e=localStorage.getItem(ke);return!e||!T.games.some(t=>t.id===e)?null:e}catch{return null}}z=Re(),z&&(E={...E,gameId:z});function G(e){if(z=e,e){E={...E,gameId:e};try{localStorage.setItem(ke,e)}catch{}}else try{localStorage.removeItem(ke)}catch{}}function K(e){R=e,I=!1,e===`chart`&&z&&(E={...E,gameId:z}),e===`reports`&&(Me||=!0,P=!0),$()}function q(){T=g(T),se(T)}function J(e,t=`ok`){let n=document.createElement(`div`);n.className=`toast${t===`error`?` error`:``}`,n.textContent=e,document.body.appendChild(n),window.clearTimeout(Ne),Ne=window.setTimeout(()=>n.remove(),3200)}function ze(e){switch(e){case`our_shot`:return{side:`for`,outcome:`miss`,label:`Our shot`};case`our_goal`:return{side:`for`,outcome:`goal`,label:`Our goal`};case`opp_shot`:return{side:`against`,outcome:`save`,label:`Opp shot`};case`opp_goal`:return{side:`against`,outcome:`goal_against`,label:`Opp goal`}}}function Be(){return document.getElementById(`yt-host`)}function Ve(){let e=Be();if(e){if(V)try{H=V.getCurrentTime()}catch{}e.parentElement!==document.body&&document.body.appendChild(e)}}function He(){try{V?.destroy()}catch{}V=null,Ie=null;let e=Be();e&&(e.innerHTML=``)}function Ue(){let e=Be();e&&(e.hidden=!0,e.parentElement!==document.body&&document.body.appendChild(e))}async function We(e){let t=Be(),n=document.getElementById(`yt-slot`),r=document.getElementById(`film-fallback`);if(!t||!n){Ue();return}n.appendChild(t);let i=w(e);if(!i){if(He(),t.hidden=!0,W=e?.trim()?`Could not parse a YouTube video id from this URL.`:`No game film URL set. Add a YouTube URL in Settings.`,r){r.hidden=!1;let e=r.querySelector(`.film-fallback-msg`);e&&(e.textContent=W)}return}if(V&&Ie===i){t.hidden=!1,W=null,r&&(r.hidden=!0),U&&=(V.pause(),!1);return}let a=++Le;if(He(),t.hidden=!1,r){r.hidden=!1;let e=r.querySelector(`.film-fallback-msg`);e&&(e.textContent=`Loading YouTube player…`)}try{let e=await De(t,i,{origin:typeof location<`u`?location.origin:void 0,onReady:e=>{H>0&&e.seekTo(H),U&&=(e.pause(),!1)},onError:e=>{W=`YouTube embed failed (error ${e}). Use Open clip instead.`;let t=document.getElementById(`film-fallback`);if(t){t.hidden=!1;let e=t.querySelector(`.film-fallback-msg`);e&&(e.textContent=W)}}});if(a!==Le){e.destroy();return}V=e,Ie=i,W=null,r&&(r.hidden=!0)}catch(e){if(a!==Le)return;if(V=null,Ie=null,W=e instanceof Error?e.message:String(e),t.hidden=!0,r){r.hidden=!1;let e=r.querySelector(`.film-fallback-msg`);e&&(e.textContent=W+` — use Open clip fallback.`)}}}function Ge(e){if(!V)return null;try{V.pause();let t=V.getCurrentTime();return e&&(t=Math.max(0,t-4),V.seekTo(t)),H=t,U=!0,t}catch{return null}}function Ke(e,t=!1){if(!z){J(`Select a game first`,`error`);return}Fe=e;let r=ze(e),i=!t&&Pe,a=document.querySelector(`.live-strength button.active`)?.dataset.strength;(a===`EV`||a===`PP`||a===`SH`)&&(k=a);let o=document.getElementById(`plot-period`);o&&(O=Dt(o));let s=Ge(i);s??(s=0,J(`Player not ready — timestamp may be 0. Set film URL or use Open clip.`,`error`)),B={side:r.side,outcome:r.outcome,strength:k,videoTimestampSec:s,period:O,kind:e},D=`place`,P=!1,A=null,j=null,M=null,N=!1,L=null,J(`${r.label} @ ${n(s)} · ${k} · tap rink to place`),$()}function qe(){B=null,U=!1,$()}function Je(e){let t=r((z?X(z):void 0)?.videoUrl,void 0,e);if(!t){J(`Set a game film YouTube URL first`,`error`);return}window.open(t,`_blank`,`noopener,noreferrer`)}function Ye(e){D=e,A=null,M=null,N=!1,L=null,e!==`place`&&(B=null),P=e!==`place`,e===`place`&&(j=null),$()}function Xe(){return[...T.games].sort((e,t)=>{let n=e.date||e.createdAt||``;return(t.date||t.createdAt||``).localeCompare(n)})}function Ze(e){return T.shots.filter(t=>t.gameId===e).length}function Qe(){return T.players.filter(e=>e.role!==`goalie`)}function $e(){let e=T.players.filter(e=>e.role===`goalie`);if(e.length)return e;let t=new Set(T.shots.filter(e=>e.goalieId).map(e=>e.goalieId));return T.players.filter(e=>t.has(e.id))}function et(){let e=me(T,E);return E.playerId!==`all`&&E.side===`both`&&(e=T.shots.filter(e=>(E.gameId===`all`||e.gameId===E.gameId)&&(E.period===`all`||e.period===E.period)&&(E.strength===`all`||(e.strength??`EV`)===E.strength)&&(E.outcome===`all`||e.outcome===E.outcome)&&e.side===`for`&&e.playerId===E.playerId)),E.goalieId!==`all`&&E.side===`both`&&(e=T.shots.filter(e=>(E.gameId===`all`||e.gameId===E.gameId)&&(E.period===`all`||e.period===E.period)&&(E.strength===`all`||(e.strength??`EV`)===E.strength)&&(E.outcome===`all`||e.outcome===E.outcome)&&e.side===`against`&&e.goalieId===E.goalieId)),e}function Y(e){return e?T.players.find(t=>t.id===e)?.name??e:`—`}function X(e){return T.games.find(t=>t.id===e)}function Z(e){switch(e){case`goal`:return`Goal`;case`miss`:return`Miss / on-goal`;case`save`:return`Save`;case`goal_against`:return`GA`}}function Q(e){return e.replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`).replace(/"/g,`&quot;`)}function tt(){let e=new Date;return`${e.getFullYear()}-${String(e.getMonth()+1).padStart(2,`0`)}-${String(e.getDate()).padStart(2,`0`)}`}function nt(){return{opponent:document.getElementById(`game-opponent`)?.value.trim()||void 0,date:document.getElementById(`game-date`)?.value.trim()||void 0,location:document.getElementById(`game-location`)?.value.trim()||void 0,videoUrl:document.getElementById(`game-video`)?.value.trim()||void 0}}function rt(e,t){let n=[];t&&n.push({v:`all`,l:`All`});for(let e of[1,2,3,`OT`])n.push({v:String(e),l:e===`OT`?`OT`:String(e)});return n.map(t=>`<option value="${t.v}" ${String(e??``)===t.v?`selected`:``}>${t.l}</option>`).join(``)}function it(e,t){let n=[];t&&n.push({v:`all`,l:`All`});for(let e of[`EV`,`PP`,`SH`])n.push({v:e,l:e});let r=e??`EV`;return n.map(e=>`<option value="${e.v}" ${r===e.v?`selected`:``}>${e.l}</option>`).join(``)}function at(e){if(e.opponent?.trim()||e.date?.trim()||e.location?.trim())return!0;let t=e.label?.trim();return!!(t&&t!==`Untitled game`)}function ot(e,t){return{x:F?1-e:e,y:t}}function st(e,t){return{nx:F?1-e:e,ny:t}}function ct(){let e=[`rink-wrap`];return F&&e.push(`flipped`),R===`reports`?e.push(`mode-reports`):(D===`place`&&e.push(`mode-place`),D===`review`&&e.push(`mode-review`),M&&e.push(`relocating`)),e.join(` `)}function lt(e,t){let n=[];return t&&n.push({v:`all`,l:`All`}),n.push({v:`goal`,l:`Goal`},{v:`miss`,l:`Miss / on-goal`},{v:`save`,l:`Save`},{v:`goal_against`,l:`GA`}),n.map(t=>`<option value="${t.v}" ${String(e??`all`)===t.v?`selected`:``}>${t.l}</option>`).join(``)}function ut(){if(R===`home`)return`
    <header class="app-header">
      <h1>ShotSheet</h1>
      <nav class="app-nav">
        <button type="button" data-screen="home" class="active">Home</button>
        <button type="button" data-screen="chart">Chart</button>
        <button type="button" data-screen="reports">Reports</button>
      </nav>
    </header>`;let e=R===`chart`&&z?X(z):void 0;return`
    <header class="app-header app-header-inner">
      <button type="button" class="back-home" data-screen="home" aria-label="Back to Home">←</button>
      <h1>ShotSheet</h1>
      ${e?`<span class="header-game">${Q(b(e))}</span>`:``}
    </header>`}function dt(e=`json-file`){return`
            <div class="row">
              <button type="button" class="ghost" data-action="export-json">Export JSON</button>
            </div>
            <label class="field">Import JSON
              <input type="file" id="${e}" class="json-file-input" accept=".json,application/json" />
            </label>
            <p class="hint">Season stored in <code>localStorage</code>. On iPad, use the native file control (not a hidden button). After a deploy, hard-refresh or delete &amp; re-add the Home Screen icon if the PWA looks stale.</p>`}function ft(e){let t=be(e),n=xe(e),r=_e(e);return`
          <div class="stats-grid">
            <div class="stat-card"><div class="label">Shots for</div><div class="value">${t.shots}</div></div>
            <div class="stat-card"><div class="label">Goals</div><div class="value">${t.goals}</div></div>
            <div class="stat-card"><div class="label">Shooting %</div><div class="value">${t.shootingPct.toFixed(1)}%</div></div>
            <div class="stat-card"><div class="label">SA</div><div class="value">${n.shotsAgainst}</div></div>
            <div class="stat-card"><div class="label">Saves</div><div class="value">${n.saves}</div></div>
            <div class="stat-card"><div class="label">GA / Sv%</div><div class="value">${n.goalsAgainst} / ${n.savePct.toFixed(0)}%</div></div>
          </div>
          <p class="hint" style="margin-top:0.5rem">Strength (filtered): EV ${r.EV} · PP ${r.PP} · SH ${r.SH}</p>
          <div class="breakdown" style="margin-top:0.65rem">
            <table>
              <thead><tr><th>Player</th><th>S</th><th>G</th><th>%</th></tr></thead>
              <tbody>
                ${Se(T,e).map(({player:e,stats:t})=>`<tr><td>${Q(e.name)}</td><td>${t.shots}</td><td>${t.goals}</td><td>${t.shootingPct.toFixed(0)}%</td></tr>`).join(``)||`<tr><td colspan="4">No for shots</td></tr>`}
              </tbody>
            </table>
            <table style="margin-top:0.5rem">
              <thead><tr><th>Goalie</th><th>SA</th><th>Sv</th><th>GA</th></tr></thead>
              <tbody>
                ${Ce(T,e).map(({player:e,stats:t})=>`<tr><td>${Q(e.name)}</td><td>${t.shotsAgainst}</td><td>${t.saves}</td><td>${t.goalsAgainst}</td></tr>`).join(``)||`<tr><td colspan="4">No against shots</td></tr>`}
              </tbody>
            </table>
          </div>`}function pt(e,t){let n=R===`reports`?`Reports — heatmap overview`:D===`place`?`Click to place shot`:M?`Click rink to re-place shot`:`Review — click marker to select`;return`
        <div class="toolbar-rink">
          <span class="status-pill">${Q(e)}</span>
          <button type="button" class="ghost ${F?`active-flip`:``}" data-action="flip-attack" title="Horizontal mirror of this half (attacking the other end)">Attacking other end</button>
          <label class="row" style="gap:0.35rem;font-size:0.8rem;color:var(--muted)">
            <input type="checkbox" id="tog-heat" ${Me?`checked`:``} /> Heatmap
          </label>
          <label class="row" style="gap:0.35rem;font-size:0.8rem;color:var(--muted)">
            <input type="checkbox" id="tog-markers" ${P?`checked`:``} /> Show markers
          </label>
          <span class="spacer"></span>
          ${t}
        </div>

        <div class="${ct()}" id="rink-wrap" title="${n}">
          <div class="rink-stage" id="rink-stage">
            <img class="rink" id="rink-img" src="${Oe}rink-half-vert.jpg" alt="Hockey rink (attack half, goal at top)" draggable="false" />
          </div>
          <canvas class="heat" id="heat-canvas"></canvas>
          <div class="markers" id="markers"></div>
          ${L&&L.length>1&&R===`chart`?`<div class="stack-picker" id="stack-picker">
                  <div class="stack-picker-title">Overlapping shots — pick one</div>
                  ${L.map(e=>{let t=e.side===`for`?Y(e.playerId):Y(e.goalieId);return`<button type="button" data-pick="${e.id}">${Q(Z(e.outcome))} · ${Q(t)} · P${C(e.period)}</button>`}).join(``)}
                  <button type="button" class="ghost" data-action="close-picker">Cancel</button>
                </div>`:``}
        </div>

        <div class="legend">
          <span><i class="swatch goal"></i> Goal</span>
          <span><i class="swatch miss"></i> Miss / on-goal</span>
          <span><i class="swatch save"></i> Save</span>
          <span><i class="swatch ga"></i> Goal against</span>
        </div>`}function $(){let e=document.getElementById(`review-list`)?.scrollTop;if(Ve(),R===`home`?(Ue(),mt()):R===`reports`?(Ue(),gt()):vt(),kt(),(R===`chart`||R===`reports`)&&yt(et()),e!=null&&R===`chart`){let t=document.getElementById(`review-list`);t&&(t.scrollTop=e)}R===`chart`&&z?We(X(z)?.videoUrl):Ue()}function mt(){let e=Xe();Ae.innerHTML=`
    ${ut()}
    <div class="home-layout">
      <section class="panel">
        <h2>Games</h2>
        ${e.length===0?`<p class="hint">No games yet. Create one to start charting shots.</p>`:`<div class="game-list">
              ${e.map(e=>{let t=Ze(e.id);return`<button type="button" class="game-row ${e.id===z?`active`:``}" data-open-game="${e.id}">
                    <div class="game-row-title">${Q(b(e))}</div>
                    <div class="meta">${t} shot${t===1?``:`s`}</div>
                  </button>`}).join(``)}
            </div>`}
      </section>
      <div class="stack">
        <section class="panel">
          <h2>Create new game</h2>
          <p class="hint">Our roster is always us. Opponent is the other team only.</p>
          <div class="stack">
            <label class="field">Opponent
              <input type="text" id="create-opponent" placeholder="e.g. Rangers" />
            </label>
            <label class="field">Date
              <input type="date" id="create-date" value="${tt()}" />
            </label>
            <label class="field">Location
              <input type="text" id="create-location" placeholder="Rink / city" />
            </label>
            <label class="field">Film URL (YouTube)
              <input type="url" id="create-video" placeholder="https://www.youtube.com/watch?v=…" />
            </label>
            <button type="button" class="primary" data-action="create-game">Create game</button>
          </div>
        </section>
        <section class="panel">
          <h2>Season</h2>
          <div class="stack">
            ${dt()}
          </div>
        </section>
      </div>
    </div>
  `}function ht(){Ae.innerHTML=`
    ${ut()}
    <section class="panel empty-state">
      <h2>No game selected</h2>
      <p class="hint">Chart is for one game at a time. Pick a past game or create one on Home.</p>
      <div class="row">
        <button type="button" class="primary" data-screen="home">Go to Home</button>
      </div>
    </section>
  `}function gt(){let e=et(),t=e.filter(e=>e.x!=null).length,n=E.gameId===`all`?void 0:X(E.gameId),r=n?b(n):`All games`;Ae.innerHTML=`
    ${ut()}
    <div class="layout">
      <aside>
        <section class="panel">
          <h2>Filters</h2>
          <div class="stack">
            <label class="field">Game
              <select id="filter-game">
                <option value="all" ${E.gameId===`all`?`selected`:``}>All games</option>
                ${Xe().map(e=>`<option value="${e.id}" ${E.gameId===e.id?`selected`:``}>${Q(b(e))}</option>`).join(``)}
              </select>
            </label>
            <label class="field">Period
              <select id="filter-period">
                ${rt(E.period,!0)}
              </select>
            </label>
            <label class="field">Strength
              <select id="filter-strength">
                ${it(E.strength,!0)}
              </select>
            </label>
            <label class="field">For / against
              <select id="filter-side">
                <option value="both" ${E.side===`both`?`selected`:``}>Both</option>
                <option value="for" ${E.side===`for`?`selected`:``}>For</option>
                <option value="against" ${E.side===`against`?`selected`:``}>Against</option>
              </select>
            </label>
            <label class="field">Player (for)
              <select id="filter-player">
                <option value="all">All players</option>
                ${Qe().map(e=>`<option value="${e.id}" ${E.playerId===e.id?`selected`:``}>${Q(e.name)}</option>`).join(``)}
              </select>
            </label>
            <label class="field">Outcome
              <select id="filter-outcome">
                ${lt(E.outcome,!0)}
              </select>
            </label>
          </div>
        </section>
        ${n?`
        <section class="panel">
          <h2>This game</h2>
          <p class="game-lock">${Q(r)}</p>
          <div class="row" style="margin-top:0.65rem">
            <button type="button" class="primary" data-action="reports-open-chart">Open in Chart</button>
          </div>
        </section>
        `:``}
      </aside>
      <main class="reports-main">
        ${pt(`${t} placed · ${e.length} events · ${r}`,``)}
        <section class="panel" style="margin-top:0.85rem">
          <h2>Overview</h2>
          ${ft(e)}
        </section>
      </main>
    </div>
  `}function _t(e){return I?`
    <div class="settings-backdrop" data-action="close-settings" role="presentation">
      <div class="settings-modal panel" role="dialog" aria-labelledby="settings-title" data-settings-panel>
        <div class="settings-modal-head">
          <h2 id="settings-title">Settings</h2>
          <button type="button" class="ghost" data-action="close-settings" aria-label="Close">✕</button>
        </div>
        <div class="stack">
          <label class="field">Opponent
            <input type="text" id="game-opponent" placeholder="e.g. Rangers" value="${Q(e.opponent??``)}" />
          </label>
          <label class="field">Date
            <input type="date" id="game-date" value="${Q(e.date??``)}" />
          </label>
          <label class="field">Location
            <input type="text" id="game-location" placeholder="Rink / city" value="${Q(e.location??``)}" />
          </label>
          <label class="field">Game film URL (YouTube)
            <input type="url" id="game-video" placeholder="https://www.youtube.com/watch?v=…" value="${Q(e.videoUrl??``)}" />
          </label>
          <div class="row">
            <button type="button" class="primary" data-action="save-game">Save</button>
            <button type="button" class="ghost" data-action="close-settings">Cancel</button>
          </div>
          <h2>Import</h2>
          <p class="hint">Native file controls — iPad Safari / Home Screen cannot open a hidden file input.</p>
          <label class="field">CSV import
            <input type="file" id="csv-file-settings" class="csv-file-input" accept=".csv,text/csv" />
          </label>
          <label class="field">Import JSON
            <input type="file" id="json-file-settings" class="json-file-input" accept=".json,application/json" />
          </label>
        </div>
      </div>
    </div>`:``}function vt(){if(!z||!X(z)){ht();return}E={...E,gameId:z};let e=et(),t=T.shots.filter(e=>e.gameId===z&&(E.period===`all`||e.period===E.period)&&(E.strength===`all`||(e.strength??`EV`)===E.strength)&&(typeof e.x!=`number`||typeof e.y!=`number`)),r=X(z),i=j?T.shots.find(e=>e.id===j):void 0,a=e.filter(e=>typeof e.x==`number`&&typeof e.y==`number`),o=e.filter(e=>e.x!=null).length,s=!at(r)&&!I,c=D===`place`?A?`<button type="button" class="primary" data-action="cancel-place">Placing — click rink (cancel)</button>`:`<button type="button" class="ghost" data-action="new-at-click">New shot on next click</button>`:``,l=D===`place`?`
        <section class="panel detail-card">
          <h2>Selected / clip</h2>
          ${i?`
            <div class="title">${Q(Z(i.outcome))} — ${Q(i.side===`for`?Y(i.playerId):Y(i.goalieId))}</div>
            <div class="meta" style="color:var(--muted);margin-bottom:0.5rem">
              ${i.side} · P${C(i.period)} ${i.clock??``} · ${ge(i.strength)} ·
              ${i.x==null?`unplaced`:`xy (${i.x.toFixed(2)}, ${i.y.toFixed(2)})`}
            </div>
            <label class="field">Video timestamp (H:MM:SS or seconds)
              <input type="text" id="shot-ts" value="${Q(n(i.videoTimestampSec))}" />
            </label>
            <div class="row" style="margin-top:0.5rem">
              <button type="button" class="primary" data-action="open-clip" data-shot="${i.id}">Open clip</button>
              <button type="button" data-action="save-shot-ts" data-shot="${i.id}">Save timestamp</button>
              <button type="button" class="danger" data-action="delete-shot" data-shot="${i.id}">Delete</button>
            </div>
          `:`<p class="hint">Select an unplaced row or place a new shot.</p>`}
        </section>
        <section class="panel">
          <h2>Unplaced (${t.length})</h2>
          <div class="unplaced" id="unplaced-list">
            ${t.length===0?`<p class="hint">None — import a CSV or add a new shot.</p>`:t.map(e=>{let t=e.side===`for`?Y(e.playerId):`vs ${Y(e.goalieId)}`;return`<div class="unplaced-item ${A===e.id?`active`:``}" data-place="${e.id}">
                        <div>
                          <div>${Q(Z(e.outcome))} · ${Q(t)}</div>
                          <div class="meta">P${C(e.period)} ${e.clock??``} · ${ge(e.strength)} · ${e.side}${e.videoTimestampSec==null?``:` · t=${n(e.videoTimestampSec)}`}</div>
                        </div>
                        <button type="button" data-place="${e.id}">Place</button>
                      </div>`}).join(``)}
          </div>
        </section>`:i?`
      <section class="panel detail-card">
        <h2>Selected / clip</h2>
        <div class="title">${Q(Z(i.outcome))} — ${Q(i.side===`for`?Y(i.playerId):Y(i.goalieId))}</div>
        <div class="meta" style="color:var(--muted);margin-bottom:0.5rem">
          ${i.side} · P${C(i.period)} ${i.clock??``} · ${ge(i.strength)} ·
          ${i.x==null?`unplaced`:`xy (${i.x.toFixed(2)}, ${i.y.toFixed(2)})`}
        </div>
        <label class="field">Video timestamp (H:MM:SS or seconds)
          <input type="text" id="shot-ts" value="${Q(n(i.videoTimestampSec))}" />
        </label>
        <div class="row" style="margin-top:0.5rem">
          <button type="button" class="primary" data-action="open-clip" data-shot="${i.id}">Open clip</button>
          <button type="button" data-action="save-shot-ts" data-shot="${i.id}">Save timestamp</button>
          <button type="button" class="${N?`primary`:``}" data-action="toggle-review-edit">${N?`Done editing`:`Edit`}</button>
          <button type="button" class="danger" data-action="delete-shot" data-shot="${i.id}">Delete</button>
        </div>
        ${N?`
        <div class="stack" style="margin-top:0.75rem;padding-top:0.65rem;border-top:1px solid var(--line)">
          <label class="field">Side
            <select id="edit-side">
              <option value="for" ${i.side===`for`?`selected`:``}>For</option>
              <option value="against" ${i.side===`against`?`selected`:``}>Against</option>
            </select>
          </label>
          <label class="field">Period
            <select id="edit-period">
              ${rt(i.period??O,!1)}
            </select>
          </label>
          <label class="field">Strength
            <select id="edit-strength">
              ${it(i.strength??`EV`,!1)}
            </select>
          </label>
          <label class="field">Outcome
            <select id="edit-outcome">
              ${i.side===`for`?`<option value="goal" ${i.outcome===`goal`?`selected`:``}>Goal</option>
                     <option value="miss" ${i.outcome===`miss`?`selected`:``}>Miss / on-goal</option>`:`<option value="save" ${i.outcome===`save`?`selected`:``}>Save</option>
                     <option value="goal_against" ${i.outcome===`goal_against`?`selected`:``}>Goal against</option>`}
            </select>
          </label>
          ${i.side===`for`?`<label class="field">Player
                  <select id="edit-player">
                    ${Qe().map(e=>`<option value="${e.id}" ${i.playerId===e.id?`selected`:``}>${Q(e.name)}</option>`).join(``)}
                  </select>
                </label>`:`<label class="field">Goalie
                  <select id="edit-goalie">
                    ${$e().map(e=>`<option value="${e.id}" ${i.goalieId===e.id?`selected`:``}>${Q(e.name)}</option>`).join(``)}
                  </select>
                </label>`}
          <div class="row">
            <button type="button" class="primary" data-action="save-edit">Save fields</button>
            <button type="button" data-action="re-place" class="${M===i.id?`primary`:``}">${M===i.id?`Click rink…`:`Re-place`}</button>
            <button type="button" class="danger" data-action="delete-shot" data-shot="${i.id}">Delete</button>
          </div>
        </div>
        `:``}
      </section>`:`
        <section class="panel detail-card">
          <h2>Selected / clip</h2>
          <p class="hint">Select a shot from the list or click a marker on the rink.</p>
        </section>`;Ae.innerHTML=`
    ${ut()}
    <div class="chart-page">
      <div class="mode-bar">
        <div class="mode-toggle">
          <button type="button" data-action="ui-mode" data-mode="place" class="${D===`place`?`active`:``}">Place</button>
          <button type="button" data-action="ui-mode" data-mode="review" class="${D===`review`?`active`:``}">Review</button>
        </div>
      </div>

      <div class="player-band">
        <div class="live-side our" aria-label="Our marks">
          <button type="button" class="live-big our-shot" data-action="live-mark" data-kind="our_shot">Our shot</button>
          <button type="button" class="live-big our-goal" data-action="live-mark" data-kind="our_goal">Our goal</button>
        </div>
        <div class="film-center">
          <div class="film-aspect">
            <div id="yt-slot"></div>
            <div class="film-fallback" id="film-fallback" ${w(r.videoUrl)&&!W?`hidden`:``}>
              <p class="film-fallback-msg">${Q(W||(r.videoUrl?`Loading player…`:`No YouTube URL — open Settings to add film.`))}</p>
              <button type="button" class="primary" data-action="open-film-fallback">Open clip at t=${n(H||0)}</button>
            </div>
          </div>
        </div>
        <div class="live-side opp" aria-label="Opponent marks">
          <button type="button" class="live-big opp-shot" data-action="live-mark" data-kind="opp_shot">Opp shot</button>
          <button type="button" class="live-big opp-goal" data-action="live-mark" data-kind="opp_goal">Opp goal</button>
        </div>
      </div>

      <div class="strength-band">
        <div class="live-strength mode-toggle three" role="group" aria-label="Strength">
          <button type="button" data-action="live-strength" data-strength="EV" class="${k===`EV`?`active`:``}">EV</button>
          <button type="button" data-action="live-strength" data-strength="PP" class="${k===`PP`?`active`:``}">PP</button>
          <button type="button" data-action="live-strength" data-strength="SH" class="${k===`SH`?`active`:``}">SH</button>
        </div>
        <label class="live-rewind"><input type="checkbox" id="live-rewind" ${Pe?`checked`:``} /> Rewind 4s</label>
        <button type="button" class="ghost" data-action="live-mark-now" title="Stamp current time without rewind">Mark at current time</button>
        <button type="button" class="ghost" data-action="open-film-fallback">Open clip</button>
        ${D===`place`?`<label class="field sticky-period strength-period">Period
                <select id="plot-period">${rt(O,!1)}</select>
              </label>`:``}
      </div>

      ${B?`<div class="live-pending-banner">
              <strong>Place ${Q(ze(B.kind).label)}</strong>
              <span class="meta">t=${n(B.videoTimestampSec)} · P${C(B.period)} · ${B.strength}</span>
              <div class="live-place-fields">
                ${B.side===`for`?`<label class="field">Player
                        <select id="live-place-player">
                          ${Qe().map(e=>`<option value="${e.id}">${Q(e.name)}</option>`).join(``)||`<option value="">Add player</option>`}
                        </select>
                      </label>
                      <label class="field">New player
                        <input type="text" id="live-new-player" placeholder="#99 Name" />
                      </label>`:`<label class="field">Our goalie
                        <select id="live-place-goalie">
                          ${$e().map(e=>`<option value="${e.id}">${Q(e.name)}</option>`).join(``)||`<option value="">Add goalie</option>`}
                        </select>
                      </label>
                      <label class="field">New goalie
                        <input type="text" id="live-new-goalie" placeholder="#1 Name" />
                      </label>`}
              </div>
              <span>Tap rink to place</span>
              <button type="button" class="ghost" data-action="cancel-live-pending">Cancel</button>
            </div>`:``}

      <div class="chart-below">
        <div class="chart-details">
          ${s?`
          <section class="panel">
            <h2>Game details</h2>
            <div class="stack">
              <label class="field">Opponent
                <input type="text" id="game-opponent" placeholder="e.g. Rangers" value="${Q(r.opponent??``)}" />
              </label>
              <label class="field">Date
                <input type="date" id="game-date" value="${Q(r.date??``)}" />
              </label>
              <label class="field">Location
                <input type="text" id="game-location" placeholder="Rink / city" value="${Q(r.location??``)}" />
              </label>
              <label class="field">Game film URL (YouTube)
                <input type="url" id="game-video" placeholder="https://www.youtube.com/watch?v=…" value="${Q(r.videoUrl??``)}" />
              </label>
              <button type="button" data-action="save-game">Save</button>
            </div>
          </section>`:``}

          ${D===`place`?`
          <section class="panel">
            <h2>Plot</h2>
            <div class="mode-toggle">
              <button type="button" data-action="mode" data-mode="our_shot" class="${je===`our_shot`?`active`:``}">Our shot</button>
              <button type="button" data-action="mode" data-mode="shot_against" class="${je===`shot_against`?`active`:``}">Shot against</button>
            </div>
            <div class="stack" style="margin-top:0.65rem">
              <label class="field sticky-period">Strength
                <select id="plot-strength">
                  ${it(k,!1)}
                </select>
              </label>
              ${je===`our_shot`?`
                <label class="field">Player
                  <select id="plot-player">
                    ${Qe().map(e=>`<option value="${e.id}">${Q(e.name)}</option>`).join(``)||`<option value="">Add via CSV / new</option>`}
                  </select>
                </label>
                <label class="field">Outcome
                  <select id="plot-outcome">
                    <option value="goal">Goal</option>
                    <option value="miss" selected>Miss / on-goal</option>
                  </select>
                </label>
                <label class="field">New player (optional)
                  <input type="text" id="new-player" placeholder="#99 Name" />
                </label>
              `:`
                <label class="field">Our goalie
                  <select id="plot-goalie">
                    ${$e().map(e=>`<option value="${e.id}">${Q(e.name)}</option>`).join(``)||`<option value="">Add via CSV / new</option>`}
                  </select>
                </label>
                <label class="field">Outcome
                  <select id="plot-outcome">
                    <option value="save" selected>Save</option>
                    <option value="goal_against">Goal against</option>
                  </select>
                </label>
                <label class="field">New goalie (optional)
                  <input type="text" id="new-goalie" placeholder="#1 Name" />
                </label>
              `}
            </div>
          </section>
          `:``}

          <section class="panel">
            <h2>Filters</h2>
            <div class="stack">
              <label class="field">Period
                <select id="filter-period">
                  ${rt(E.period,!0)}
                </select>
              </label>
              <label class="field">Strength
                <select id="filter-strength">
                  ${it(E.strength,!0)}
                </select>
              </label>
              <label class="field">Side
                <select id="filter-side">
                  <option value="both" ${E.side===`both`?`selected`:``}>Both</option>
                  <option value="for" ${E.side===`for`?`selected`:``}>For</option>
                  <option value="against" ${E.side===`against`?`selected`:``}>Against</option>
                </select>
              </label>
              <label class="field">Player (for)
                <select id="filter-player">
                  <option value="all">All players</option>
                  ${Qe().map(e=>`<option value="${e.id}" ${E.playerId===e.id?`selected`:``}>${Q(e.name)}</option>`).join(``)}
                </select>
              </label>
              <label class="field">Goalie (against)
                <select id="filter-goalie">
                  <option value="all">All goalies</option>
                  ${$e().map(e=>`<option value="${e.id}" ${E.goalieId===e.id?`selected`:``}>${Q(e.name)}</option>`).join(``)}
                </select>
              </label>
            </div>
          </section>

          ${D===`review`?`
          <section class="panel">
            <h2>Shot list (${a.length})</h2>
            <div class="shot-list" id="review-list">
              ${a.length===0?`<p class="hint">No placed shots for current filters.</p>`:a.map(e=>{let t=e.side===`for`?Y(e.playerId):`vs ${Y(e.goalieId)}`,r=j===e.id?`active`:``,i=e.clipUrl||e.videoTimestampSec!=null?`<button type="button" class="ghost small" data-action="open-clip" data-shot="${e.id}">Clip</button>`:``;return`<div class="shot-row ${r}" data-review="${e.id}">
                          <div class="shot-row-main">
                            <div>${Q(Z(e.outcome))} · ${Q(t)}</div>
                            <div class="meta">P${C(e.period)} ${e.clock??``} · ${ge(e.strength)} · ${e.side}${e.videoTimestampSec==null?``:` · t=${n(e.videoTimestampSec)}`}</div>
                          </div>
                          ${i}
                        </div>`}).join(``)}
            </div>
          </section>
          `:``}

          ${l}

          <section class="panel">
            <h2>Game stats</h2>
            ${ft(e)}
          </section>

          <section class="panel">
            <h2>Import / persist</h2>
            <div class="stack">
              <p class="hint">CSV seeds unplaced events for <strong>this game</strong>.</p>
              <label class="field">CSV import
                <input type="file" id="csv-file" class="csv-file-input" accept=".csv,text/csv" />
              </label>
              <button type="button" class="ghost" data-action="load-sample">Load sample-game.csv</button>
              ${dt()}
            </div>
          </section>
        </div>

        <div class="chart-rink">
          ${pt(`${o} placed · ${t.length} unplaced · ${b(r)}`,c)}
        </div>
      </div>

      <footer class="chart-footer">
        <button type="button" class="ghost" data-action="open-settings">Settings</button>
      </footer>
    </div>
    ${_t(r)}
  `}function yt(e){let t=document.getElementById(`rink-wrap`),n=document.getElementById(`rink-stage`),r=document.getElementById(`rink-img`),i=document.getElementById(`heat-canvas`),a=document.getElementById(`markers`);if(!t||!n||!r||!i||!a)return;let o=()=>{let n=t.clientWidth,r=t.clientHeight;if(n<10||r<10)return;(i.width!==n||i.height!==r)&&(i.width=n,i.height=r);let o=e.map(e=>{if(typeof e.x!=`number`||typeof e.y!=`number`)return e;let{nx:t,ny:n}=st(e.x,e.y);return{...e,x:t,y:n}});Me?ve(i,o):i.getContext(`2d`)?.clearRect(0,0,i.width,i.height),a.innerHTML=``;let s=!!j&&R===`chart`;if(a.classList.toggle(`has-selection`,s),t.classList.toggle(`has-selection`,s),!P)return;let c=R!==`chart`||D===`place`;for(let t of e){if(typeof t.x!=`number`||typeof t.y!=`number`)continue;let{nx:n,ny:r}=st(t.x,t.y),i=document.createElement(`button`);i.type=`button`;let o=R===`chart`&&j===t.id;i.className=`marker ${t.outcome}${o?` selected`:``}${o?` pulse`:``}`,i.style.left=`${n*100}%`,i.style.top=`${r*100}%`,c&&(i.style.pointerEvents=`none`),i.title=`${Z(t.outcome)} · ${t.side===`for`?Y(t.playerId):Y(t.goalieId)} · P${C(t.period)}`,i.dataset.shotId=t.id,c||i.addEventListener(`click`,n=>{n.stopPropagation(),bt(n,t,e)}),a.appendChild(i)}};r.complete?o():r.onload=()=>o(),requestAnimationFrame(o)}function bt(e,t,n){if(R!==`chart`||D===`place`)return;let r=document.getElementById(`rink-wrap`);if(!r)return;let i=xt(e.clientX,e.clientY,n,r,12);if(i.length>1){L=i,j=null,$();return}L=null,j=t.id,M=null,$()}function xt(e,t,n,r,i){let a=[];for(let o of n){if(typeof o.x!=`number`||typeof o.y!=`number`)continue;let n=r.querySelector(`[data-shot-id="${CSS.escape(o.id)}"]`),s,c;if(n){let e=n.getBoundingClientRect();s=e.left+e.width/2,c=e.top+e.height/2}else{let e=r.getBoundingClientRect(),{nx:t,ny:n}=st(o.x,o.y);s=e.left+t*e.width,c=e.top+n*e.height}let l=Math.hypot(s-e,c-t);l<=i&&a.push({s:o,d:l})}return a.sort((e,t)=>e.d-t.d),a.map(e=>e.s)}function St(e,t){let n=t.getBoundingClientRect(),r=`touches`in e?e.touches[0]||e.changedTouches[0]:e,i=(r.clientX-n.left)/n.width,a=(r.clientY-n.top)/n.height;return ot(Math.min(1,Math.max(0,i)),Math.min(1,Math.max(0,a)))}function Ct(e,t){if(M){T=S(T,M,{x:e,y:t}),j=M,M=null,q(),J(`Shot moved`),$();return}if(R!==`chart`||D!==`place`)return;if(A){T=S(T,A,{x:e,y:t}),j=A,A=null,q(),J(`Shot placed on rink`),$();return}let r=z;if(!r){J(`Select a game from Home first`,`error`);return}let i,a,c,l;if(B){i=B.side,a=B.outcome;let u=B.period,d=B.strength,f=B.videoTimestampSec;if(O=u,k=d,i===`for`){let e=document.getElementById(`live-place-player`)||document.getElementById(`plot-player`),t=document.getElementById(`live-new-player`)?.value.trim();if(t){let e=s(t)??{id:o(t),name:t};T=x(T,{id:e.id,name:e.name,number:e.number,role:`skater`}),c=e.id}else if(c=e?.value||void 0,!c){J(`Pick a player for this shot`,`error`);return}}else{let e=document.getElementById(`live-place-goalie`)||document.getElementById(`plot-goalie`),t=document.getElementById(`live-new-goalie`)?.value.trim();if(t){let e=s(t)??{id:o(t),name:t};T=x(T,{id:e.id,name:e.name,number:e.number,role:`goalie`}),l=e.id}else if(l=e?.value||void 0,!l){J(`Pick a goalie for this shot`,`error`);return}}let p={id:y(`shot`),gameId:r,side:i,outcome:a,x:e,y:t,playerId:c,goalieId:l,period:u,strength:d,videoTimestampSec:f,createdAt:new Date().toISOString(),kind:`shot`};T=fe(T,p),j=p.id,B=null,q(),J(`Live mark saved · ${Z(a)} @ ${n(f)} · P${C(u)} · ${d}`);try{V?.play()}catch{}U=!1,$();return}let u=document.getElementById(`plot-period`);if(u){let e=u.value;O=e===`OT`?`OT`:Number(e)}let d=document.getElementById(`plot-strength`);if(d){let e=d.value;(e===`EV`||e===`PP`||e===`SH`)&&(k=e)}if(je===`our_shot`){i=`for`,a=document.getElementById(`plot-outcome`)?.value||`miss`;let e=document.getElementById(`new-player`)?.value.trim();if(e){let t=s(e)??{id:o(e),name:e};T=x(T,{id:t.id,name:t.name,number:t.number,role:`skater`}),c=t.id}else if(c=document.getElementById(`plot-player`)?.value||void 0,!c){J(`Pick or enter a player`,`error`);return}}else{i=`against`,a=document.getElementById(`plot-outcome`)?.value||`save`;let e=document.getElementById(`new-goalie`)?.value.trim();if(e){let t=s(e)??{id:o(e),name:e};T=x(T,{id:t.id,name:t.name,number:t.number,role:`goalie`}),l=t.id}else if(l=document.getElementById(`plot-goalie`)?.value||void 0,!l){J(`Pick or enter a goalie`,`error`);return}}let f={id:y(`shot`),gameId:r,side:i,outcome:a,x:e,y:t,playerId:c,goalieId:l,period:O,strength:k,createdAt:new Date().toISOString(),kind:`shot`};T=fe(T,f),j=f.id,q(),J(`Shot plotted (P${C(O)} · ${k})`),$()}async function wt(){try{let e=await fetch(`${Oe}sample-game.csv`);if(!e.ok)throw Error(`HTTP ${e.status}`);Tt(await e.text(),`Sample game`)}catch(e){J(`Failed to load sample: ${e}`,`error`)}}function Tt(e,t){try{let n=u(T,e,{gameId:z??void 0,gameLabel:t});T=n.season,G(n.gameId),I=!1,q(),J(`Imported ${n.imported} events (${n.skipped} skipped). Place them on the rink.`),R=`chart`,Ye(`place`)}catch(e){J(`CSV import failed: ${e}`,`error`)}}function Et(e){let t=r(X(e.gameId)?.videoUrl,e.clipUrl,e.videoTimestampSec);if(!t){J(`Set a game film YouTube URL first (Settings)`,`error`);return}window.open(t,`_blank`,`noopener,noreferrer`)}function Dt(e){let t=e?.value??`1`;if(t===`OT`)return`OT`;let n=Number(t);return n===2||n===3?n:1}function Ot(e){let t=e?.value??`EV`;return t===`PP`||t===`SH`?t:`EV`}function kt(){document.querySelectorAll(`[data-screen]`).forEach(e=>{e.addEventListener(`click`,()=>{let t=e.dataset.screen;(t===`home`||t===`chart`||t===`reports`)&&K(t)})}),document.querySelectorAll(`[data-open-game]`).forEach(e=>{e.addEventListener(`click`,()=>{let t=e.dataset.openGame;if(!t)return;let n=z;if(G(t),D=`place`,P=!1,A=null,j=null,M=null,N=!1,L=null,B=null,n!==t){H=0,U=!1;let e=n?X(n)?.videoUrl:void 0,r=X(t)?.videoUrl;w(e)!==w(r)&&He()}K(`chart`)})}),document.querySelector(`[data-action="create-game"]`)?.addEventListener(`click`,()=>{let e=document.getElementById(`create-opponent`)?.value.trim()||void 0,t=document.getElementById(`create-date`)?.value.trim()||tt(),n=document.getElementById(`create-location`)?.value.trim()||void 0,r=document.getElementById(`create-video`)?.value.trim()||void 0,i=y(`game`),a=ue({opponent:e,date:t,location:n,label:e?void 0:`Game ${T.games.length+1}`});T=de(T,{id:i,label:a,opponent:e,date:t,location:n,videoUrl:r,createdAt:new Date().toISOString()}),q(),G(i),D=`place`,P=!1,A=null,j=null,J(`Created ${a}`),K(`chart`)}),document.querySelector(`[data-action="reports-open-chart"]`)?.addEventListener(`click`,()=>{E.gameId!==`all`&&(G(E.gameId),K(`chart`))}),document.querySelectorAll(`[data-action="ui-mode"]`).forEach(e=>{e.addEventListener(`click`,()=>{Ye(e.dataset.mode)})}),document.querySelectorAll(`[data-action="mode"]`).forEach(e=>{e.addEventListener(`click`,()=>{je=e.dataset.mode,A=null,$()})}),document.querySelector(`[data-action="flip-attack"]`)?.addEventListener(`click`,()=>{F=!F,$()});let e=document.getElementById(`plot-period`);e?.addEventListener(`change`,()=>{O=Dt(e)});let r=document.getElementById(`plot-strength`);r?.addEventListener(`change`,()=>{k=Ot(r),$()});let i=document.getElementById(`filter-game`);i?.addEventListener(`change`,()=>{E={...E,gameId:i.value},$()});let a=document.getElementById(`filter-period`);a?.addEventListener(`change`,()=>{let e=a.value;E={...E,period:e===`all`?`all`:e===`OT`?`OT`:Number(e)},$()});let o=document.getElementById(`filter-strength`);o?.addEventListener(`change`,()=>{let e=o.value;E={...E,strength:e===`all`||e===`EV`||e===`PP`||e===`SH`?e:`all`},$()});let s=document.getElementById(`filter-side`);s?.addEventListener(`change`,()=>{E={...E,side:s.value},$()});let c=document.getElementById(`filter-player`);c?.addEventListener(`change`,()=>{E={...E,playerId:c.value,goalieId:c.value===`all`?E.goalieId:`all`},$()});let l=document.getElementById(`filter-goalie`);l?.addEventListener(`change`,()=>{E={...E,goalieId:l.value,playerId:l.value===`all`?E.playerId:`all`},$()});let u=document.getElementById(`filter-outcome`);u?.addEventListener(`change`,()=>{let e=u.value,t=e===`goal`||e===`miss`||e===`save`||e===`goal_against`?e:`all`;E={...E,outcome:t},$()}),document.getElementById(`tog-heat`)?.addEventListener(`change`,e=>{Me=e.target.checked,$()}),document.getElementById(`tog-markers`)?.addEventListener(`change`,e=>{P=e.target.checked,$()}),document.querySelector(`[data-action="load-sample"]`)?.addEventListener(`click`,()=>wt()),document.querySelector(`[data-action="cancel-place"]`)?.addEventListener(`click`,()=>{A=null,$()}),document.querySelector(`[data-action="new-at-click"]`)?.addEventListener(`click`,()=>{A=null,J(`Click the rink to plot a new shot with current plot settings`)}),document.querySelector(`[data-action="save-edit"]`)?.addEventListener(`click`,()=>{if(!j)return;let e=document.getElementById(`edit-side`).value,t=Dt(document.getElementById(`edit-period`)),n=Ot(document.getElementById(`edit-strength`)),r=document.getElementById(`edit-outcome`).value,i={side:e,period:t,strength:n,outcome:r};e===`for`?(i.playerId=document.getElementById(`edit-player`)?.value,i.goalieId=void 0,r!==`goal`&&r!==`miss`&&(r=`miss`),i.outcome=r):(i.goalieId=document.getElementById(`edit-goalie`)?.value,i.playerId=void 0,r!==`save`&&r!==`goal_against`&&(r=`save`),i.outcome=r),T=S(T,j,i),q(),J(`Shot updated`),$()}),document.querySelector(`[data-action="re-place"]`)?.addEventListener(`click`,()=>{j&&(M=j,J(`Click the rink to move this shot`),$())}),document.querySelector(`[data-action="close-picker"]`)?.addEventListener(`click`,()=>{L=null,$()}),document.querySelectorAll(`[data-pick]`).forEach(e=>{e.addEventListener(`click`,()=>{j=e.dataset.pick||null,L=null,$()})}),document.querySelectorAll(`[data-review]`).forEach(e=>{e.addEventListener(`click`,t=>{t.target.closest(`[data-action="open-clip"]`)||(j=e.dataset.review||null,P=!0,$())})}),document.querySelector(`[data-action="save-game"]`)?.addEventListener(`click`,()=>{let e=z;if(!e)return;let t=X(e);if(!t)return;let n=nt(),r={...t,opponent:n.opponent,date:n.date,location:n.location,videoUrl:n.videoUrl,label:ue({opponent:n.opponent,date:n.date,location:n.location,label:t.label})},i=w(t.videoUrl),a=w(r.videoUrl);T=de(T,r),q(),i!==a&&(H=0,He()),I=!1,J(`Game saved`),$()}),document.querySelector(`[data-action="open-settings"]`)?.addEventListener(`click`,()=>{I=!0,$()}),document.querySelectorAll(`[data-action="close-settings"]`).forEach(e=>{e.addEventListener(`click`,e=>{e.preventDefault(),e.stopPropagation(),I=!1,$()})}),document.querySelector(`[data-settings-panel]`)?.addEventListener(`click`,e=>{e.stopPropagation()}),document.querySelector(`[data-action="export-json"]`)?.addEventListener(`click`,()=>{let e=new Blob([ce(T)],{type:`application/json`}),t=document.createElement(`a`);t.href=URL.createObjectURL(e),t.download=`shotsheet-season-${new Date().toISOString().slice(0,10)}.json`,t.click(),URL.revokeObjectURL(t.href)}),document.querySelectorAll(`#csv-file, .csv-file-input`).forEach(e=>{e.addEventListener(`change`,async e=>{let t=e.target,n=t.files?.[0];n&&(Tt(await n.text(),n.name.replace(/\.csv$/i,``)),t.value=``)})}),document.querySelectorAll(`#json-file, .json-file-input`).forEach(e=>{e.addEventListener(`change`,async e=>{let t=e.target,n=t.files?.[0];if(n){try{T=le(await n.text()),z&&!T.games.some(e=>e.id===z)&&G(T.games[0]?.id??null),E={...he(),gameId:z??`all`},q(),J(`Season JSON imported`),K(`home`)}catch(e){J(`JSON import failed: ${e}`,`error`)}t.value=``}})}),document.querySelectorAll(`[data-place]`).forEach(e=>{e.addEventListener(`click`,t=>{t.stopPropagation(),A=e.dataset.place||null,j=A;let n=T.shots.find(e=>e.id===A);n?.period&&(O=n.period),(n?.strength===`EV`||n?.strength===`PP`||n?.strength===`SH`)&&(k=n.strength),J(`Now click the rink to set location`),$()})}),document.querySelectorAll(`[data-action="open-clip"]`).forEach(e=>{e.addEventListener(`click`,t=>{t.stopPropagation();let n=e.dataset.shot,r=T.shots.find(e=>e.id===n);r&&Et(r)})}),document.querySelector(`[data-action="save-shot-ts"]`)?.addEventListener(`click`,()=>{let e=document.querySelector(`[data-action="save-shot-ts"]`).dataset.shot,r=document.getElementById(`shot-ts`).value,i=t(r);T=S(T,e,{videoTimestampSec:i}),q(),J(i==null?`Timestamp cleared`:`Timestamp saved (${n(i)})`),$()}),document.querySelectorAll(`[data-action="delete-shot"]`).forEach(e=>{e.addEventListener(`click`,()=>{let t=e.dataset.shot;T=pe(T,t),j===t&&(j=null,N=!1),A===t&&(A=null),M===t&&(M=null),q(),J(`Shot deleted`),$()})}),document.getElementById(`edit-side`)?.addEventListener(`change`,()=>{if(!j)return;let e=document.getElementById(`edit-side`).value,t=T.shots.find(e=>e.id===j);if(!t)return;let n=e===`for`?t.outcome===`goal`||t.outcome===`miss`?t.outcome:`miss`:t.outcome===`save`||t.outcome===`goal_against`?t.outcome:`save`;T=S(T,j,{side:e,outcome:n}),q(),$()}),document.querySelector(`[data-action="toggle-review-edit"]`)?.addEventListener(`click`,()=>{N=!N,N||(M=null),$()}),document.getElementById(`live-rewind`)?.addEventListener(`change`,e=>{Pe=e.target.checked}),document.querySelectorAll(`[data-action="live-strength"]`).forEach(e=>{e.addEventListener(`click`,()=>{let t=e.dataset.strength;if(t===`EV`||t===`PP`||t===`SH`){k=t;let e=document.getElementById(`plot-strength`);e&&(e.value=t),$()}})}),document.querySelectorAll(`[data-action="live-mark"]`).forEach(e=>{e.addEventListener(`click`,()=>{let t=e.dataset.kind;(t===`our_shot`||t===`our_goal`||t===`opp_shot`||t===`opp_goal`)&&Ke(t,!1)})}),document.querySelector(`[data-action="live-mark-now"]`)?.addEventListener(`click`,()=>{Ke(Fe,!0)}),document.querySelector(`[data-action="cancel-live-pending"]`)?.addEventListener(`click`,()=>{qe()}),document.querySelectorAll(`[data-action="open-film-fallback"]`).forEach(e=>{e.addEventListener(`click`,()=>{let e=H;if(V)try{e=V.getCurrentTime()}catch{}Je(Math.max(0,Math.floor(e||0)))})});let d=document.getElementById(`rink-wrap`);d?.addEventListener(`click`,e=>{if(R!==`chart`||e.target.closest(`.stack-picker`)||e.target.closest(`.marker`)||D===`review`&&!M)return;let{x:t,y:n}=St(e,d);Ct(t,n)})}(window.matchMedia(`(display-mode: standalone)`).matches||navigator.standalone)&&document.body.classList.add(`standalone-pwa`),$(),window.addEventListener(`resize`,()=>{(R===`chart`||R===`reports`)&&yt(et())});