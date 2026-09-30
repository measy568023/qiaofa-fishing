/* ============================================================
 * 桥筏钓鱼全攻略 v2 · app.js（基础模块 + 天气）
 * 数据来自同目录 data.js；业务模块二见 app2.js
 * ============================================================ */

const DATA = window.QIAOFA_DATA || { version:'0', monthSeason:{}, flows:[], winds:[], fishProfiles:{}, baits:[], strategy:{ operations:[], methods:[], spots:[] } };
const DATA_VERSION = window.QIAOFA_DATA_VERSION || '0.0.0';
const FISH_ORDER = Object.keys(DATA.fishProfiles || {});

/* ===== Utils ===== */
const Utils = (() => {
  function debounce(fn, wait = 300){
    let t;
    return function(...args){ clearTimeout(t); t = setTimeout(() => fn.apply(this, args), wait); };
  }
  function throttleRaf(fn){
    let ticking = false;
    return function(...args){
      if(ticking) return;
      ticking = true;
      requestAnimationFrame(() => { fn.apply(this, args); ticking = false; });
    };
  }
  async function fetchJSON(url, timeout = 8000, opts = {}){
    if(typeof fetch !== 'function') throw new Error('当前浏览器不支持 fetch，请升级浏览器');
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    try{
      const r = await fetch(url, Object.assign({}, opts, { signal: ctrl.signal }));
      if(!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } finally { clearTimeout(timer); }
  }
  function esc(s){
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
      '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
    }[c]));
  }
  const $ = id => document.getElementById(id);
  return { debounce, throttleRaf, fetchJSON, esc, $ };
})();

/* ===== Store ===== */
const Store = (() => {
  const mem = {};
  let ok = true;
  try{ const k = '__qiaofa_t'; localStorage.setItem(k, '1'); localStorage.removeItem(k); }catch(e){ ok = false; }
  function get(key, def){
    if(!ok) return (key in mem) ? mem[key] : def;
    try{ const v = localStorage.getItem(key); return v == null ? def : JSON.parse(v); }catch(e){ return (key in mem) ? mem[key] : def; }
  }
  function set(key, val){
    mem[key] = val;
    if(!ok) return;
    try{ localStorage.setItem(key, JSON.stringify(val)); }catch(e){}
  }
  return { get, set, available: ok };
})();

/* ===== Env / Bridge / Toast ===== */
const Env = (() => {
  const ua = navigator.userAgent;
  const isWxWebview = (typeof wx !== 'undefined' && !!wx.miniProgram) || window.__wxjs_environment === 'miniprogram';
  return {
    ua, isFile: location.protocol === 'file:', isHttps: location.protocol === 'https:',
    isWechat: /MicroMessenger/i.test(ua), isWxWebview, isMiniProgram: window.__wxjs_environment === 'miniprogram'
  };
})();
const Bridge = (() => {
  const enabled = Env.isWxWebview;
  function post(type, payload){
    const msg = { app: 'qiaofa', type, ts: Date.now(), payload: payload || {} };
    if(enabled){ try{ wx.miniProgram.postMessage({ data: msg }); }catch(e){} }
    try{ document.documentElement.setAttribute('data-bridge-' + type, JSON.stringify(msg).slice(0, 200)); }catch(e){}
    return msg;
  }
  return { enabled, post };
})();
const Toast = (() => {
  let wrap = null;
  function ensure(){
    if(!wrap){
      wrap = document.createElement('div');
      wrap.className = 'toast-wrap';
      document.body.appendChild(wrap);
    }
    return wrap;
  }
  function show(msg, type = 'info', ms = 2600){
    const w = ensure();
    const el = document.createElement('div');
    el.className = 'toast toast-' + type;
    el.textContent = msg;
    w.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, ms);
  }
  return { show };
})();

/* ===== FishContext（全局目标鱼：天气/计算器/配饵联动，状态持久化） ===== */
const FishContext = (() => {
  let fishId = 'crucian';
  try{
    const saved = Store.get('qiaofa_target_fish', null);
    if(saved && (DATA.fishProfiles || {})[saved]) fishId = saved;
  }catch(e){}
  const listeners = [];
  function get(){ return fishId; }
  function getFish(){ return (DATA.fishProfiles || {})[fishId] || null; }
  function set(id){
    if(!(DATA.fishProfiles || {})[id]) return;
    fishId = id;
    Store.set('qiaofa_target_fish', id);
    listeners.forEach(fn => { try{ fn(id); }catch(e){} });
  }
  function onChange(fn){ listeners.push(fn); }
  return { get, getFish, set, onChange };
})();

/* ============================================================
 * Weather（街道级定位 + 多数据源 + 出钓指数按目标鱼）
 * 定位链：geolocation → 高德regeo(有KEY) → Open-Meteo逆地理 → bigdatacloud → IP定位 → 就近宜宾区县
 * ============================================================ */
const Weather = (() => {
  const CFG_KEY = 'qiaofa_weather_cfg_v2';
  const CITY_KEY = 'qiaofa_city_v2';
  const yibinDistricts = {
    '翠屏': { name: '宜宾·翠屏区', lat: 28.7657, lon: 104.6324 },
    '叙州': { name: '宜宾·叙州区', lat: 28.7005, lon: 104.5178 },
    '南溪': { name: '宜宾·南溪区', lat: 28.8476, lon: 104.9682 },
    '江安': { name: '宜宾·江安县', lat: 28.7168, lon: 105.0692 },
    '长宁': { name: '宜宾·长宁县', lat: 28.5983, lon: 104.9217 },
    '高县': { name: '宜宾·高县', lat: 28.4176, lon: 104.5231 },
    '珙县': { name: '宜宾·珙县', lat: 28.3953, lon: 104.7128 },
    '筠连': { name: '宜宾·筠连县', lat: 28.1712, lon: 104.5156 },
    '兴文': { name: '宜宾·兴文县', lat: 28.3174, lon: 105.0653 },
    '屏山': { name: '宜宾·屏山县', lat: 28.6825, lon: 104.1578 }
  };
  const fallbackWeather = {
    current: { temperature_2m: 25, weather_code: 2, wind_speed_10m: 12, wind_direction_10m: 135,
      relative_humidity_2m: 75, apparent_temperature: 27, surface_pressure: 1013, uv_index: 5 },
    daily: { weather_code: [2,3,61], temperature_2m_max: [28,29,26], temperature_2m_min: [20,21,19], precipitation_probability_max: [20,40,70], sunrise: ['06:30','06:31','06:32'], sunset: ['18:30','18:29','18:28'] }
  };
  let cfg = Object.assign({ src: 'openmeteo', key: '' }, Store.get(CFG_KEY, {}));
  let currentCity = { name: '', lat: null, lon: null };
  let isOffline = false;
  let reqSeq = 0;
  let lastUpdate = null;
  let lastData = null;
  let loadRetried = false;

  function codeText(c){
    if(c===0) return '晴'; if(c===1) return '基本晴朗'; if(c===2) return '多云'; if(c===3) return '阴';
    if(c===45||c===48) return '雾'; if(c>=51&&c<=57) return '毛毛雨';
    if(c>=61&&c<=65) return '雨'; if(c===66||c===67) return '冻雨';
    if(c>=71&&c<=77) return '雪'; if(c>=80&&c<=82) return '阵雨';
    if(c===85||c===86) return '阵雪'; if(c===95) return '雷暴'; if(c>=96) return '雷暴伴冰雹';
    return '未知';
  }
  function codeIcon(c){
    if(c===0) return '☀️'; if(c===1) return '🌤️'; if(c===2) return '⛅'; if(c===3) return '☁️';
    if(c===45||c===48) return '🌫️'; if(c>=51&&c<=57) return '🌦️';
    if(c>=61&&c<=65) return '🌧️'; if(c===66||c===67) return '🌧️';
    if(c>=71&&c<=77) return '❄️'; if(c>=80&&c<=82) return '🌧️';
    if(c===85||c===86) return '🌨️'; if(c===95) return '⛈️'; if(c>=96) return '⛈️';
    return '🌡️';
  }
  function windLevel(kmh){
    if(kmh < 1) return 0; if(kmh < 6) return 1; if(kmh < 12) return 2;
    if(kmh < 20) return 3; if(kmh < 29) return 4; if(kmh < 39) return 5;
    if(kmh < 50) return 6; if(kmh < 62) return 7; if(kmh < 75) return 8; return 9;
  }
  function windDir(deg){
    const dirs=['北','东北','东','东南','南','西南','西','西北'];
    return dirs[Math.round((((deg%360)+360)%360)/45)%8];
  }
  /* 月相计算（基于日期的月龄近似） */
  function moonPhase(d){
    const syn = 29.53058867;
    const ref = Date.UTC(2000, 0, 6, 18, 14, 0);
    const age = ((d.getTime() - ref) / 86400000) % syn;
    const a = (age + syn) % syn;
    if(a < 1.8) return { name:'新月', score: -2, note:'夜黑' };
    if(a < 6.4) return { name:'娥眉月', score: 0, note:'' };
    if(a < 8.8) return { name:'上弦月', score: 1, note:'夜钓光线渐好' };
    if(a < 13.3) return { name:'盈凸月', score: 2, note:'' };
    if(a < 15.8) return { name:'满月', score: 3, note:'夜钓光线好，大物活跃' };
    if(a < 19.3) return { name:'亏凸月', score: 2, note:'' };
    if(a < 23.6) return { name:'下弦月', score: 1, note:'后半夜月明' };
    if(a < 27.6) return { name:'残月', score: 0, note:'' };
    return { name:'新月', score: -2, note:'夜黑' };
  }
  function toHour(v){
    if(!v) return null;
    let h = null;
    try{ const d = new Date(v); if(!isNaN(d.getTime())) h = d.getHours() + d.getMinutes()/60; }catch(e){}
    if(h == null && typeof v === 'string' && /^\d{1,2}:\d{2}/.test(v)){
      const p = v.split(':');
      h = parseFloat(p[0]) + parseFloat(p[1])/60;
    }
    return h;
  }
  function fmtHM(v){
    if(!v) return '--';
    if(typeof v === 'string' && /^\d{1,2}:\d{2}/.test(v)) return v;
    try{ const d = new Date(v); if(!isNaN(d.getTime())) return ('0'+d.getHours()).slice(-2) + ':' + ('0'+d.getMinutes()).slice(-2); }catch(e){}
    return '--';
  }
  function calcIndex(t, windKmh, precipProb, press, hum, extras){
    const pref = FishContext.getFish() ? FishContext.getFish().tempPref : null;
    let s = 60;
    if(pref && isFinite(pref.min) && isFinite(pref.max)){
      if(t >= pref.min && t <= pref.max) s += 20;
      else if(t >= pref.min - 5 && t <= pref.max + 5) s += 8;
      else if(t < pref.min - 10 || t > pref.max + 10) s -= 20;
      else s -= 8;
    } else {
      if(t>=15 && t<=28) s += 20; else if(t>=8 && t<15) s += 10;
      else if(t>28 && t<=33) s += 5; else if(t<0 || t>35) s -= 20; else if(t<5) s -= 10;
    }
    if(windKmh <= 8) s += 10; else if(windKmh <= 19) s += 5;
    else if(windKmh <= 29) s -= 10; else s -= 25;
    if(precipProb <= 10) s += 10; else if(precipProb <= 40) s += 0;
    else if(precipProb <= 70) s -= 10; else s -= 20;
    if(press>=1002 && press<=1022) s += 10; else if(press<995 || press>1030) s -= 10;
    if(hum>=50 && hum<=80) s += 5; else if(hum>90) s -= 5;
    /* 新增维度：昼夜温差 / 昨日骤变 / 日出日落窗口 / 月相 */
    if(extras){
      if(extras.tmax != null && extras.tmin != null){
        const diff = extras.tmax - extras.tmin;
        if(diff <= 6) s += 8;
        else if(diff <= 9) s += 2;
        else if(diff <= 12) s -= 6;
        else s -= 12;
      }
      if(extras.yesterdayMax != null && extras.tmax != null){
        const jump = Math.abs(extras.tmax - extras.yesterdayMax);
        if(jump >= 8) s -= 10;
        else if(jump >= 5) s -= 4;
        else s += 2;
      }
      if(extras.sunriseH != null && extras.sunsetH != null){
        const now = new Date();
        const hr = now.getHours() + now.getMinutes()/60;
        if(hr >= extras.sunriseH - 0.5 && hr <= extras.sunriseH + 1.5) s += 8;
        else if(hr >= extras.sunsetH - 2 && hr <= extras.sunsetH + 0.5) s += 8;
        else if(hr >= 11 && hr <= 15) s -= 6;
      }
      if(extras.moonScore != null) s += extras.moonScore;
    }
    if(!isFinite(s)) s = 50;
    return Math.max(0, Math.min(100, s));
  }
  function levelText(s){
    if(s>=80) return ['优 · 爆护天','#2f8f5f'];
    if(s>=60) return ['良 · 可出钓','#3e8f6a'];
    if(s>=40) return ['一般 · 谨慎出钓','#b5762a'];
    return ['差 · 不建议出钓','#c94b4b'];
  }
  function genTips(d){
    const tips=[]; const w=Math.round(d.wind); const t=Math.round(d.temp);
    const fish = FishContext.getFish();
    if(fish && fish.tempPref){
      if(t >= fish.tempPref.min && t <= fish.tempPref.max) tips.push(fish.name + '最适水温 ' + fish.tempPref.min + '-' + fish.tempPref.max + '°C，当前温度正好，活性好可勤逗钓');
      else if(t < fish.tempPref.min) tips.push('当前温度低于' + fish.name + '最适水温（' + fish.tempPref.min + '-' + fish.tempPref.max + '°C），建议钓深水、用活饵、线组放细');
      else tips.push('当前温度偏高，' + fish.name + '活性受抑，早晚窗口期作钓，钓桥底阴凉深水');
    }
    if(w<=8) tips.push('静水无风：用 3-5g 轻铅，可尝试悬铅钓底放大轻口信号');
    else if(w<=19) tips.push('风力中等：用 5-7g 铅，选背风桥墩，只抓有力的上下口');
    else tips.push('大风天：换 0.6mm 以上粗竿稍，加铅 10-15g 绷紧风线，选背风侧');
    if(d.precipProb>60) tips.push('降水概率高：雷雨天气禁钓，雨停后鱼口往往转好');
    if(d.press<1000 && d.hum>85) tips.push('闷热低压：鱼易上浮，建议定层半水钓或从底往上搜层');
    return tips.slice(0,3);
  }
  function setLoading(on){
    const box = Utils.$('weatherBox');
    if(!box) return;
    box.classList.toggle('loading', on);
    const sb = Utils.$('searchBtn'), lb = Utils.$('locBtn'), stb = Utils.$('setBtn');
    if(sb) sb.disabled = on;
    if(lb) lb.disabled = on;
    if(stb) stb.disabled = on;
    if(on){
      const t = Utils.$('curTemp'), d = Utils.$('curDesc');
      if(t) t.textContent = '…';
      if(d) d.textContent = '正在获取天气…';
    }
  }
  function showError(msg){
    isOffline = true;
    const bar = Utils.$('errBar');
    if(bar){ bar.textContent = '⚠️ ' + msg; bar.hidden = false; }
  }
  function clearError(){
    isOffline = false;
    const bar = Utils.$('errBar');
    if(bar) bar.hidden = true;
  }
  function metaText(src){
    const name = { openmeteo:'Open-Meteo', amap:'高德天气', qweather:'和风天气' }[src] || src;
    const ts = lastUpdate ? (' · 更新于 ' + new Date(lastUpdate).toLocaleTimeString('zh-CN', { hour:'2-digit', minute:'2-digit' })) : '';
    return '数据源：' + name + ts;
  }
  function renderScore(score, tips){
    const lv = levelText(score);
    Utils.$('fishScore').textContent = score;
    const lvEl = Utils.$('fishLevel');
    lvEl.textContent = '桥筏出钓指数：'+lv[0];
    lvEl.style.background = lv[1];
    lvEl.style.color = '#fff';
    Utils.$('fishTips').innerHTML = '💡 作钓建议（目标鱼：' + (FishContext.getFish() ? FishContext.getFish().name : '综合') + '）：<ul>' + tips.map(t => '<li>' + Utils.esc(t) + '</li>').join('') + '</ul>';
  }
  function renderWeather(data, opt){
    if(!data || !data.current || !data.daily) throw new Error('天气数据格式异常');
    opt = opt || {};
    Utils.$('cityName').textContent = currentCity.name || '当前位置';
    Utils.$('curTemp').textContent = Math.round(data.current.temperature_2m);
    Utils.$('curDesc').textContent = codeIcon(data.current.weather_code)+' '+codeText(data.current.weather_code);
    const wl = windLevel(data.current.wind_speed_10m);
    Utils.$('windInfo').textContent = windDir(data.current.wind_direction_10m)+'风 '+wl+'级('+Math.round(data.current.wind_speed_10m)+'km/h)';
    Utils.$('humInfo').textContent = Math.round(data.current.relative_humidity_2m)+'%';
    Utils.$('feelInfo').textContent = '体感 '+Math.round(data.current.apparent_temperature)+'°C';
    Utils.$('pressInfo').textContent = Math.round(data.current.surface_pressure)+' hPa';
    Utils.$('uvInfo').textContent = (data.current.uv_index != null) ? Math.round(data.current.uv_index) : '--';
    const days = data.daily; const today = new Date();
    let html = '';
    for(let i=0;i<3;i++){
      const d = new Date(today); d.setDate(d.getDate()+i);
      const label = i===0?'今天':(i===1?'明天':'后天');
      const wc = days.weather_code[i] != null ? days.weather_code[i] : 0;
      const tmax = days.temperature_2m_max[i] != null ? Math.round(days.temperature_2m_max[i]) : '--';
      const tmin = days.temperature_2m_min[i] != null ? Math.round(days.temperature_2m_min[i]) : '--';
      const pprob = days.precipitation_probability_max[i] != null ? days.precipitation_probability_max[i] : '-';
      const dw = days.wind_speed_10m_max != null && days.wind_speed_10m_max[i] != null ? windLevel(days.wind_speed_10m_max[i]) : null;
      html += '<div class="day"><div>'+label+'</div><div>'+codeIcon(wc)+'</div>'+
              '<div><b>'+tmax+'°</b> / '+tmin+'°</div>'+
              '<div>💧'+pprob+'%'+(dw != null ? ' · 💨'+dw+'级' : '')+'</div></div>';
    }
    Utils.$('daysRow').innerHTML = html;
    const tmax0 = days.temperature_2m_max[0] != null ? days.temperature_2m_max[0] : null;
    const tmin0 = days.temperature_2m_min[0] != null ? days.temperature_2m_min[0] : null;
    const sr = days.sunrise ? days.sunrise[0] : null;
    const ss = days.sunset ? days.sunset[0] : null;
    const moon = moonPhase(new Date());
    const sunriseH = toHour(sr), sunsetH = toHour(ss);
    const extras = { tmax: tmax0, tmin: tmin0, yesterdayMax: opt.yesterdayMax || null, sunriseH: sunriseH, sunsetH: sunsetH, moonScore: moon.score };
    const factors = [];
    if(tmax0 != null && tmin0 != null){
      const diff = Math.round(tmax0 - tmin0);
      factors.push('🌡️ 昼夜温差 ' + diff + '°C' + (diff <= 6 ? '（稳定）' : diff <= 9 ? '（正常）' : diff <= 12 ? '（偏大）' : '（大·口易乱）'));
    }
    if(opt.yesterdayMax != null && tmax0 != null){
      const jump = Math.round(Math.abs(tmax0 - opt.yesterdayMax));
      factors.push('🔄 昨→今最高 ' + Math.round(opt.yesterdayMax) + '→' + Math.round(tmax0) + '°C' + (jump >= 8 ? '（骤变·减分）' : jump >= 5 ? '（波动）' : '（平稳）'));
    }
    if(sr || ss){
      const now = new Date(); const hr = now.getHours() + now.getMinutes()/60;
      const inWin = (sunriseH != null && hr >= sunriseH - 0.5 && hr <= sunriseH + 1.5) || (sunsetH != null && hr >= sunsetH - 2 && hr <= sunsetH + 0.5);
      factors.push('🌅 日出 ' + fmtHM(sr) + ' / 日落 ' + fmtHM(ss) + (inWin ? ' · 当前窗口期' : ''));
    }
    factors.push('🌙 月相 ' + moon.name + (moon.note ? '（' + moon.note + '）' : ''));
    const fEl = Utils.$('wbFactors');
    if(fEl) fEl.innerHTML = factors.map(function(f){ return '<span>' + f + '</span>'; }).join('');
    const score = calcIndex(data.current.temperature_2m, data.current.wind_speed_10m,
      days.precipitation_probability_max[0] || 0, data.current.surface_pressure, data.current.relative_humidity_2m, extras);
    renderScore(score, genTips({ wind: data.current.wind_speed_10m, temp: data.current.temperature_2m,
      precipProb: days.precipitation_probability_max[0] || 0, press: data.current.surface_pressure, hum: data.current.relative_humidity_2m }));
    Utils.$('offlineTip').hidden = !isOffline;
    Utils.$('wbMeta').textContent = metaText('openmeteo');
    lastData = { temp: data.current.temperature_2m, press: data.current.surface_pressure, hum: data.current.relative_humidity_2m, wind: data.current.wind_speed_10m, precipProb: days.precipitation_probability_max[0] || 0, src:'openmeteo', tmax: tmax0, tmin: tmin0, sunrise: fmtHM(sr), sunset: fmtHM(ss), moon: moon.name, yesterdayMax: opt.yesterdayMax || null };
    Bridge.post('weather', { city: currentCity.name, temp: Math.round(data.current.temperature_2m), score });
  }
  function renderAmap(j){
    const live = j.lives && j.lives[0];
    const f = j.forecasts && j.forecasts[0];
    if(!live || !f) throw new Error('高德天气数据格式异常');
    Utils.$('cityName').textContent = currentCity.name || (live.city || '当前位置');
    Utils.$('curTemp').textContent = live.temperature || '--';
    Utils.$('curDesc').textContent = live.weather || '--';
    Utils.$('windInfo').textContent = (live.winddirection || '--') + '风 ' + (live.windpower || '--') + '级';
    Utils.$('humInfo').textContent = (live.humidity != null ? live.humidity : '--') + '%';
    Utils.$('feelInfo').textContent = '实时温度 ' + (live.temperature || '--') + '°C';
    Utils.$('pressInfo').textContent = '--';
    Utils.$('uvInfo').textContent = '--';
    const casts = (f.casts || []).slice(0, 3);
    const labels = ['今天','明天','后天'];
    let html = '';
    casts.forEach((c, i) => {
      html += '<div class="day"><div>'+(labels[i]||'')+'</div><div>'+Utils.esc(c.dayweather||'')+'</div>'+
              '<div><b>'+Utils.esc(c.daytemp||'--')+'°</b> / '+Utils.esc(c.nighttemp||'--')+'°</div>'+
              '<div>💧'+Utils.esc(c.daypower||'-')+'级</div></div>';
    });
    Utils.$('daysRow').innerHTML = html || '<div class="day" style="grid-column:1/-1;">暂无预报</div>';
    const windKmh = parseFloat(live.windpower || '0') * 5;
    const moonA = moonPhase(new Date());
    const dt0 = casts[0] ? parseFloat(casts[0].daytemp || 'NaN') : NaN;
    const nt0 = casts[0] ? parseFloat(casts[0].nighttemp || 'NaN') : NaN;
    const tmaxA = isFinite(dt0) ? dt0 : null;
    const tminA = isFinite(nt0) ? nt0 : null;
    const score = calcIndex(parseFloat(live.temperature), windKmh, 20, 1013, parseFloat(live.humidity || '60'), { tmax: tmaxA, tmin: tminA, moonScore: moonA.score });
    renderScore(score, genTips({ wind: windKmh, temp: parseFloat(live.temperature), precipProb: 20, press: 1013, hum: parseFloat(live.humidity || '60') }));
    const fElA = Utils.$('wbFactors');
    if(fElA){
      const fa = [];
      if(tmaxA != null && tminA != null) fa.push('🌡️ 昼夜温差 ' + Math.round(tmaxA - tminA) + '°C');
      fa.push('🌙 月相 ' + moonA.name + (moonA.note ? '（' + moonA.note + '）' : ''));
      fElA.innerHTML = fa.map(function(x){ return '<span>' + x + '</span>'; }).join('');
    }
    Utils.$('offlineTip').hidden = true;
    Utils.$('wbMeta').textContent = metaText('amap');
    lastData = { temp: parseFloat(live.temperature), press: 1013, hum: parseFloat(live.humidity || '60'), wind: windKmh, precipProb: 20, src:'amap', tmax: tmaxA, tmin: tminA, moon: moonA.name };
    Bridge.post('weather', { city: currentCity.name, temp: live.temperature, score });
  }
  function renderQw(j){
    const now = j.now || {};
    const num = v => { const n = parseFloat(v); return isFinite(n) ? n : null; };
    const curTemp = num(now.temp), curHum = num(now.humidity), curFeel = num(now.feelsLike);
    const curPress = num(now.pressure), curWind = num(now.windSpeed);
    Utils.$('cityName').textContent = currentCity.name || '当前位置';
    Utils.$('curTemp').textContent = curTemp != null ? Math.round(curTemp) : '--';
    Utils.$('curDesc').textContent = now.text || '--';
    Utils.$('windInfo').textContent = (now.windDir || '--') + ' ' + (now.windScale || '--') + '级';
    Utils.$('humInfo').textContent = curHum != null ? Math.round(curHum) + '%' : '--';
    Utils.$('feelInfo').textContent = curFeel != null ? '体感 ' + Math.round(curFeel) + '°C' : '--';
    Utils.$('pressInfo').textContent = curPress != null ? Math.round(curPress) + ' hPa' : '--';
    Utils.$('uvInfo').textContent = '--';
    Utils.$('daysRow').innerHTML = '<div class="day" style="grid-column:1/-1;">和风免费版仅实时天气，3日预报需付费版</div>';
    const moonQ = moonPhase(new Date());
    const score = calcIndex(curTemp != null ? curTemp : 20, curWind != null ? curWind : 5, 20,
      curPress != null ? curPress : 1013, curHum != null ? curHum : 60, { moonScore: moonQ.score });
    renderScore(score, genTips({ wind: curWind != null ? curWind : 5, temp: curTemp != null ? curTemp : 20,
      precipProb: 20, press: curPress != null ? curPress : 1013, hum: curHum != null ? curHum : 60 }));
    const fElQ = Utils.$('wbFactors');
    if(fElQ) fElQ.innerHTML = '<span>🌙 月相 ' + moonQ.name + (moonQ.note ? '（' + moonQ.note + '）' : '') + '</span>';
    Utils.$('offlineTip').hidden = true;
    Utils.$('wbMeta').textContent = metaText('qweather');
    lastData = { temp: curTemp != null ? curTemp : 20, press: curPress != null ? curPress : 1013, hum: curHum != null ? curHum : 60, wind: curWind != null ? curWind : 5, precipProb: 20, src:'qweather', moon: moonQ.name };
    Bridge.post('weather', { city: currentCity.name, temp: curTemp != null ? Math.round(curTemp) : null, score });
  }
  async function loadWeather(lat, lon){
    clearError();
    setLoading(true);
    const seq = ++reqSeq;
    try{
      if(cfg.src === 'amap'){
        if(!cfg.key) throw new Error('请先在设置中填入高德天气 KEY（免费版即可）');
        const geo = await Utils.fetchJSON('https://restapi.amap.com/v3/geocode/regeo?key='+cfg.key+'&location='+lon.toFixed(5)+','+lat.toFixed(5), 8000);
        const ac = geo && geo.regeocode ? geo.regeocode.addressComponent : null;
        let adcode = ac ? ac.adcode : null;
        const cty = (ac && Array.isArray(ac.city)) ? ac.city[0] : (ac ? ac.city : null);
        const cityNm = ac ? [cty || ac.province, ac.township || ac.district].filter(Boolean).join(' · ') : null;
        if(cityNm && currentCity && !currentCity.userSet) currentCity.name = cityNm;
        if(!adcode){
          const near = nearestDistrict(lat, lon, 45);
          adcode = near ? amapAdcode(near.name) : '511500';
        }
        const j = await Utils.fetchJSON('https://restapi.amap.com/v3/weather/weatherInfo?key='+cfg.key+'&city='+adcode+'&extensions=all', 9000);
        if(seq !== reqSeq) return;
        if(j.status !== '1') throw new Error('高德天气返回错误：' + (j.info || ''));
        isOffline = false;
        loadRetried = false;
        lastUpdate = Date.now();
        renderAmap(j);
      } else if(cfg.src === 'qweather'){
        if(!cfg.key) throw new Error('请先在设置中填入和风天气 KEY');
        const loc = await qwLoc(lat, lon);
        const j = await Utils.fetchJSON('https://devapi.qweather.com/v7/weather/now?location='+loc+'&key='+cfg.key, 9000);
        if(seq !== reqSeq) return;
        if(j.code !== '200') throw new Error('和风天气返回错误码 '+j.code);
        isOffline = false;
        loadRetried = false;
        lastUpdate = Date.now();
        renderQw(j);
      } else {
        const url = 'https://api.open-meteo.com/v1/forecast?latitude='+lat+'&longitude='+lon+
          '&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,surface_pressure,wind_speed_10m,wind_direction_10m,uv_index'+
          '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,wind_speed_10m_max'+
          '&timezone=auto&forecast_days=3';
        const y = new Date(); y.setDate(y.getDate()-1);
        const yStr = y.getFullYear() + '-' + ('0' + (y.getMonth()+1)).slice(-2) + '-' + ('0' + y.getDate()).slice(-2);
        const arcUrl = 'https://archive-api.open-meteo.com/v1/archive?latitude='+lat+'&longitude='+lon+'&start_date='+yStr+'&end_date='+yStr+'&daily=temperature_2m_max&timezone=auto';
        const results = await Promise.all([
          Utils.fetchJSON(url, 9000),
          Utils.fetchJSON(arcUrl, 7000).catch(function(){ return null; })
        ]);
        const data = results[0], arc = results[1];
        if(seq !== reqSeq) return;
        isOffline = false;
        loadRetried = false;
        lastUpdate = Date.now();
        renderWeather(data, (arc && arc.daily && arc.daily.temperature_2m_max && arc.daily.temperature_2m_max.length) ? { yesterdayMax: arc.daily.temperature_2m_max[0] } : {});
      }
    }catch(e){
      if(seq !== reqSeq) return;
      if(!loadRetried && !Env.isFile){
        loadRetried = true;
        Toast.show('天气获取失败，3 秒后自动重试…', 'warn');
        setTimeout(function(){ loadWeather(lat, lon); }, 3000);
        return;
      }
      loadRetried = false;
      isOffline = true;
      let msg;
      if(e && e.name === 'AbortError') msg = '天气请求超时（网络慢），已用离线参考数据；稍后可点 🔄 重试';
      else if(e && e.message && /^HTTP/.test(e.message)) msg = '天气接口返回异常（' + e.message + '），已用离线参考数据';
      else if(Env.isFile) msg = '本地 file:// 模式部分接口可能被拦截，已用离线参考数据（部署到 HTTPS 后完整生效）';
      else msg = '网络无法连接天气服务，已用离线参考数据；可手动输入城市或稍后重试';
      showError(msg);
      Toast.show('天气获取失败，已使用离线参考数据', 'warn');
      lastUpdate = null;
      renderWeather(fallbackWeather);
      Bridge.post('weather_error', { city: currentCity.name, msg: String(e && e.message || e) });
    } finally { setLoading(false); }
  }
  async function qwLoc(lat, lon){
    try{
      const r = await Utils.fetchJSON('https://geoapi.qweather.com/v2/city/lookup?location='+lat.toFixed(2)+','+lon.toFixed(2)+'&key='+cfg.key, 6000);
      if(r && r.code==='200' && r.location && r.location.length) return r.location[0].id;
    }catch(e){}
    return lat.toFixed(2)+','+lon.toFixed(2);
  }
  function amapAdcode(dist){
    const map = { '翠屏':'511502','南溪':'511503','叙州':'511504','江安':'511523','长宁':'511524','高县':'511525','珙县':'511526','筠连':'511527','兴文':'511528','屏山':'511529' };
    return map[dist] || '511500';
  }
  function approxKm(lat1, lon1, lat2, lon2){
    const R = 6371, dLat = (lat2-lat1)*Math.PI/180, dLon = (lon2-lon1)*Math.PI/180;
    const a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)*Math.sin(dLon/2);
    return 2*R*Math.asin(Math.sqrt(a));
  }
  function nearestDistrict(lat, lon, km){
    let best = null, bestD = Infinity;
    Object.keys(yibinDistricts).forEach(k => {
      const d = yibinDistricts[k];
      const dist = approxKm(lat, lon, d.lat, d.lon);
      if(dist < bestD){ bestD = dist; best = d; }
    });
    return (best && bestD <= km) ? best : null;
  }
  async function locateName(lat, lon){
    if(cfg.src === 'amap' && cfg.key){
      try{
        const j = await Utils.fetchJSON('https://restapi.amap.com/v3/geocode/regeo?key='+cfg.key+'&location='+lon.toFixed(5)+','+lat.toFixed(5), 6000);
        const r = j && j.regeocode;
        if(r && r.addressComponent){
          const ac = r.addressComponent;
          const cty = Array.isArray(ac.city) ? ac.city[0] : ac.city;
          const street = ac.streetNumber && ac.streetNumber.street ? ac.streetNumber.street : ac.township;
          const parts = [cty || ac.province, ac.district, street].filter(Boolean);
          const uniq = [];
          parts.forEach(p => { if(p && !uniq.includes(p)) uniq.push(p); });
          if(uniq.length) return uniq.join(' · ');
        }
      }catch(e){}
    }
    try{
      const j = await Utils.fetchJSON('https://geocoding-api.open-meteo.com/v1/search?reverse=true&latitude='+lat+'&longitude='+lon+'&count=1&language=zh', 6000);
      if(j && j.results && j.results.length){
        const r = j.results[0];
        const name = r.name || '';
        const a2 = (r.admin2 && r.admin2 !== name) ? r.admin2 : '';
        const a1 = (r.admin1 && r.admin1 !== name && r.admin1 !== a2) ? r.admin1 : '';
        const parts = [name, a2, a1].filter(Boolean);
        const uniq = [];
        parts.forEach(p => { if(p && !uniq.includes(p)) uniq.push(p); });
        if(uniq.length) return uniq.join(' · ');
      }
    }catch(e){}
    try{
      const j = await Utils.fetchJSON('https://api.bigdatacloud.net/data/reverse-geocode-client?latitude='+lat+'&longitude='+lon+'&localityLanguage=zh', 6000);
      const city = j.city || j.locality || '';
      const sub = j.principalSubdivision || '';
      if(city || sub) return [city, sub].filter(Boolean).join(' · ');
    }catch(e){}
    const near = nearestDistrict(lat, lon, 45);
    if(near) return near.name;
    return '当前位置';
  }
  async function ipLocate(){
    try{
      const j = await Utils.fetchJSON('https://ipapi.co/json/', 6000);
      if(j && j.latitude && j.longitude){
        return { name: (j.city || '') + (j.region ? (' · ' + j.region) : ''), lat: parseFloat(j.latitude), lon: parseFloat(j.longitude) };
      }
    }catch(e){}
    try{
      const j = await Utils.fetchJSON('https://ip-api.com/json/?lang=zh-CN', 6000);
      if(j && j.status === 'success'){
        return { name: (j.city || '') + (j.regionName ? (' · ' + j.regionName) : ''), lat: j.lat, lon: j.lon };
      }
    }catch(e){}
    return null;
  }
  async function searchCity(name){
    const j = await Utils.fetchJSON('https://geocoding-api.open-meteo.com/v1/search?name='+encodeURIComponent(name)+'&count=5&language=zh&format=json', 8000);
    if(!j || !j.results || !j.results.length) throw new Error('未找到城市：'+name);
    const c = j.results[0];
    currentCity = { name: c.name+(c.admin1 ? (' · '+c.admin1) : ''), lat: c.latitude, lon: c.longitude, userSet: true };
    saveCity();
    Bridge.post('city_change', { city: currentCity.name });
    await loadWeather(currentCity.lat, currentCity.lon);
  }
  function useGeo(){
    const fallback = async (msg) => {
      const ip = await ipLocate();
      if(ip){
        currentCity = { name: ip.name || 'IP定位', lat: ip.lat, lon: ip.lon, userSet: true };
        saveCity();
        await loadWeather(ip.lat, ip.lon);
        return;
      }
      const fb = (currentCity && currentCity.lat) ? currentCity : yibinDistricts['叙州'];
      Toast.show(msg + '，已回退' + fb.name + '；可手动输入城市名更准', 'warn');
      currentCity = { name: fb.name, lat: fb.lat, lon: fb.lon, userSet: true };
      saveCity();
      await loadWeather(fb.lat, fb.lon);
    };
    if(!window.isSecureContext){
      Toast.show('定位需要 HTTPS 环境（GitHub Pages 已满足），已改用 IP 定位', 'warn');
      fallback('非 HTTPS 环境无法精确定位');
      return;
    }
    if(!('geolocation' in navigator)){
      Toast.show('当前环境不支持定位，已改用 IP 定位', 'warn');
      fallback('浏览器不支持定位');
      return;
    }
    setLoading(true);
    const geoOpts = { timeout: 8000, maximumAge: 60000, enableHighAccuracy: false };
    const onOk = async pos => {
      const lat = pos.coords.latitude, lon = pos.coords.longitude;
      let name = '';
      try{ name = await locateName(lat, lon); }catch(e){}
      currentCity = { name: name || '当前位置', lat, lon, userSet: true };
      saveCity();
      Bridge.post('city_change', { city: currentCity.name });
      await loadWeather(lat, lon);
    };
    const onErr = err => fallback('定位失败（' + (err && err.message ? err.message : '未授权') + '）');
    navigator.geolocation.getCurrentPosition(onOk, onErr, geoOpts);
  }
  function saveCity(){
    if(!currentCity || !currentCity.lat) return;
    Store.set(CITY_KEY, { name: currentCity.name, lat: currentCity.lat, lon: currentCity.lon, ts: Date.now() });
  }
  function getCity(){ return currentCity; }
  function getCfg(){ return cfg; }
  function setCfg(next){ cfg = Object.assign(cfg, next); Store.set(CFG_KEY, cfg); }
  async function init(){
    try{
      const saved = Store.get(CITY_KEY, null);
      if(saved && typeof saved.lat === 'number' && typeof saved.lon === 'number'
         && saved.lat > -90 && saved.lat < 90 && saved.lon > -180 && saved.lon < 180){
        currentCity = { name: saved.name || '上次城市', lat: saved.lat, lon: saved.lon };
      } else {
        currentCity = yibinDistricts['叙州'];
      }
      renderCityName();
      await loadWeather(currentCity.lat, currentCity.lon);
      saveCity();
    }catch(e){
      console.warn('[Weather] 初始化异常：', e && e.message ? e.message : e);
    }
  }
  function renderCityName(){
    const el = Utils.$('cityName');
    if(el && currentCity.name) el.textContent = currentCity.name;
  }
  function bind(){
    Utils.$('searchBtn').addEventListener('click', async () => {
      const v = Utils.$('cityInput').value.trim();
      if(!v){ Toast.show('请输入城市名', 'warn'); return; }
      try{
        setLoading(true);
        await searchCity(v);
      }catch(e){
        Toast.show(e.message || '城市查询失败', 'error');
      }finally{
        setLoading(false);
      }
    });
    Utils.$('cityInput').addEventListener('keydown', e => { if(e.key === 'Enter') Utils.$('searchBtn').click(); });
    Utils.$('locBtn').addEventListener('click', useGeo);
    document.querySelectorAll('.qb-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const info = yibinDistricts[btn.dataset.dist];
        if(!info) return;
        currentCity = { name: info.name, lat: info.lat, lon: info.lon, userSet: true };
        saveCity();
        Bridge.post('city_change', { city: currentCity.name });
        await loadWeather(info.lat, info.lon);
      });
    });
    const hints = {
      openmeteo: 'Open-Meteo：完全免费、无需注册、支持跨域，全球通用，定位精确到乡镇级别。',
      amap: '高德天气：控制台免费申请 KEY（Web服务）。国内精度最高，逆地理可定位到街道，天气按区县发布。',
      qweather: '和风天气：dev.qweather.com 免费注册获取 KEY。免费版仅有实时天气，无3日预报。'
    };
    Utils.$('setBtn').addEventListener('click', () => {
      Utils.$('srcSelect').value = cfg.src;
      Utils.$('keyInput').value = cfg.key || '';
      Utils.$('srcHint').textContent = hints[cfg.src];
      Utils.$('setModal').hidden = false;
    });
    Utils.$('srcSelect').addEventListener('change', e => {
      Utils.$('srcHint').textContent = hints[e.target.value];
    });
    Utils.$('closeSet').addEventListener('click', () => { Utils.$('setModal').hidden = true; });
    Utils.$('setModal').addEventListener('click', e => { if(e.target.id === 'setModal') e.target.hidden = true; });
    Utils.$('saveSet').addEventListener('click', () => {
      setCfg({ src: Utils.$('srcSelect').value, key: Utils.$('keyInput').value.trim() });
      Utils.$('setModal').hidden = true;
      Toast.show('设置已保存，正在刷新天气', 'info');
      if(currentCity.lat) loadWeather(currentCity.lat, currentCity.lon);
    });
    Utils.$('targetFish').addEventListener('change', e => {
      FishContext.set(e.target.value);
      if(currentCity && currentCity.lat) loadWeather(currentCity.lat, currentCity.lon);
    });
    FishContext.onChange(id => {
      const sel = Utils.$('targetFish');
      if(sel && sel.value !== id) sel.value = id;
      if(currentCity && currentCity.lat) loadWeather(currentCity.lat, currentCity.lon);
    });
  }
  return { init, bind, getCity, getCfg, setCfg, loadWeather, yibinDistricts, nearestDistrict, getLastData: function(){ return lastData; } };
})();
