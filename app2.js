/* ============================================================
 * 桥筏钓鱼全攻略 v2 · app2.js（业务模块二）
 * 依赖 app.js 中的 DATA / Utils / Store / Toast / FishContext / Weather
 * 模块：BaitMatch / MyBaits / BaitView / Calc / Tech / Search / UI / UpdateCheck / boot
 * ============================================================ */

/* ============================================================
 * BaitMatch（配饵中心：经典配方 + 收藏到我的饵料）
 * ============================================================ */
const BaitMatch = (() => {
  let fishId = 'crucian';
  let month = new Date().getMonth() + 1;
  let env = 'wild';
  function seasonOf(m){ return (DATA.monthSeason || {})[m] || '夏'; }
  function findBait(name){
    if(!name) return null;
    const hit = (DATA.baits || []).find(b => b.name === name || b.name.indexOf(name) >= 0 || name.indexOf(b.name) >= 0);
    if(hit) return hit;
    return { brand:'通用', name:name, cat:'—', flavor:'—', target:[], seasons:[], scene:'—', waterRatio:'—', note:'自行准备（未收录库中，可后续在 data.js 追加）' };
  }
  function mainItem(b){
    let water = b.waterRatio ? '<span class="b-water">水比 ' + Utils.esc(b.waterRatio) + '</span>' : '';
    return '<div class="match-item"><b>' + Utils.esc(b.brand) + '</b> · ' + Utils.esc(b.name) + water +
      '<button class="b-add" title="收藏到我的饵料库" data-add-bait="' + Utils.esc(b.name) + '">＋</button></div>';
  }
  function plainItem(b){
    let water = b.waterRatio ? '<span class="b-water">' + Utils.esc(b.waterRatio) + '</span>' : '';
    return '<div class="match-item"><b>' + Utils.esc(b.brand) + '</b> · ' + Utils.esc(b.name) + water + '</div>';
  }
  function render(){
    const f = (DATA.fishProfiles || {})[fishId];
    if(!f) return;
    const box = Utils.$('matchResult');
    if(!box) return;
    const season = seasonOf(month);
    const main = f.baits.main.map(n => mainItem(findBait(n))).join('');
    const state = f.baits.state.map(n => plainItem(findBait(n))).join('');
    const add = f.baits.add.map(n => plainItem(findBait(n))).join('');
    const nest = f.baits.nest.map(n => plainItem(findBait(n))).join('');
    const envNote = env === 'black'
      ? '黑坑模式：鱼密度高、开口快，建议散炮/黄面面抢鱼，线组可略放粗 0.5 号，饵料味型加重。'
      : '野钓模式：窝量适中，避免重窝惊鱼；守大物时窝料加倍。';
    box.innerHTML =
      '<div class="match-block"><h4><span class="num-dot">1</span>主攻饵（核心）<span style="font-size:.76rem;color:var(--muted);font-weight:400;">点 ＋ 收藏到我的饵料库</span></h4><div class="match-items">' + (main || '<span style="color:var(--muted)">暂无（可用活饵替代）</span>') + '</div></div>' +
      (state ? '<div class="match-block"><h4><span class="num-dot">2</span>状态饵（调状态）</h4><div class="match-items">' + state + '</div></div>' : '') +
      (add ? '<div class="match-block"><h4><span class="num-dot">3</span>添加剂（增味）</h4><div class="match-items">' + add + '</div></div>' : '') +
      (nest ? '<div class="match-block"><h4><span class="num-dot">4</span>窝料（做窝）</h4><div class="match-items">' + nest + '</div></div>' : '') +
      '<div class="match-formula">📋 <b>经典配方：</b>' + Utils.esc(f.formula) + '</div>' +
      '<div class="match-tips"><b>🎯 ' + month + '月 · ' + season + '季作钓要点（' + f.name + '）：</b><ul><li>' + Utils.esc(f.tips[season]) + '</li><li>' + envNote + '</li><li>' + Utils.esc(f.notes[0] || '') + '</li></ul>' +
      '<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;">' +
        '<a href="#s0" class="rel-link" id="matchToCalc">⚖️ 用 ' + f.name + ' 计算钓组 →</a>' +
        '<a href="#s-tech" class="rel-link amber" id="matchToTech">📖 查看 ' + f.name + ' 手册 →</a>' +
      '</div></div>';
    const c = Utils.$('matchToCalc');
    if(c) c.addEventListener('click', () => { Utils.$('calcFish').value = fishId; Calc.run(); });
    const g = Utils.$('matchToTech');
    if(g) g.addEventListener('click', () => jumpToFish(fishId));
    box.querySelectorAll('[data-add-bait]').forEach(el => {
      el.addEventListener('click', () => { MyBaits.addFromName(el.dataset.addBait); });
    });
    Bridge.post('match', { fish: f.name, season: season });
  }
  function bind(){
    Utils.$('matchFish').addEventListener('change', e => { fishId = e.target.value; FishContext.set(fishId); render(); });
    Utils.$('matchMonth').addEventListener('change', e => { month = parseInt(e.target.value, 10); render(); });
    Utils.$('matchEnv').addEventListener('change', e => { env = e.target.value; render(); });
    Utils.$('matchBtn').addEventListener('click', render);
  }
  function setFish(id){ fishId = id; const sel = Utils.$('matchFish'); if(sel) sel.value = id; }
  return { bind, render, setFish, getFishId: function(){ return fishId; }, seasonOf: seasonOf };
})();

/* ===== MyBaits（我的饵料库，localStorage） ===== */
const MyBaits = (() => {
  const KEY = 'qiaofa_my_baits_v2';
  let list = Store.get(KEY, []);
  function save(){ Store.set(KEY, list); }
  function render(){
    const box = Utils.$('mybList');
    if(!box) return;
    if(!list.length){
      box.innerHTML = '<div class="mb-empty">还没有自定义饵料，添加后会显示在这里</div>';
      return;
    }
    box.innerHTML = list.map(function(b, i){
      return '<div class="mybait"><b>' + Utils.esc(b.name) + '</b>' +
        (b.brand ? '<span>' + Utils.esc(b.brand) + '</span>' : '') +
        (b.flavor ? '<span style="color:var(--muted)">' + Utils.esc(b.flavor) + '</span>' : '') +
        (b.ratio ? '<span style="color:var(--brand2)">水比 ' + Utils.esc(b.ratio) + '</span>' : '') +
        (b.fish ? '<span class="tag">' + Utils.esc(b.fish) + '</span>' : '') +
        '<button class="mb-del" data-del="' + i + '">删除</button></div>';
    }).join('');
    box.querySelectorAll('[data-del]').forEach(el => {
      el.addEventListener('click', function(){
        list.splice(parseInt(el.dataset.del, 10), 1);
        save(); render();
        Toast.show('已删除', 'info');
      });
    });
  }
  function addFromName(name){
    if(!name) return;
    const b = (DATA.baits || []).find(function(x){ return x.name === name; }) || {};
    list.push({ name: name, brand: b.brand || '通用', flavor: b.flavor || '', ratio: b.waterRatio || '', fish: '' });
    save(); render();
    Toast.show('已加入我的饵料库：' + name, 'info');
  }
  function bind(){
    Utils.$('mybAdd').addEventListener('click', function(){
      const name = Utils.$('mybName').value.trim();
      if(!name){ Toast.show('请填写饵料名称', 'warn'); return; }
      list.push({
        name: name,
        brand: Utils.$('mybBrand').value.trim(),
        flavor: Utils.$('mybFlavor').value.trim(),
        ratio: Utils.$('mybRatio').value.trim(),
        fish: Utils.$('mybFish').value
      });
      save(); render();
      Utils.$('mybName').value = ''; Utils.$('mybBrand').value = ''; Utils.$('mybFlavor').value = ''; Utils.$('mybRatio').value = '';
      Toast.show('已添加自定义饵料', 'info');
    });
    ['mybName','mybBrand','mybFlavor','mybRatio'].forEach(function(id){
      Utils.$(id).addEventListener('keydown', function(e){ if(e.key === 'Enter') Utils.$('mybAdd').click(); });
    });
  }
  return { bind: bind, render: render, addFromName: addFromName, list: list };
})();

/* ============================================================
 * BaitView（饵料库参考：筛选 + 分页，并入配饵中心）
 * ============================================================ */
const BaitView = (() => {
  const PAGE = 18;
  let page = 1;
  let state = { fish:'', brand:'', cat:'', kw:'' };
  function allTargets(){
    const set = new Set();
    (DATA.baits || []).forEach(b => (b.target || []).forEach(t => set.add(t)));
    return Array.from(set).sort();
  }
  function allBrands(){ return Array.from(new Set((DATA.baits || []).map(b => b.brand))).sort(); }
  function allCats(){ return Array.from(new Set((DATA.baits || []).map(b => b.cat))).sort(); }
  function fillFilters(){
    const fishSel = Utils.$('baitFish'), brandSel = Utils.$('baitBrand'), catSel = Utils.$('baitCat');
    if(!fishSel || !brandSel || !catSel) return;
    fishSel.innerHTML = '<option value="">全部鱼种</option>' + allTargets().map(t => '<option value="' + Utils.esc(t) + '">' + Utils.esc(t) + '</option>').join('');
    brandSel.innerHTML = '<option value="">全部品牌</option>' + allBrands().map(b => '<option value="' + Utils.esc(b) + '">' + Utils.esc(b) + '</option>').join('');
    catSel.innerHTML = '<option value="">全部类别</option>' + allCats().map(c => '<option value="' + Utils.esc(c) + '">' + Utils.esc(c) + '</option>').join('');
  }
  function filtered(){
    const kw = state.kw.toLowerCase();
    return (DATA.baits || []).filter(b => {
      if(state.fish && !(b.target || []).includes(state.fish)) return false;
      if(state.brand && b.brand !== state.brand) return false;
      if(state.cat && b.cat !== state.cat) return false;
      if(kw){
        const hay = (b.brand + b.name + b.flavor + b.note + (b.target || []).join('')).toLowerCase();
        if(hay.indexOf(kw) < 0) return false;
      }
      return true;
    });
  }
  function render(){
    const list = filtered();
    const total = list.length;
    const pages = Math.max(1, Math.ceil(total / PAGE));
    if(page > pages) page = pages;
    if(page < 1) page = 1;
    const slice = list.slice((page - 1) * PAGE, page * PAGE);
    const box = Utils.$('baitList');
    if(!box) return;
    Utils.$('baitCount').textContent = '共 ' + total + ' 款饵料' + (state.kw ? '（搜索：' + state.kw + '）' : '');
    if(!slice.length){
      box.innerHTML = '<div class="bait-empty">没有符合条件的饵料，换个关键词试试</div>';
    } else {
      box.innerHTML = slice.map(b => {
        const targets = (b.target || []).map(t => '<span class="tag">' + Utils.esc(t) + '</span>').join('');
        const seasons = (b.seasons || []).map(s => '<span class="tag gold">' + s + '</span>').join('');
        return '<div class="bait-item">' +
          '<div class="bi-top"><b>' + Utils.esc(b.name) + '</b><span class="bi-cat">' + Utils.esc(b.brand) + ' · ' + Utils.esc(b.cat) + '</span></div>' +
          (b.waterRatio ? '<div class="bi-water">💧 水比 / 用法：' + Utils.esc(b.waterRatio) + '</div>' : '') +
          '<div class="bi-tags">' + targets + seasons + '</div>' +
          '<div class="bi-note">' + Utils.esc(b.flavor) + ' · ' + Utils.esc(b.note) + '</div>' +
          '<div style="margin-top:6px;"><button class="rel-link" data-add-b2="' + Utils.esc(b.name) + '" style="border:none;background:#eef7f1;color:#0d5f52;font-weight:600;cursor:pointer;">＋ 收藏到我的饵料</button></div></div>';
      }).join('');
    }
    box.querySelectorAll('[data-add-b2]').forEach(el => {
      el.addEventListener('click', function(){ MyBaits.addFromName(el.dataset.addB2); });
    });
    const pager = Utils.$('baitPager');
    if(pager){
      pager.innerHTML = '<button id="baitPrev" ' + (page <= 1 ? 'disabled' : '') + '>‹ 上一页</button><span>' + page + ' / ' + pages + ' 页</span><button id="baitNext" ' + (page >= pages ? 'disabled' : '') + '>下一页 ›</button>';
      const prev = Utils.$('baitPrev'), next = Utils.$('baitNext');
      if(prev) prev.addEventListener('click', function(){ page--; render(); });
      if(next) next.addEventListener('click', function(){ page++; render(); });
    }
  }
  function bind(){
    fillFilters();
    Utils.$('baitFish').addEventListener('change', e => { state.fish = e.target.value; page = 1; render(); });
    Utils.$('baitBrand').addEventListener('change', e => { state.brand = e.target.value; page = 1; render(); });
    Utils.$('baitCat').addEventListener('change', e => { state.cat = e.target.value; page = 1; render(); });
    Utils.$('baitKw').addEventListener('input', Utils.debounce(e => { state.kw = e.target.value.trim(); page = 1; render(); }, 250));
    render();
  }
  return { bind: bind, render: render, setKw: v => { state.kw = v; page = 1; render(); }, state: state };
})();

/* ============================================================
 * Calc（钓组计算器：鱼种 × 月份 × 桥高 × 水深 × 水流6档 × 风力6档）
 * ============================================================ */
const Calc = (() => {
  const DEPTH_DEFAULT = { shallow:2.5, mid:4.5, deep:8, extradeep:12 };
  const BRIDGE_DEFAULT = { low:1.5, mid:5, high:11, ultra:18 };
  const LEAD_BASE = { shallow:3, mid:5, deep:7, extradeep:10 };
  const BRIDGE_ADJ = { low:0, mid:1, high:2, ultra:4 };
  const FALL_SPEED = [ [3,0.3],[5,0.45],[7,0.6],[10,0.8],[12,0.95],[15,1.1],[18,1.3] ];
  const LEAD_RANGE = [ [3,'3-6g'], [5,'5-8g'], [7,'7-12g'], [10,'10-18g'], [15,'12-18g'] ];

  function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }
  function fallSpeed(lead){
    let best = FALL_SPEED[0];
    FALL_SPEED.forEach(p => { if(Math.abs(p[0] - lead) < Math.abs(best[0] - lead)) best = p; });
    return best[1];
  }
  function leadRangeText(lead){
    let txt = LEAD_RANGE[0][1];
    LEAD_RANGE.forEach(p => { if(lead >= p[0]) txt = p[1]; });
    return txt;
  }
  function tipSize(lead){
    if(lead <= 5) return '0.4mm（玻纤）';
    if(lead <= 8) return '0.5mm（玻纤/碳素）';
    if(lead <= 12) return '0.6mm（碳素/全钛）';
    return '0.7mm（全钛）';
  }
  function depthKeyFromNum(n){ if(n < 3) return 'shallow'; if(n < 6) return 'mid'; if(n < 10) return 'deep'; return 'extradeep'; }
  function bridgeKeyFromNum(n){ if(n < 3) return 'low'; if(n < 8) return 'mid'; if(n < 15) return 'high'; return 'ultra'; }
  function readInputs(){
    const fishId = Utils.$('calcFish').value;
    const month = parseInt(Utils.$('calcMonth').value, 10);
    const depthSel = Utils.$('calcDepth').value;
    const flowId = Utils.$('calcFlow').value;
    const windId = Utils.$('calcWind').value;
    const bridgeSel = Utils.$('calcBridge').value;
    const depthNumRaw = Utils.$('calcDepthNum').value.trim();
    const bridgeNumRaw = Utils.$('calcBridgeNum').value.trim();
    let errors = [];
    let depthKey = depthSel, depthNum = DEPTH_DEFAULT[depthSel];
    if(depthNumRaw !== ''){
      const n = parseFloat(depthNumRaw);
      if(!isFinite(n) || n < 0.5 || n > 50){ errors.push('depthMsg'); }
      else { depthNum = n; depthKey = depthKeyFromNum(n); }
    }
    let bridgeKey = bridgeSel, bridgeNum = BRIDGE_DEFAULT[bridgeSel];
    if(bridgeNumRaw !== ''){
      const n = parseFloat(bridgeNumRaw);
      if(!isFinite(n) || n < 1 || n > 60){ errors.push('bridgeMsg'); }
      else { bridgeNum = n; bridgeKey = bridgeKeyFromNum(n); }
    }
    const flow = (DATA.flows || []).find(x => x.id === flowId) || { id:flowId, lead:0, name:'静水' };
    const wind = (DATA.winds || []).find(x => x.id === windId) || { id:windId, lead:0, name:'无风' };
    return { fishId: fishId, month: month, depthKey: depthKey, depthNum: depthNum, flow: flow, wind: wind, bridgeKey: bridgeKey, bridgeNum: bridgeNum, errors: errors };
  }
  function buildTips(inp, f){
    const tips = [];
    const season = (DATA.monthSeason || {})[inp.month] || '夏';
    tips.push('【' + inp.month + '月 · ' + season + '季】' + (f.tips[season] || ''));
    const flowTips = {
      still: '静水：可尝试悬铅钓底，信号最灵敏；轻口用 3g 轻铅',
      slight: '微走水：铅坠略加重，短子线，紧盯竿稍点动',
      light: '轻走水：铅坠加 1g 左右，钩饵能定住即可',
      mid: '中等走水：跑铅或加大铅坠，窝料打在钓点上游',
      strong: '强走水：大跑铅+重铅到底，绷紧主线减少走线假口',
      rapid: '激流：大跑铅+重铅守底，选桥墩背流侧，打窝用沉性大颗粒'
    };
    tips.push(flowTips[inp.flow.id] || '');
    const windTips = {
      calm: '无风/0-1级：细稍轻铅，放大轻口信号',
      breeze: '2级轻风：正常作钓，影响很小',
      gentle: '3级微风：正常作钓，只抓有力的上下动作',
      moderate: '4级和风：加铅 2g，选背风桥墩',
      fresh: '5级清风：换 0.6mm+ 粗竿稍，加铅 5g 绷紧风线',
      strong: '6级以上大风：粗竿稍+重铅，选背风侧，过滤左右摆动假口'
    };
    tips.push(windTips[inp.wind.id] || '');
    if(inp.bridgeKey === 'high' || inp.bridgeKey === 'ultra'){
      tips.push('桥高落差大：失手绳必挂，中鱼先溜翻再收，用神仙抄提鱼');
    }
    if(f.notes && f.notes.length) tips.push(f.notes[0]);
    return tips.filter(Boolean).slice(0, 6);
  }
  function bridgeText(key){
    if(key === 'low') return '桥高 3m 内：落差小，中鱼可直接收线，注意桥面护栏与行人安全';
    if(key === 'mid') return '常规桥高：正常操作，收线保持匀速，避免中途停顿给鱼喘息';
    if(key === 'high') return '8-15m 高桥：落差较大，先溜后收，配神仙抄；竿稍建议偏硬增强控鱼';
    return '15m+ 超高空：务必挂失手绳+收线限位，铅重已按高空风线加重，防止大物拖线';
  }
  function searchText(f, depthNum){
    if(f.id === 'silver') return '上层鱼：从水面下 1-2m 开始搜，每次上提 30cm，共约 ' + Math.ceil(depthNum / 0.3) + ' 层';
    if(['culter','qingshao','redfin','minnow','whitebait','ganyu'].indexOf(f.id) >= 0){
      return '中上层鱼：从 0.5-1.5m 水层起搜，缓降+点搜结合，共约 ' + Math.ceil(depthNum / 0.3) + ' 层';
    }
    if(f.id === 'grass') return '草鱼中下层：高温搜半水，早晚贴底；从底部向上每次上提 30cm';
    if(['wei','huziniang','chachawei','wuni'].indexOf(f.id) >= 0) return '底层守钓型：重窝守底，竿稍微弯待命，大弯弓再打';
    return '底层鱼：从底部向上搜层，每次上提 30cm，共约 ' + Math.ceil(depthNum / 0.3) + ' 层；无口再逐层下探';
  }
  function render(inp){
    const f = (DATA.fishProfiles || {})[inp.fishId];
    if(!f) return;
    const lead = clamp(LEAD_BASE[inp.depthKey] + inp.flow.lead + inp.wind.lead + (f.leadBias || 0) + BRIDGE_ADJ[inp.bridgeKey], 3, 20);
    const speed = fallSpeed(lead);
    const fallTime = Math.round(inp.depthNum / speed * 10) / 10;
    const tip = tipSize(lead);
    const range = leadRangeText(lead);
    const season = (DATA.monthSeason || {})[inp.month] || '夏';
    let matchNote;
    if(inp.wind.id === 'strong' || inp.flow.id === 'strong' || inp.flow.id === 'rapid') matchNote = '<span class="match-good">✅ 大风/大流，建议取区间上限，抗风抗流</span>';
    else if(inp.bridgeKey === 'ultra') matchNote = '<span class="match-good">✅ 高空已加铅，按区间中值即可</span>';
    else if(f.leadBias < 0) matchNote = '<span class="match-good">✅ 小型鱼轻口，取区间下限</span>';
    else matchNote = '<span class="match-good">✅ 匹配良好，区间内取中值</span>';
    let tipNote = tip;
    if(inp.bridgeKey === 'ultra' && lead >= 12) tipNote += '（建议全钛，抗风耐磨）';
    else if(inp.bridgeKey === 'high' && lead >= 12) tipNote += '（建议偏硬竿稍）';
    Utils.$('calcResultTitle').textContent = '推荐钓组方案 · ' + f.name + '（' + inp.month + '月 · ' + season + '季）';
    Utils.$('resTip').textContent = tipNote;
    Utils.$('resLeadRange').textContent = range;
    Utils.$('resLead').textContent = lead + ' g';
    Utils.$('resLeadMatch').innerHTML = matchNote;
    Utils.$('resLine').textContent = f.rig.main + ' / ' + f.rig.sub;
    Utils.$('resHook').textContent = f.rig.hook;
    Utils.$('resMethod').textContent = f.methods.map(m => {
      const meta = (DATA.strategy.methods || []).find(x => x.name.indexOf(m) >= 0 || m.indexOf(x.name) >= 0);
      return meta ? m + '（' + meta.tag + '）' : m;
    }).join('、');
    Utils.$('resBridge').textContent = bridgeText(inp.bridgeKey);
    Utils.$('resFallTime').textContent = fallTime + ' 秒（' + inp.depthNum + 'm / ' + speed + ' m/s）';
    Utils.$('resFallSpeed').textContent = '缓降速度约 ' + speed + ' m/s' + (lead >= 12 ? '（重铅缓降偏快，钓底为主）' : '（利于搜层）');
    Utils.$('resSearch').textContent = searchText(f, inp.depthNum);
    const tips = buildTips(inp, f);
    Utils.$('resTipsTitle').textContent = '作钓小贴士（' + f.name + ' · ' + inp.month + '月 · ' + inp.flow.name + ' · ' + inp.wind.name + '）：';
    Utils.$('resTips').innerHTML = tips.map(t => '<li>' + Utils.esc(t) + '</li>').join('');
    const toMatch = Utils.$('toMatch');
    if(toMatch){ toMatch.textContent = '🎣 查看 ' + f.name + ' 配饵方案 →'; toMatch.onclick = function(){ openMatch(f.id, inp.month); }; }
    const toTech = Utils.$('toTech');
    if(toTech){ toTech.textContent = '📖 查看 ' + f.name + ' 手册 →'; toTech.onclick = function(){ jumpToFish(f.id); }; }
    Utils.$('calcEcho').hidden = true;
    Bridge.post('calc', { fish: f.name, month: inp.month, depth: inp.depthNum, bridge: inp.bridgeNum, lead: lead, fallTime: fallTime });
  }
  function run(){
    const inp = readInputs();
    Utils.$('depthMsg').classList.remove('show');
    Utils.$('bridgeMsg').classList.remove('show');
    Utils.$('calcDepthNum').classList.remove('field-error');
    Utils.$('calcBridgeNum').classList.remove('field-error');
    if(inp.errors.length){
      inp.errors.forEach(k => { Utils.$(k).classList.add('show'); });
      const key = inp.errors.includes('depthMsg') ? 'calcDepthNum' : 'calcBridgeNum';
      Utils.$(key).classList.add('field-error');
      Toast.show('输入不合法：请检查水深 / 桥高数值范围', 'warn');
      Utils.$('calcEcho').textContent = '⚠️ 输入有误，未计算：' + (inp.errors.includes('depthMsg') ? '水深需在 0.5~50 米之间。' : '') + (inp.errors.includes('bridgeMsg') ? '桥高需在 1~60 米之间。' : '');
      Utils.$('calcEcho').hidden = false;
      return;
    }
    render(inp);
  }
  function bind(){
    Utils.$('calcBtn').addEventListener('click', run);
    Utils.$('calcDepthNum').addEventListener('input', e => {
      const v = e.target.value.trim();
      if(v === ''){ Utils.$('calcDepth').value = 'mid'; return; }
      const n = parseFloat(v);
      if(!isFinite(n)) return;
      if(n >= 0.5 && n <= 50) Utils.$('calcDepth').value = depthKeyFromNum(n);
    });
    Utils.$('calcBridgeNum').addEventListener('input', e => {
      const v = e.target.value.trim();
      if(v === ''){ Utils.$('calcBridge').value = 'mid'; return; }
      const n = parseFloat(v);
      if(!isFinite(n)) return;
      if(n >= 1 && n <= 60) Utils.$('calcBridge').value = bridgeKeyFromNum(n);
    });
    Utils.$('calcFish').addEventListener('change', e => {
      FishContext.set(e.target.value);
      const f = (DATA.fishProfiles || {})[e.target.value];
      if(!f) return;
      const tm = Utils.$('toMatch'), tg = Utils.$('toTech');
      if(tm) tm.textContent = '🎣 查看 ' + f.name + ' 配饵方案 →';
      if(tg) tg.textContent = '📖 查看 ' + f.name + ' 手册 →';
    });
    Utils.$('calcMonth').addEventListener('change', e => {
      const m = parseInt(e.target.value, 10);
      const season = (DATA.monthSeason || {})[m] || '';
      Utils.$('monthMsg').textContent = '当前：' + m + '月 · ' + season + '季';
    });
  }
  return { bind: bind, run: run };
})();

/* ============================================================
 * Tech（桥筏作战手册：① 选位标点 → ② 主流钓法 → ③ 基础操作）
 * 按出钓流程整合，选目标鱼后自动聚焦适用内容
 * ============================================================ */
const Tech = (() => {
  function relFishTag(fishId){
    const f = (DATA.fishProfiles || {})[fishId];
    if(!f) return '';
    return '<span class="rel-link" data-jump="' + fishId + '" style="cursor:pointer">' + f.name + '</span>';
  }
  function bindJumps(root){
    root.querySelectorAll('[data-jump]').forEach(el => {
      if(el.dataset.bound) return;
      el.dataset.bound = '1';
      el.addEventListener('click', function(){ jumpToFish(el.dataset.jump); });
    });
  }
  function focusTag(f, label){
    if(!f) return '';
    return '<span class="st-tag" style="background:#fff;color:var(--brand2);">🎯 ' + label + '</span>';
  }
  function renderSpots(filterFish){
    const box = Utils.$('t-spots');
    if(!box) return;
    const f = filterFish ? (DATA.fishProfiles || {})[filterFish] : null;
    let html = '<div class="sub-title">① 选位标点 <span class="st-tag">先去哪钓</span>' + focusTag(f, f ? f.name + ' 适用' : '') + '</div>';
    const spots = (DATA.strategy.spots || []).filter(s => !filterFish || (s.fish || []).includes(filterFish));
    if(!spots.length){
      html += '<div class="warn-box">该鱼种暂无独立推荐标点，参考总览中的通用选位。</div>';
    } else {
      html += '<div class="grid">';
      spots.forEach(s => {
        const fish = filterFish ? (s.fish || []).filter(x => x === filterFish) : (s.fish || []);
        html += '<div class="card"><h4>' + Utils.esc(s.name) + ' <span class="tag green">' + Utils.esc(s.tag) + '</span></h4><ul>' +
          s.points.map(p => '<li>' + Utils.esc(p) + '</li>').join('') + '</ul>' +
          '<div style="margin-top:8px;line-height:2.1;">适合鱼种：' + (fish.map(relFishTag).join('') || '—') + '</div></div>';
      });
      html += '</div>';
    }
    box.innerHTML = html;
    bindJumps(box);
  }
  function renderMethods(filterFish){
    const box = Utils.$('t-methods');
    if(!box) return;
    const f = filterFish ? (DATA.fishProfiles || {})[filterFish] : null;
    let html = '<div class="sub-title">② 主流钓法 <span class="st-tag">怎么钓 · 台钓桥筏化已标注</span>' + focusTag(f, f ? f.name + ' 适用' : '') + '</div>';
    const methods = (DATA.strategy.methods || []).filter(m => !filterFish || (m.suits || []).includes(filterFish));
    if(!methods.length){
      html += '<div class="warn-box">该鱼种暂无独立推荐钓法，参考通用钓法或总览。</div>';
    } else {
      html += '<div class="grid">';
      methods.forEach(m => {
        const suits = filterFish ? (m.suits || []).filter(s => s === filterFish) : (m.suits || []);
        html += '<div class="card"><h4>' + Utils.esc(m.name) + ' <span class="tag green">' + Utils.esc(m.tag) + '</span></h4><ul>' +
          m.desc.map(d => '<li>' + Utils.esc(d) + '</li>').join('') + '</ul>' +
          '<div style="margin-top:8px;line-height:2.1;">适用鱼种：' + (suits.map(relFishTag).join('') || '—') + '</div></div>';
      });
      html += '</div>';
    }
    box.innerHTML = html;
    bindJumps(box);
  }
  function renderOps(filterFish){
    const box = Utils.$('t-ops');
    if(!box) return;
    const f = filterFish ? (DATA.fishProfiles || {})[filterFish] : null;
    let html = '<div class="sub-title">③ 基础操作 <span class="st-tag">具体动作 · 全鱼种通用</span>' + focusTag(f, f ? f.name + ' 要点' : '') + '</div>';
    if(f){
      const notes = (f.notes || []).map(n => '<li>' + Utils.esc(n) + '</li>').join('');
      html += '<div class="ok-box"><b>🎯 ' + f.name + ' 操作要点：</b><ul style="margin-left:18px;margin-top:4px;">' + (notes || '<li>参考下方通用操作</li>') + '</ul></div>';
    }
    html += '<div class="grid">';
    (DATA.strategy.operations || []).forEach(o => {
      html += '<div class="card"><h4>' + Utils.esc(o.name) + ' <span class="tag gold">' + Utils.esc(o.tag) + '</span></h4><ul>' +
        o.desc.map(d => '<li>' + Utils.esc(d) + '</li>').join('') + '</ul></div>';
    });
    html += '</div>';
    html += '<div class="danger-box"><b>安全红线（上桥必看）：</b>雷雨天气禁止上桥作钓 · 高压线下方严禁抛竿 · 上桥走人行道侧注意车辆 · 失手绳必挂护栏 · 桥面湿滑小心脚下</div>';
    box.innerHTML = html;
  }
  function render(filterFish){
    renderSpots(filterFish);
    renderMethods(filterFish);
    renderOps(filterFish);
  }
  return { render: render };
})();

/* 全局联动：跳转目标鱼（打开配饵方案） */
function jumpToFish(fishId){
  const f = (DATA.fishProfiles || {})[fishId];
  Utils.$('matchFish').value = fishId;
  BaitMatch.render();
  document.getElementById('s-bait').scrollIntoView({ behavior:'smooth' });
  Toast.show('已打开 ' + (f ? f.name : '') + ' 的配饵方案', 'info');
  Bridge.post('guide_fish', { fish: f ? f.name : fishId });
}
function openMatch(fishId, month){
  BaitMatch.setFish(fishId);
  if(month && Utils.$('matchMonth')){ Utils.$('matchMonth').value = String(month); }
  BaitMatch.render();
  document.getElementById('s-bait').scrollIntoView({ behavior:'smooth' });
  Toast.show('已生成 ' + ((DATA.fishProfiles || {})[fishId] ? DATA.fishProfiles[fishId].name : '') + ' 配饵方案', 'info');
}

/* ============================================================
 * Search（站内搜索）
 * ============================================================ */
const Search = (() => {
  let index = [];
  function buildIndex(){
    index = [];
    Object.keys(DATA.fishProfiles || {}).forEach(id => {
      const f = DATA.fishProfiles[id];
      index.push({ sec:'鱼种', title:f.name + '（' + f.aliases + '）', text:f.habitat + ' ' + f.flavor + ' ' + f.formula, type:'fish', id:id });
    });
    (DATA.strategy.methods || []).forEach(m => {
      index.push({ sec:'主流钓法', title:m.name, text:m.desc.join(' '), type:'block', id:'t-methods' });
    });
    (DATA.strategy.operations || []).forEach(o => {
      index.push({ sec:'基础操作', title:o.name, text:o.desc.join(' '), type:'block', id:'t-ops' });
    });
    (DATA.strategy.spots || []).forEach(s => {
      index.push({ sec:'选位标点', title:s.name, text:s.points.join(' '), type:'block', id:'t-spots' });
    });
    (DATA.baits || []).forEach(b => {
      index.push({ sec:'饵料', title:b.brand + ' · ' + b.name, text:(b.waterRatio || '') + ' ' + b.note, type:'bait', name:b.name });
    });
  }
  function hl(text, kw){
    const esc = Utils.esc(text);
    if(!kw) return esc;
    const k = kw.toLowerCase(), kl = k.length;
    let out = '', rest = esc, lower = esc.toLowerCase(), pos;
    while((pos = lower.indexOf(k)) >= 0 && out.length < 400){
      out += rest.slice(0, pos) + '<mark class="hl">' + rest.slice(pos, pos + kl) + '</mark>';
      rest = rest.slice(pos + kl); lower = rest.toLowerCase();
    }
    return out + rest.slice(0, 200);
  }
  function score(ix, kw){
    const k = kw.toLowerCase();
    let s = (ix.title.toLowerCase().indexOf(k) >= 0) ? 2 : 1;
    if(ix.type === 'bait' || ix.type === 'fish') s += 0.5;
    return s;
  }
  function renderPanel(kw){
    const panel = Utils.$('searchPanel');
    if(!panel) return;
    if(!kw){ panel.hidden = true; return; }
    const hits = index.filter(ix => (ix.title + ix.text).toLowerCase().indexOf(kw.toLowerCase()) >= 0)
      .sort((a, b) => score(b, kw) - score(a, kw))
      .slice(0, 30);
    if(!hits.length){
      panel.innerHTML = '<div class="search-empty">未找到「' + Utils.esc(kw) + '」，换个关键词试试（如鱼名、饵料名、钓法）</div>';
    } else {
      panel.innerHTML = hits.map(h => {
        return '<div class="search-item" data-srch="' + Utils.esc(JSON.stringify(h)) + '">' +
          '<div class="si-sec">' + h.sec + '</div>' +
          '<div class="si-title" style="font-weight:600;color:#0b4250;">' + hl(h.title, kw) + '</div>' +
          '<div class="si-text">' + hl(h.text.slice(0, 60), kw) + '</div></div>';
      }).join('');
      panel.querySelectorAll('.search-item').forEach(el => {
        el.addEventListener('click', function(){
          const h = JSON.parse(el.dataset.srch);
          if(h.type === 'fish'){ Utils.$('matchFish').value = h.id; BaitMatch.render(); document.getElementById('s-bait').scrollIntoView({behavior:'smooth'}); }
          else if(h.type === 'bait'){ document.getElementById('s-bait').scrollIntoView({behavior:'smooth'}); BaitView.setKw(h.name); Toast.show('已定位饵料：' + h.name, 'info'); }
          else document.getElementById(h.id).scrollIntoView({behavior:'smooth'});
          panel.hidden = true;
          Utils.$('pageSearch').value = '';
        });
      });
    }
    panel.hidden = false;
  }
  function bind(){
    buildIndex();
    const input = Utils.$('pageSearch');
    input.addEventListener('input', Utils.debounce(e => renderPanel(e.target.value.trim()), 220));
    input.addEventListener('keydown', e => { if(e.key === 'Enter') renderPanel(input.value.trim()); });
    document.addEventListener('click', e => {
      if(!e.target.closest('.nav-search')) Utils.$('searchPanel').hidden = true;
    });
  }
  return { bind: bind };
})();

/* ============================================================
 * UI（导航高亮 / 回到顶部 / 环境标记 / 版本显示 / 检查更新）
 * ============================================================ */
const UI = (() => {
  const navLinks = [];
  function bindNav(){
    document.querySelectorAll('.topnav a').forEach(a => navLinks.push(a));
    const sections = ['s0','s-bait','s-tech'].map(id => document.getElementById(id)).filter(Boolean);
    const techBlocks = ['t-ops','t-methods','t-spots'].map(id => document.getElementById(id)).filter(Boolean);
    const onScroll = Utils.throttleRaf(() => {
      const y = window.scrollY + 130;
      let cur = 's0';
      sections.forEach(s => { if(s.offsetTop <= y) cur = s.id; });
      navLinks.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + cur));
      let curBlock = null;
      techBlocks.forEach(b => { if(b.offsetTop <= y + 20) curBlock = b.id; });
      document.querySelectorAll('#techNav a').forEach(a => {
        a.style.background = (a.getAttribute('href') === '#' + curBlock) ? '#e4f1f3' : '';
      });
    });
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }
  function bindTop(){
    const btn = Utils.$('topBtn');
    const onScroll = Utils.throttleRaf(() => {
      btn.style.display = window.scrollY > 480 ? 'block' : 'none';
    });
    window.addEventListener('scroll', onScroll, { passive: true });
    btn.addEventListener('click', function(){ window.scrollTo({ top: 0, behavior: 'smooth' }); });
  }
  function envMark(){
    const tag = Utils.$('envTag');
    if(tag){
      if(Env.isWxWebview){ tag.hidden = false; tag.textContent = '小程序 web-view'; }
      else if(Env.isWechat){ tag.hidden = false; tag.textContent = '微信内置浏览器'; }
      else if(Env.isFile){ tag.hidden = false; tag.textContent = '本地模式'; }
    }
    const foot = Utils.$('footEnv');
    if(foot){
      if(Env.isFile) foot.textContent = '· 本地打开：天气接口与 PWA 离线缓存需部署到 HTTPS 后完整生效';
      else if(Env.isHttps) foot.textContent = '· HTTPS 模式：PWA 离线缓存已启用';
      else foot.textContent = '· HTTP 模式：PWA 离线缓存需 HTTPS 生效';
    }
  }
  function checkUpdate(manual){
    if(typeof fetch !== 'function'){ if(manual) Toast.show('当前浏览器不支持检查更新', 'warn'); return; }
    fetch('./data.js?_=' + Date.now(), { cache:'no-store' })
      .then(r => r.text())
      .then(text => {
        const m = text.match(/window\.QIAOFA_DATA_VERSION\s*=\s*'([^']+)'/);
        const latest = m ? m[1] : null;
        if(latest && latest !== DATA_VERSION){
          Toast.show('发现新数据版本 v' + latest + '，正在刷新…', 'info');
          setTimeout(function(){ location.reload(); }, 1200);
        } else if(manual){
          Toast.show('已是最新版本 v' + DATA_VERSION, 'info');
        }
      })
      .catch(() => {
        if(manual) Toast.show('检查更新失败（离线或网络异常）', 'warn');
      });
  }
  function bind(){
    bindNav();
    bindTop();
    envMark();
    const ver = Utils.$('footVer');
    if(ver) ver.textContent = 'v' + DATA_VERSION;
    const cb = Utils.$('checkBtn');
    if(cb) cb.addEventListener('click', function(){ checkUpdate(true); });
    /* 启动后静默检查一次更新 */
    setTimeout(function(){ checkUpdate(false); }, 8000);
  }
  return { bind: bind };
})();

/* ============================================================
 * Collapse（三大模块折叠/展开）
 * ============================================================ */
const Collapse = (() => {
  const SECTIONS = ['s0', 's-bait', 's-tech'];
  function updateBtn(){
    const btn = Utils.$('foldAllBtn');
    if(!btn) return;
    const allCollapsed = SECTIONS.every(id => {
      const sec = document.getElementById(id);
      return sec && sec.classList.contains('collapsed');
    });
    btn.textContent = allCollapsed ? '⤵ 全部展开' : '⤴ 全部折叠';
  }
  function setState(id, collapsed){
    const sec = document.getElementById(id);
    if(!sec) return;
    sec.classList.toggle('collapsed', collapsed);
    const head = sec.querySelector('.sec-head');
    if(head) head.setAttribute('aria-expanded', String(!collapsed));
  }
  function expandForHash(hash){
    if(!hash) return;
    const id = hash.slice(1);
    if(SECTIONS.indexOf(id) >= 0){
      setState(id, false);
      updateBtn();
    }
  }
  function init(){
    SECTIONS.forEach(id => {
      const sec = document.getElementById(id);
      if(!sec) return;
      sec.setAttribute('data-foldable', '1');
      const head = sec.querySelector('.sec-head');
      if(!head) return;
      head.classList.add('collapsible');
      head.setAttribute('role', 'button');
      head.setAttribute('tabindex', '0');
      head.setAttribute('aria-expanded', 'true');
      const arrow = document.createElement('span');
      arrow.className = 'collapse-arrow';
      arrow.textContent = '▲';
      head.appendChild(arrow);
      const toggle = () => {
        const collapsed = !sec.classList.contains('collapsed');
        setState(id, collapsed);
        updateBtn();
      };
      head.addEventListener('click', toggle);
      head.addEventListener('keydown', e => {
        if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); toggle(); }
      });
    });
    const allBtn = Utils.$('foldAllBtn');
    if(allBtn){
      allBtn.addEventListener('click', () => {
        const anyOpen = SECTIONS.some(id => {
          const sec = document.getElementById(id);
          return sec && !sec.classList.contains('collapsed');
        });
        SECTIONS.forEach(id => setState(id, anyOpen));
        updateBtn();
        Toast.show(anyOpen ? '已全部折叠，点击标题栏可展开' : '已全部展开', 'info');
      });
    }
    updateBtn();
    window.addEventListener('hashchange', () => expandForHash(location.hash));
    expandForHash(location.hash);
  }
  return { init: init };
})();

/* ============================================================
 * boot（启动：填充下拉 / 渲染 / 绑定 / 天气初始化 / SW 注册）
 * ============================================================ */
(function boot(){
  if(!FISH_ORDER.length){
    document.body.innerHTML = '<div style="padding:60px 20px;text-align:center;font-size:1.1rem;color:#c94b4b;">数据文件 data.js 加载失败，请检查部署（应包含 data.js 文件）。</div>';
    return;
  }
  /* 月份下拉（默认跟随当前真实月份） */
  const nowMonth = new Date().getMonth() + 1;
  const monthOpts = [1,2,3,4,5,6,7,8,9,10,11,12].map(m => {
    const s = (DATA.monthSeason || {})[m] || '';
    return '<option value="' + m + '">' + m + '月（' + s + '季）</option>';
  }).join('');
  const calcMonth = Utils.$('calcMonth'), matchMonth = Utils.$('matchMonth');
  if(calcMonth){ calcMonth.innerHTML = monthOpts; calcMonth.value = String(nowMonth); }
  if(matchMonth){ matchMonth.innerHTML = monthOpts; matchMonth.value = String(nowMonth); }
  /* 鱼种下拉 */
  const fishOpts = FISH_ORDER.map(id => {
    const f = DATA.fishProfiles[id];
    return '<option value="' + f.id + '">' + f.name + (f.aliases ? '（' + f.aliases.split(' · ')[0] + '）' : '') + '</option>';
  }).join('');
  const calcFish = Utils.$('calcFish'), matchFish = Utils.$('matchFish'), targetFish = Utils.$('targetFish'), techFish = Utils.$('techFish'), mybFish = Utils.$('mybFish');
  if(calcFish){ calcFish.innerHTML = fishOpts; calcFish.value = 'crucian'; }
  if(matchFish){ matchFish.innerHTML = fishOpts; matchFish.value = 'crucian'; }
  if(targetFish){ targetFish.innerHTML = fishOpts; targetFish.value = 'crucian'; }
  if(techFish){
    techFish.innerHTML = '<option value="">全部鱼种</option>' + fishOpts;
    techFish.addEventListener('change', e => {
      Tech.render(e.target.value || null);
    });
  }
  if(mybFish){ mybFish.innerHTML = '<option value="">不限鱼种</option>' + fishOpts; }
  /* 水流 / 风力下拉（计算器） */
  const flowSel = Utils.$('calcFlow'), windSel = Utils.$('calcWind');
  if(flowSel) flowSel.innerHTML = (DATA.flows || []).map(f => '<option value="' + f.id + '">' + Utils.esc(f.name) + '</option>').join('');
  if(windSel) windSel.innerHTML = (DATA.winds || []).map(w => '<option value="' + w.id + '">' + Utils.esc(w.name) + '</option>').join('');
  /* 初始化月份季节提示 */
  const ms = Utils.$('monthMsg');
  if(ms) ms.textContent = '当前：' + nowMonth + '月 · ' + ((DATA.monthSeason || {})[nowMonth] || '') + '季';
  /* 模块绑定 */
  BaitView.bind();
  BaitMatch.bind();
  MyBaits.bind();
  MyBaits.render();
  Calc.bind();
  Tech.render(null);
  Search.bind();
  UI.bind();
  Collapse.init();
  Weather.bind();
  Weather.init();
  /* PWA：注册 Service Worker */
  if('serviceWorker' in navigator && location.protocol !== 'file:' && window.isSecureContext){
    window.addEventListener('load', function(){
      navigator.serviceWorker.register('./sw.js').then(function(reg){
        console.log('[PWA] Service Worker 已注册，scope:', reg.scope);
      }).catch(function(err){
        console.warn('[PWA] Service Worker 注册失败：', err && err.message ? err.message : err);
      });
    });
  }
  Bridge.post('ready', { env: Env.isFile ? 'file' : (Env.isHttps ? 'https' : 'http'), fishCount: FISH_ORDER.length, baitCount: (DATA.baits || []).length, version: DATA_VERSION });
})();
