const navItems=document.querySelectorAll('[data-page]');
const pages=document.querySelectorAll('.page');
const title=document.getElementById('pageTitle');
const titles={dashboard:'Olá, Nutri',clientes:'Pacientes',alimentacao:'Alimentação',plano:'Plano alimentar',calculadora:'Calculadora metabólica',agua:'Hidratação',evolucao:'Evolução',receitas:'Receitas'};

function showPage(id){
  const target=document.getElementById(id);
  if(!target)return;
  pages.forEach(p=>p.classList.toggle('active-page',p.id===id));
  document.querySelectorAll('.nav-item[data-page]').forEach(n=>n.classList.toggle('active',n.dataset.page===id));
  if(title)title.textContent=titles[id]||'NutriFit';
  localStorage.setItem('nutrifit-page',id);
  document.querySelector('.sidebar')?.classList.remove('open');
  document.getElementById('sidebarOverlay')?.classList.remove('open');
  if(id==='calculadora' && typeof window.loadSelectedPatientCalculator==='function') window.loadSelectedPatientCalculator();
  window.scrollTo({top:0,behavior:'smooth'});
}
navItems.forEach(n=>n.addEventListener('click',e=>{e.preventDefault();showPage(n.dataset.page)}));

const savedPage=localStorage.getItem('nutrifit-page');
showPage(savedPage && document.getElementById(savedPage) ? savedPage : 'dashboard');

const themeToggle=document.getElementById('themeToggle');
function applyTheme(theme){
  const dark=theme==='dark';
  document.body.classList.toggle('dark',dark);
  if(themeToggle){themeToggle.textContent=dark?'☀':'◐';themeToggle.setAttribute('aria-label',dark?'Ativar tema claro':'Ativar tema escuro')}
  localStorage.setItem('nutrifit-theme',theme);
}
const storedTheme=localStorage.getItem('nutrifit-theme');
const prefersDark=window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
applyTheme(storedTheme || (prefersDark ? 'dark' : 'light'));
themeToggle?.addEventListener('click',()=>applyTheme(document.body.classList.contains('dark')?'light':'dark'));

function toggleSidebar(forceOpen){
  const sidebar=document.querySelector('.sidebar');
  const overlay=document.getElementById('sidebarOverlay');
  if(!sidebar)return;
  const open=typeof forceOpen==='boolean' ? forceOpen : !sidebar.classList.contains('open');
  sidebar.classList.toggle('open',open);
  overlay?.classList.toggle('open',open);
}
document.getElementById('mobileMenu')?.addEventListener('click',()=>toggleSidebar());
document.getElementById('bottomNavMore')?.addEventListener('click',()=>toggleSidebar());
document.getElementById('sidebarOverlay')?.addEventListener('click',()=>toggleSidebar(false));

let water=Number(localStorage.getItem('nutrifit-water')||1800);
function currentWaterGoal(){
  try{if(typeof selectedPatient!=='undefined' && selectedPatient?.waterGoal)return Number(selectedPatient.waterGoal)||2500}catch(e){}
  return 2500;
}
function updateWater(){
  const goal=Math.max(500,currentWaterGoal());
  water=Math.max(0,Math.min(goal,water));
  localStorage.setItem('nutrifit-water',water);
  const liters=document.getElementById('waterLiters');
  const bar=document.getElementById('waterBar');
  const visualFill=document.querySelector('.water-fill');
  const dashTotal=document.getElementById('dashboardWaterTotal');
  const dashHint=document.getElementById('dashboardWaterHint');
  const pct=Math.min(100,(water/goal)*100);
  const remaining=Math.max(0,goal-water);
  if(liters)liters.textContent=(water/1000).toFixed(1).replace('.',',')+' L';
  if(bar)bar.style.width=pct+'%';
  if(visualFill)visualFill.style.height=pct+'%';
  if(dashTotal)dashTotal.innerHTML=`${(water/1000).toFixed(1).replace('.',',')} <small>/ ${(goal/1000).toFixed(1).replace('.',',')} L</small>`;
  if(dashHint)dashHint.innerHTML=remaining?`Faltam <b>${remaining.toLocaleString('pt-BR')} ml</b> para atingir sua meta.`:'<b>Meta de hidratação atingida.</b>';
}
document.querySelectorAll('[data-water]').forEach(b=>b.addEventListener('click',()=>{water+=Number(b.dataset.water);updateWater();if(typeof renderDashboard==='function')renderDashboard()}));
updateWater();

const calc=document.getElementById('calcForm');
calc?.addEventListener('submit',e=>{
  e.preventDefault();
  const sex=document.getElementById('sex').value;
  const age=Number(document.getElementById('age').value);
  const weight=Number(document.getElementById('weight').value);
  const height=Number(document.getElementById('height').value);
  const activity=Number(document.getElementById('activity').value);
  if(!age||!weight||!height||age<10||weight<=0||height<=0)return;
  const bmr=10*weight+6.25*height-5*age+(sex==='m'?5:-161);
  const tdee=bmr*activity;
  const objective=String(document.getElementById('objective')?.value||selectedPatient?.objective||'').toLowerCase();
  let target=tdee;
  if(objective.includes('emag')) target=tdee-500;
  else if(objective.includes('massa')||objective.includes('hipertrof')) target=tdee+250;
  target=Math.max(1200,Math.round(target/50)*50);
  const protein=Math.round(weight*(objective.includes('massa')||objective.includes('hipertrof')?1.8:1.6));
  const remaining=Math.max(0,target-protein*4);
  const carbs=Math.round((remaining*.60)/4);
  const fat=Math.round((remaining*.40)/9);
  const fmt=n=>Math.round(n).toLocaleString('pt-BR')+' kcal';
  document.getElementById('bmr').textContent=fmt(bmr);
  document.getElementById('tdee').textContent=fmt(tdee);
  document.getElementById('maintenance').textContent=fmt(tdee);
  document.getElementById('deficit').textContent=fmt(Math.max(0,tdee-500));
  const pid=calc.dataset.patientId||selectedPatient?.id;
  if(pid){const all=JSON.parse(localStorage.getItem('nutrifit-calculator-meta')||'{}');all[pid]={calories:target,protein,carbs,fat,bmr:Math.round(bmr),tdee:Math.round(tdee),activity,objective,sex,age,weight,height,updatedAt:new Date().toISOString()};localStorage.setItem('nutrifit-calculator-meta',JSON.stringify(all));}
});

// ===============================
// SELEÇÃO E CARREGAMENTO DE PACIENTE
// ===============================
const patients = [];
let selectedPatient = null;
let pendingPatient = null;
let patientPlans = {};
try{ patientPlans=JSON.parse(localStorage.getItem('nutrifit-patient-plans')||'{}')||{}; }catch(e){ patientPlans={}; }
function persistPlans(){localStorage.setItem('nutrifit-patient-plans',JSON.stringify(patientPlans))}
function getPlan(){return selectedPatient ? patientPlans[selectedPatient.id] || null : null}
function formatKcal(n){return Math.round(Number(n)||0).toLocaleString('pt-BR')}
function getDisplayPlanMeals(plan,p){
  const base=BUILDER_MEALS.map(m=>({...m,items:[]}));
  if(!plan)return base;
  const source=Array.isArray(plan.meals)?plan.meals:[];
  source.forEach((m,mi)=>{
    const target=base.find(x=>x.name===m.name)||base.find(x=>x.id===m.id)||base[mi]||base[0];
    const foods=Array.isArray(m.foods)?m.foods:[];
    if(foods.length){
      foods.forEach(f=>{
        const key=f.key||foodKey(f);
        if(key && foodCatalog[key]) target.items.push({key,amount:Number(f.amount)||builderDefaultAmount(foodCatalog[key])});
      });
    }else if(Array.isArray(m.items)){
      m.items.forEach(text=>{
        const match=String(text).match(/^(.+?)\s+—\s+(\d+(?:[.,]\d+)?)\s*(g|un)?/i);
        if(!match)return;
        const byName=Object.keys(foodCatalog).find(k=>foodCatalog[k].name.toLowerCase()===match[1].trim().toLowerCase());
        if(byName)target.items.push({key:byName,amount:Number(String(match[2]).replace(',','.'))||builderDefaultAmount(foodCatalog[byName])});
      });
    }
  });
  return base.filter(m=>m.items.length||source.length===0);
}
function renderAlimentacao(){
  const box=byId('foodPlanContent'), sub=byId('foodPageSubtitle'), add=byId('foodAddPlanBtn');
  if(!box)return;
  const p=selectedPatient, plan=getPlan();
  if(add)add.disabled=!p;
  if(!p){
    if(sub)sub.textContent='Selecione um paciente para visualizar a alimentação.';
    box.innerHTML='<div class="food-empty card"><div class="food-empty-icon">—</div><h3>Nenhum paciente selecionado</h3><p>A alimentação só será exibida depois que um paciente for selecionado.</p></div>';
    return;
  }
  if(!plan){
    if(sub)sub.textContent=`Nenhum plano alimentar atribuído a ${p.name}.`;
    box.innerHTML=`<div class="food-empty card"><div class="food-empty-icon">+</div><span class="eyebrow">SEM PLANO ALIMENTAR</span><h3>${escapeHtml(p.name)} ainda não possui um plano.</h3><p>Nenhuma refeição, caloria ou nutriente fictício será exibido. Adicione um plano ou gere uma sugestão baseada na calculadora metabólica.</p><button class="primary" type="button" id="foodEmptyAddPlan">Adicionar plano</button></div>`;
    return;
  }
  const meals=getDisplayPlanMeals(plan,p);
  const allItems=meals.flatMap(m=>m.items||[]);
  const totals=allItems.reduce((a,it)=>{const f=foodCatalog[it.key];const n=foodNutrientsForAmount(f,it.amount);return {kcal:a.kcal+n.kcal,protein:a.protein+n.protein,carbs:a.carbs+n.carbs,fat:a.fat+n.fat}},{kcal:0,protein:0,carbs:0,fat:0});
  const target=Number(plan.calories||getPlanMeta(p).calories||0);
  const remaining=Math.round(target-totals.kcal);
  if(sub)sub.textContent=`Plano de ${p.name} · ${formatKcal(target)} kcal/dia`;
  box.innerHTML=`<div class="food-summary"><div><span>Meta diária</span><strong>${formatKcal(target)} kcal</strong></div><div><span>Plano montado</span><strong>${formatKcal(totals.kcal)} kcal</strong></div><div><span>Saldo</span><strong class="${remaining<0?'food-over':''}">${remaining>=0?formatKcal(remaining)+' kcal restantes':formatKcal(Math.abs(remaining))+' kcal acima'}</strong></div><div><span>Proteína</span><strong>${Math.round(totals.protein)} g</strong></div></div><article class="card table-card"><div class="card-head"><div><span class="eyebrow">PLANO ATIVO</span><h3>${escapeHtml(plan.name||'Plano alimentar')}</h3><p>Refeições, quantidades e valores nutricionais cadastrados para ${escapeHtml(p.name)}.</p></div><button class="outline-btn" id="foodEditPlanBtn" type="button">Editar plano</button></div>${meals.length?meals.map(m=>{const mac=mealMacros(m),suggested=Math.round(target*(BUILDER_MEALS.find(x=>x.id===m.id)?.share||0));return `<div class="food-meal"><div class="food-meal-title"><div><b>${escapeHtml(m.name)}</b><small>${m.time}</small></div><span>${formatKcal(mac.kcal)} kcal</span></div>${(m.items||[]).map(item=>{const f=foodCatalog[item.key],n=foodNutrientsForAmount(f,item.amount);return `<div class="food-item"><b>${escapeHtml(f.name)}</b><span>${builderAmountLabel(f,item.amount)} · ${n.kcal} kcal</span></div>`}).join('')}${mac.protein||mac.carbs||mac.fat?`<div class="food-nutrients"><span>Proteína ${mac.protein.toFixed(1)} g</span><span>Carboidratos ${mac.carbs.toFixed(1)} g</span><span>Gorduras ${mac.fat.toFixed(1)} g</span>${suggested?`<span>Meta ${formatKcal(suggested)} kcal</span>`:''}</div>`:''}</div>`}).join(''):'<div class="food-empty-inline">O plano está salvo, mas ainda não possui refeições cadastradas.</div>'}</article>`;
  byId('foodEditPlanBtn')?.addEventListener('click',()=>openMealPlanModal(true));
}
function defaultPlanMeals(p){return planForPatient(p,'')}
function renderPatientPlan(){
  const p=selectedPatient, grid=byId('patientPlanGrid'), remove=byId('removeMealPlanBtn'), sub=byId('planPageSubtitle');
  if(!grid)return;
  if(!p){
    if(sub)sub.textContent='Selecione um paciente para começar.';
    if(remove)remove.disabled=true;
    grid.innerHTML=`<div class="nf-builder-empty card"><div class="nf-builder-empty-icon"><img src="assets/icons/clipboard.svg" alt=""></div><div><span class="eyebrow">PACIENTE</span><h3>Nenhum paciente selecionado</h3><p>Selecione um paciente no topo do sistema para carregar as metas calculadas e montar o plano.</p></div></div>`;
    return;
  }
  const meta=getPlanMeta(p);
  const savedMeta=(()=>{try{return JSON.parse(localStorage.getItem('nutrifit-calculator-meta')||'{}')[p.id]||null}catch(e){return null}})();
  const plan=getPlan();
  if(remove)remove.disabled=!plan;
  if(sub)sub.textContent=`${p.name} · meta diária ${Number(meta.calories||0).toLocaleString('pt-BR')} kcal`;
  const currentDraft=getBuilderDraft(p.id);
  const meals=currentDraft.meals;
  const consumed=meals.reduce((a,m)=>a+mealKcal(m),0);
  const remaining=Math.round(Number(meta.calories||0)-consumed);
  const pct=meta.calories?Math.min(100,Math.max(0,consumed/meta.calories*100)):0;
  const savedLabel=savedMeta?'Calculada e armazenada':'Estimativa atual — calcule na aba Calculadora';
  grid.innerHTML=`
    <div class="nf-builder-top">
      <div class="nf-patient-card">
        <div class="avatar small-avatar">${p.initials||'PA'}</div>
        <div><span class="eyebrow">PACIENTE ATIVO</span><b>${p.name}</b><small>${p.objective||'Objetivo não informado'}</small></div>
      </div>
      <div class="nf-calorie-budget ${remaining<0?'over':''}">
        <div class="nf-budget-label"><span>Limite diário</span><b>${Number(meta.calories||0).toLocaleString('pt-BR')} kcal</b></div>
        <div class="nf-budget-bar"><i style="width:${pct}%"></i></div>
        <div class="nf-budget-foot"><span>Consumido no cardápio <b>${Math.max(0,consumed).toLocaleString('pt-BR')} kcal</b></span><strong>${remaining>=0?remaining.toLocaleString('pt-BR')+' kcal restantes':Math.abs(remaining).toLocaleString('pt-BR')+' kcal acima da meta'}</strong></div>
        <small class="nf-budget-source">${savedLabel}</small>
      </div>
    </div>

    <div class="nf-target-row">
      <div><span>Proteína</span><b>${Math.round(meta.protein||0)} g</b></div>
      <div><span>Carboidratos</span><b>${Math.round(meta.carbs||0)} g</b></div>
      <div><span>Gorduras</span><b>${Math.round(meta.fat||0)} g</b></div>
      <div><span>Refeições</span><b>${meals.filter(m=>m.items.length).length}/5</b></div>
    </div>

    <div class="nf-builder-grid">
      <section class="card nf-food-library">
        <div class="nf-builder-section-head"><div><span class="eyebrow">ALIMENTOS</span><h3>Escolha os alimentos</h3><p>Valores de referência e nutrientes por porção. Clique em adicionar para colocar no cardápio.</p></div></div>
        <div class="nf-food-search"><input id="builderFoodSearch" type="search" placeholder="Buscar alimento..."><span>kcal · P · C · G</span></div>
        <div id="builderFoodList" class="nf-builder-food-list"></div>
      </section>

      <section class="card nf-menu-card">
        <div class="nf-builder-section-head"><div><span class="eyebrow">CARDÁPIO</span><h3>Monte as refeições</h3><p>Cada refeição tem uma sugestão de calorias. O saldo diário é atualizado automaticamente.</p></div><button class="outline-btn" id="clearBuilderPlan" type="button">Limpar</button></div>
        <div class="nf-meal-suggestions" id="builderMealSuggestions"></div>
        <div class="nf-menu-list" id="builderMenuList"></div>
        <div class="nf-builder-save"><label>Nome do plano<input id="builderPlanName" value="${escapeHtml(plan?.name||`Plano alimentar — ${p.name}`)}" placeholder="Ex.: Plano alimentar — Semana 1"></label><button class="primary" id="saveBuilderPlan" type="button">Salvar plano</button></div>
      </section>
    </div>`;
  renderBuilderFoodList(p);
  renderBuilderMeals(p);
  bindBuilderEvents(p);
}

const BUILDER_MEALS=[
  {id:'breakfast',time:'07:00',name:'Café da manhã',share:.20},
  {id:'snack1',time:'10:00',name:'Lanche da manhã',share:.10},
  {id:'lunch',time:'12:30',name:'Almoço',share:.30},
  {id:'snack2',time:'16:30',name:'Lanche da tarde',share:.10},
  {id:'dinner',time:'20:00',name:'Jantar',share:.25},
  {id:'supper',time:'22:00',name:'Ceia',share:.05}
];
function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function getBuilderDraft(pid){
  try{
    const all=JSON.parse(localStorage.getItem('nutrifit-plan-builder-drafts')||'{}');
    const d=all[pid];
    if(d&&Array.isArray(d.meals))return d;
  }catch(e){}
  return {meals:BUILDER_MEALS.map(m=>({...m,items:[]}))};
}
function saveBuilderDraft(pid,draft){try{const all=JSON.parse(localStorage.getItem('nutrifit-plan-builder-drafts')||'{}');all[pid]=draft;localStorage.setItem('nutrifit-plan-builder-drafts',JSON.stringify(all))}catch(e){}}
function foodKcalForAmount(f,amount){const n=Number(amount)||0;return f.unit==='un'?f.kcal*n:f.kcal*(n/f.ref)}
function foodNutrientsForAmount(f,amount){const factor=f.unit==='un'?(Number(amount)||0):((Number(amount)||0)/f.ref);return {kcal:Math.round(f.kcal*factor),protein:+(f.protein*factor).toFixed(1),carbs:+(f.carbs*factor).toFixed(1),fat:+(f.fat*factor).toFixed(1)}}
function mealKcal(m){return (m.items||[]).reduce((a,it)=>a+foodKcalForAmount(foodCatalog[it.key],it.amount),0)}
function mealMacros(m){return (m.items||[]).reduce((a,it)=>{const n=foodNutrientsForAmount(foodCatalog[it.key],it.amount);return {kcal:a.kcal+n.kcal,protein:a.protein+n.protein,carbs:a.carbs+n.carbs,fat:a.fat+n.fat}},{kcal:0,protein:0,carbs:0,fat:0})}
function builderDefaultAmount(f){return f.unit==='un'?1:f.ref}
function builderAmountLabel(f,a){return f.unit==='un'?`${a} un`:`${a} g`}
function builderFoodKeyList(){return Object.keys(foodCatalog)}
function renderBuilderFoodList(p){
  const box=byId('builderFoodList');if(!box)return;
  const search=(byId('builderFoodSearch')?.value||'').trim().toLowerCase();
  const keys=builderFoodKeyList().filter(k=>{const f=foodCatalog[k];return !search||f.name.toLowerCase().includes(search)});
  const mealOptions=BUILDER_MEALS.map(m=>`<option value="${m.id}">${m.name}</option>`).join('');
  box.innerHTML=keys.map(k=>{const f=foodCatalog[k];return `<article class="nf-food-row"><div class="nf-food-main"><b>${escapeHtml(f.name)}</b><span>Referência: ${f.ref}${f.unit==='un'?' unidade':' g'}</span></div><div class="nf-food-nutrients"><b>${f.kcal}</b><span>kcal</span><span>${f.protein} P</span><span>${f.carbs} C</span><span>${f.fat} G</span></div><label class="nf-meal-picker"><span>Adicionar em</span><select class="builder-food-meal" data-food-key="${k}">${mealOptions}</select></label><button type="button" class="outline-btn nf-add-food" data-food-key="${k}">Adicionar</button></article>`}).join('')||'<div class="nf-empty-inline">Nenhum alimento encontrado.</div>';
}
function renderBuilderMeals(p){
  const draft=getBuilderDraft(p.id), meta=getPlanMeta(p), suggestions=byId('builderMealSuggestions'), list=byId('builderMenuList');
  if(!suggestions||!list)return;
  suggestions.innerHTML=BUILDER_MEALS.map(m=>{const actual=draft.meals.find(x=>x.id===m.id)||m;const kcal=Math.round(mealKcal(actual));const suggested=Math.round(meta.calories*m.share);const diff=kcal-suggested;return `<div class="nf-meal-suggestion"><span>${m.time}</span><div><b>${m.name}</b><small>Sugerido ${suggested.toLocaleString('pt-BR')} kcal</small></div><strong class="${diff>50?'warn':''}">${kcal.toLocaleString('pt-BR')} kcal</strong></div>`}).join('');
  list.innerHTML=draft.meals.map(m=>{const suggested=Math.round(meta.calories*m.share),mac=mealMacros(m);return `<article class="nf-builder-meal" data-meal-id="${m.id}"><div class="nf-builder-meal-head"><div><span>${m.time}</span><h4>${m.name}</h4></div><div class="nf-meal-kcal"><b>${Math.round(mac.kcal).toLocaleString('pt-BR')} kcal</b><small>meta ${suggested.toLocaleString('pt-BR')} kcal</small></div></div><div class="nf-builder-items">${m.items.length?m.items.map((it,idx)=>{const f=foodCatalog[it.key],n=foodNutrientsForAmount(f,it.amount);const moveOptions=BUILDER_MEALS.map(x=>`<option value="${x.id}" ${x.id===m.id?'selected':''}>${x.name}</option>`).join('');return `<div class="nf-builder-item"><div><b>${escapeHtml(f.name)}</b><small>${n.kcal} kcal · ${n.protein} P · ${n.carbs} C · ${n.fat} G</small></div><label><input class="builder-amount" data-item-index="${idx}" data-food-key="${it.key}" type="number" min="0" step="${f.unit==='un'?'1':'5'}" value="${it.amount}">${f.unit==='un'?'un':'g'}</label><label class="builder-move"><span>Refeição</span><select class="builder-move-meal" data-item-index="${idx}">${moveOptions}</select></label><button type="button" class="builder-remove-item" data-item-index="${idx}" aria-label="Remover alimento">×</button></div>`}).join(''):'<div class="nf-meal-empty">Adicione alimentos da lista e escolha a refeição.</div>'}</div></article>`}).join('');
  const consumed=draft.meals.reduce((a,m)=>a+mealKcal(m),0);const remaining=Math.round(meta.calories-consumed);const budget=byId('plano')?.querySelector('.nf-calorie-budget');
  if(budget){budget.classList.toggle('over',remaining<0);const bar=budget.querySelector('.nf-budget-bar i');if(bar)bar.style.width=`${meta.calories ? Math.min(100,Math.max(0,consumed/meta.calories*100)) : 0}%`;const foot=budget.querySelector('.nf-budget-foot strong');if(foot)foot.textContent=remaining>=0?`${remaining.toLocaleString('pt-BR')} kcal restantes`:`${Math.abs(remaining).toLocaleString('pt-BR')} kcal acima da meta`;const c=budget.querySelector('.nf-budget-foot b');if(c)c.textContent=`${Math.max(0,Math.round(consumed)).toLocaleString('pt-BR')} kcal`}
}
function bindBuilderEvents(p){
  byId('builderFoodSearch')?.addEventListener('input',()=>renderBuilderFoodList(p));
  byId('builderFoodList')?.addEventListener('click',e=>{const b=e.target.closest('.nf-add-food');if(!b)return;const key=b.dataset.foodKey;const f=foodCatalog[key];const picker=byId('builderFoodList')?.querySelector(`.builder-food-meal[data-food-key="${key}"]`);const mealId=picker?.value||'breakfast';const draft=getBuilderDraft(p.id);const meal=draft.meals.find(m=>m.id===mealId)||draft.meals[0];const existing=meal.items.find(it=>it.key===key);if(existing){existing.amount=(Number(existing.amount)||0)+builderDefaultAmount(f)}else meal.items.push({key,amount:builderDefaultAmount(f)});saveBuilderDraft(p.id,draft);renderBuilderMeals(p);showToast(`${f.name} adicionado ao ${meal.name.toLowerCase()}.`)});
  byId('builderMenuList')?.addEventListener('input',e=>{if(!e.target.matches('.builder-amount'))return;const card=e.target.closest('[data-meal-id]');const draft=getBuilderDraft(p.id);const meal=draft.meals.find(m=>m.id===card.dataset.mealId);const item=meal?.items[Number(e.target.dataset.itemIndex)];if(!item)return;item.amount=Math.max(0,Number(e.target.value)||0);saveBuilderDraft(p.id,draft);renderBuilderMeals(p)});
  byId('builderMenuList')?.addEventListener('change',e=>{const select=e.target.closest('.builder-move-meal');if(!select)return;const card=select.closest('[data-meal-id]');const fromId=card?.dataset.mealId,toId=select.value,index=Number(select.dataset.itemIndex);if(!fromId||!toId||fromId===toId)return;const draft=getBuilderDraft(p.id);const from=draft.meals.find(m=>m.id===fromId),to=draft.meals.find(m=>m.id===toId);const item=from?.items[index];if(!from||!to||!item)return;from.items.splice(index,1);const existing=to.items.find(it=>it.key===item.key);if(existing)existing.amount=(Number(existing.amount)||0)+(Number(item.amount)||0);else to.items.push(item);saveBuilderDraft(p.id,draft);renderBuilderMeals(p);const dest=BUILDER_MEALS.find(m=>m.id===toId);showToast(`${foodCatalog[item.key].name} movido para ${dest?.name||'a refeição selecionada'}.`)});
  byId('builderMenuList')?.addEventListener('click',e=>{const b=e.target.closest('.builder-remove-item');if(!b)return;const card=b.closest('[data-meal-id]');const draft=getBuilderDraft(p.id);const meal=draft.meals.find(m=>m.id===card.dataset.mealId);if(meal)meal.items.splice(Number(b.dataset.itemIndex),1);saveBuilderDraft(p.id,draft);renderBuilderMeals(p)});
  byId('clearBuilderPlan')?.addEventListener('click',()=>{if(!confirm('Limpar o cardápio em montagem?'))return;const draft={meals:BUILDER_MEALS.map(m=>({...m,items:[]}))};saveBuilderDraft(p.id,draft);renderBuilderMeals(p)});
  byId('saveBuilderPlan')?.addEventListener('click',()=>saveBuilderPlan(p));
}
function saveBuilderPlan(p){
  const draft=getBuilderDraft(p.id),meta=getPlanMeta(p),meals=draft.meals.filter(m=>m.items.length).map(m=>{const n=mealMacros(m);return {time:m.time,name:m.name,kcal:Math.round(n.kcal),protein:+n.protein.toFixed(1),carbs:+n.carbs.toFixed(1),fat:+n.fat.toFixed(1),items:m.items.map(it=>{const f=foodCatalog[it.key];return `${f.name} — ${builderAmountLabel(f,it.amount)}`}),foods:m.items.map(it=>({key:it.key,name:foodCatalog[it.key].name,amount:it.amount,unit:foodCatalog[it.key].unit,kcal:foodNutrientsForAmount(foodCatalog[it.key],it.amount).kcal,protein:foodNutrientsForAmount(foodCatalog[it.key],it.amount).protein,carbs:foodNutrientsForAmount(foodCatalog[it.key],it.amount).carbs,fat:foodNutrientsForAmount(foodCatalog[it.key],it.amount).fat}))}});
  const total=meals.reduce((a,m)=>({kcal:a.kcal+m.kcal,protein:a.protein+m.protein,carbs:a.carbs+m.carbs,fat:a.fat+m.fat}),{kcal:0,protein:0,carbs:0,fat:0});
  if(!meals.length){showToast('Adicione pelo menos um alimento ao cardápio.');return}
  if(total.kcal>meta.calories+50){showToast(`O cardápio está ${Math.round(total.kcal-meta.calories)} kcal acima da meta.`);return}
  patientPlans[p.id]={...(patientPlans[p.id]||{}),type:patientPlans[p.id]?.type==='suggested'?'suggested':'manual',name:byId('builderPlanName')?.value.trim()||`Plano alimentar — ${p.name}`,calories:Math.round(meta.calories),protein:Math.round(total.protein),carbs:Math.round(total.carbs),fat:Math.round(total.fat),meals,foods:meals.flatMap(m=>m.foods),preferences:[...new Set(meals.flatMap(m=>m.foods.map(f=>f.key)))],updatedAt:new Date().toISOString()};
  persistPlans();
  renderPatientPlan();
  renderAlimentacao();
  showToast(`Plano de ${p.name} salvo com sucesso.`);
}


const patientModal=document.getElementById('patientModal');
const patientList=document.getElementById('patientList');
const selectedPatientBox=document.getElementById('selectedPatientBox');
const loadPatientBtn=document.getElementById('loadPatientBtn');

function openPatientModal(){
  if(!patientModal)return;
  pendingPatient=selectedPatient || null;
  renderPatients();
  patientModal.classList.add('open');
  patientModal.setAttribute('aria-hidden','false');
}
function closePatientModal(){
  if(!patientModal)return;
  patientModal.classList.remove('open');
  patientModal.setAttribute('aria-hidden','true');
}
function renderPatients(){
  if(!patientList)return;
  patientList.innerHTML=patients.map(p=>`<button type="button" class="patient-option ${pendingPatient?.id===p.id?'selected':''}" data-patient-id="${p.id}"><span class="avatar">${p.initials}</span><span><b>${p.name}</b><span>${p.email} · ${p.objective}</span></span><span class="check">${pendingPatient?.id===p.id?'✓':''}</span></button>`).join('');
  if(selectedPatientBox) selectedPatientBox.innerHTML=pendingPatient ? `<b>Paciente selecionado:</b> ${pendingPatient.name} · ${pendingPatient.objective}` : 'Nenhum paciente selecionado.';
  if(loadPatientBtn){loadPatientBtn.disabled=!pendingPatient;loadPatientBtn.textContent=pendingPatient?'Carregar informações do paciente':'Selecione um paciente';}
}
function selectPatient(id){
  pendingPatient=patients.find(p=>p.id===id) || null;
  renderPatients();
}
function loadCalculatorPatient(patient){
  if(!patient){
    const set=(id,value)=>{const el=document.getElementById(id);if(el)el.value=value??''};
    set('sex','m'); set('age',''); set('weight',''); set('height','');
    const summaryName=document.getElementById('calculatorPatientName');
    const summaryAvatar=document.querySelector('#calculatorPatientSummary .avatar');
    if(summaryName)summaryName.textContent='Nenhum paciente';
    if(summaryAvatar)summaryAvatar.textContent='—';
    const form=document.getElementById('calcForm');
    if(form)delete form.dataset.patientId;
    return;
  }
  const weight=Number(String(patient.weight||'0').replace(' kg','').replace(',','.'))||0;
  const set=(id,value)=>{const el=document.getElementById(id);if(el)el.value=value??''};
  set('sex',patient.sex||'m');
  set('age',patient.age||'');
  set('weight',weight);
  set('height',patient.height||'');
  set('objective',patient.objective||'Manutenção de peso');
  const summaryName=document.getElementById('calculatorPatientName');
  const summaryAvatar=document.querySelector('#calculatorPatientSummary .avatar');
  if(summaryName)summaryName.textContent=patient.name;
  if(summaryAvatar)summaryAvatar.textContent=patient.initials||patient.name.split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase();
  // Usa a meta calórica cadastrada como referência, mas mantém o cálculo metabólico independente.
  const form=document.getElementById('calcForm');
  if(form)form.dataset.patientId=patient.id;
  if(weight && patient.age && patient.height){
    const activity=document.getElementById('activity');
    const bmr=10*weight+6.25*Number(patient.height)-5*Number(patient.age)+(patient.sex==='m'?5:-161);
    const tdee=bmr*Number(activity?.value||1.55);
    const fmt=n=>Math.round(n).toLocaleString('pt-BR')+' kcal';
    const b=document.getElementById('bmr'),t=document.getElementById('tdee'),m=document.getElementById('maintenance'),d=document.getElementById('deficit');
    if(b)b.textContent=fmt(bmr); if(t)t.textContent=fmt(tdee); if(m)m.textContent=fmt(tdee); if(d)d.textContent=fmt(Math.max(0,tdee-500));
  }
}
window.loadSelectedPatientCalculator=()=>loadCalculatorPatient(selectedPatient);

function renderDashboard(){
  const p=(typeof selectedPatient!=='undefined')?selectedPatient:null;
  const ids={
    calories:byId('dashboardCalories'), caloriesBar:byId('dashboardCaloriesBar'), caloriesNote:byId('dashboardCaloriesNote'),
    protein:byId('dashboardProtein'), proteinBar:byId('dashboardProteinBar'), proteinNote:byId('dashboardProteinNote'),
    carbs:byId('dashboardCarbs'), carbsBar:byId('dashboardCarbsBar'), carbsNote:byId('dashboardCarbsNote'),
    fat:byId('dashboardFat'), fatBar:byId('dashboardFatBar'), fatNote:byId('dashboardFatNote'),
    progress:byId('dashboardProgress'), weight:byId('dashboardWeight'), weightNote:byId('dashboardWeightNote'), goalBar:byId('dashboardGoalBar')
  };
  const mealsCard=document.querySelector('#dashboard .meals-card');
  const mealsSubtitle=byId('dashboardMealsSubtitle');
  const plan=p?getPlan():null;
  const meta=p?getPlanMeta(p):{calories:0,protein:0,carbs:0,fat:0};
  const meals=plan?getDisplayPlanMeals(plan,p):[];
  const totals=meals.reduce((a,m)=>{const n=mealMacros(m);return {kcal:a.kcal+n.kcal,protein:a.protein+n.protein,carbs:a.carbs+n.carbs,fat:a.fat+n.fat}},{kcal:0,protein:0,carbs:0,fat:0});
  if(!p){
    [['calories','0 <small>/ — kcal</small>'],['protein','0 <small>/ — g</small>'],['carbs','0 <small>/ — g</small>'],['fat','0 <small>/ — g</small>']].forEach(([k,v])=>{if(ids[k])ids[k].innerHTML=v});
    ['calories','protein','carbs','fat'].forEach(k=>{if(ids[k+'Bar'])ids[k+'Bar'].style.width='0%';if(ids[k+'Note'])ids[k+'Note'].textContent='Selecione um paciente'});
    if(ids.progress)ids.progress.textContent='0%';
    if(ids.weight)ids.weight.innerHTML='—'; if(ids.weightNote)ids.weightNote.textContent='Selecione um paciente.'; if(ids.goalBar)ids.goalBar.style.width='0%';
    if(mealsSubtitle)mealsSubtitle.textContent='Selecione um paciente para carregar o plano.';
    if(mealsCard){const list=mealsCard.querySelectorAll('.meal-row');list.forEach(r=>r.remove());const anchor=mealsCard.querySelector('.card-head');anchor?.insertAdjacentHTML('afterend','<div class="meal-row"><div class="meal-icon"><img src="assets/icons/clipboard.svg"></div><div><b>Nenhum paciente selecionado</b><span>Use o seletor no topo para carregar as informações.</span></div><span class="pending">Pendente</span></div>')}
    updateWater();
    return;
  }
  const target=Math.max(0,Number(meta.calories||p.calories||0));
  const calPct=target?Math.min(100,(totals.kcal/target)*100):0;
  const macro=(actual,targetVal)=>targetVal?Math.min(100,(actual/targetVal)*100):0;
  if(ids.calories)ids.calories.innerHTML=`${Math.round(totals.kcal).toLocaleString('pt-BR')} <small>/ ${Math.round(target).toLocaleString('pt-BR')} kcal</small>`;
  if(ids.caloriesBar)ids.caloriesBar.style.width=calPct+'%';
  if(ids.caloriesNote)ids.caloriesNote.textContent=target&&totals.kcal<target?`${Math.round(target-totals.kcal).toLocaleString('pt-BR')} kcal restantes no plano`:`${Math.round(Math.max(0,totals.kcal-target)).toLocaleString('pt-BR')} kcal acima da meta`;
  const macroData=[['protein',totals.protein,meta.protein],['carbs',totals.carbs,meta.carbs],['fat',totals.fat,meta.fat]];
  macroData.forEach(([k,actual,goal])=>{
    if(ids[k])ids[k].innerHTML=`${Math.round(actual)} <small>/ ${Math.round(goal||0)} g</small>`;
    if(ids[k+'Bar'])ids[k+'Bar'].style.width=macro(actual,goal)+'%';
    if(ids[k+'Note'])ids[k+'Note'].textContent=goal?`${Math.max(0,Math.round(goal-actual))} g restantes no plano`:'Meta não definida';
  });
  const overallPct=target?Math.min(100,(totals.kcal/target)*100):0;
  if(ids.progress)ids.progress.textContent=`${Math.round(overallPct)}%`;
  const weight=String(p.weight||'').replace(' kg','');
  if(ids.weight)ids.weight.innerHTML=`${weight||'—'} <small>kg</small>`;
  if(ids.weightNote)ids.weightNote.textContent=`Objetivo: ${p.objective||'não informado'}`;
  if(ids.goalBar)ids.goalBar.style.width=plan?'100%':'0%';
  if(mealsSubtitle)mealsSubtitle.textContent=plan?`${plan.name||'Plano alimentar'} · ${Math.round(totals.kcal).toLocaleString('pt-BR')} kcal planejadas`:'Nenhum plano alimentar atribuído.';
  if(mealsCard){
    const old=mealsCard.querySelectorAll('.meal-row');old.forEach(r=>r.remove());
    const anchor=mealsCard.querySelector('.card-head');
    const visible=(meals||[]).filter(m=>(m.items||[]).length).slice(0,6);
    const rows=visible.length?visible.map(m=>`<div class="meal-row"><div class="meal-icon"><img src="assets/icons/${m.name.toLowerCase().includes('jantar')?'moon':m.name.toLowerCase().includes('almoço')?'restaurant':m.name.toLowerCase().includes('café')?'sun':'apple'}.svg"></div><div><b>${escapeHtml(m.name)}</b><span>${m.time} · ${Math.round(mealKcal(m)).toLocaleString('pt-BR')} kcal</span></div><button class="small-btn" type="button" data-page="alimentacao">Ver refeição</button></div>`).join(''):'<div class="meal-row"><div class="meal-icon"><img src="assets/icons/clipboard.svg"></div><div><b>Nenhum alimento no plano</b><span>Adicione ou gere um plano alimentar.</span></div><button class="small-btn" type="button" data-page="plano">Montar plano</button></div>';
    anchor?.insertAdjacentHTML('afterend',rows);
    mealsCard.querySelectorAll('[data-page]').forEach(btn=>btn.addEventListener('click',()=>showPage(btn.dataset.page)));
  }
  updateWater();
}

function applyPatientData(patient){
  if(!patient)return;
  selectedPatient=patient;
  localStorage.setItem('nutrifit-selected-patient',patient.id);
  const name=document.getElementById('selectedPatientName');
  const profile=document.getElementById('profilePatientName');
  const pageTitle=document.getElementById('pageTitle');
  if(name)name.textContent=patient.name;
  if(profile)profile.textContent=patient.name;
  if(pageTitle && (localStorage.getItem('nutrifit-page')||'dashboard')==='dashboard')pageTitle.textContent='Olá, Nutri';
  // Atualiza os principais indicadores com os dados do paciente carregado.
  const kcalStrong=document.querySelector('.metric-card strong');
  if(kcalStrong)kcalStrong.innerHTML=`1.850 <small>/ ${patient.calories.toLocaleString('pt-BR')} kcal</small>`;
  const proteinStrong=document.querySelectorAll('.metric-card strong')[1];
  if(proteinStrong)proteinStrong.innerHTML=`142 <small>/ ${patient.protein} g</small>`;
  const goal=document.querySelector('.goal-card strong');
  if(goal)goal.innerHTML=`${patient.weight.replace(' kg','')} <small>kg</small>`;
  loadCalculatorPatient(patient);
  renderDashboard();
  renderPatientsCrud(byId('patientSearch')?.value||'');
  closePatientModal();
  showToast(`Informações de ${patient.name} carregadas.`);
}
function showToast(message){
  let toast=document.getElementById('nutrifitToast');
  if(!toast){toast=document.createElement('div');toast.id='nutrifitToast';toast.className='toast';document.body.appendChild(toast)}
  toast.textContent=message;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),2600);
}

document.getElementById('patientSelector')?.addEventListener('click',openPatientModal);
document.getElementById('profilePatientBtn')?.addEventListener('click',openPatientModal);
document.getElementById('closePatientModal')?.addEventListener('click',closePatientModal);
patientModal?.addEventListener('click',e=>{if(e.target===patientModal)closePatientModal()});
patientList?.addEventListener('click',e=>{const btn=e.target.closest('[data-patient-id]');if(btn)selectPatient(btn.dataset.patientId)});
loadPatientBtn?.addEventListener('click',()=>{if(pendingPatient){applyPatientData(pendingPatient);renderPatientPlan()}});

// Nenhum paciente é carregado por padrão. A seleção deve ser feita explicitamente a cada sessão.
localStorage.removeItem('nutrifit-selected-patient');
selectedPatient=null;
pendingPatient=null;
const initialName=document.getElementById('selectedPatientName');
const initialProfile=document.getElementById('profilePatientName');
const initialSelectorAvatar=document.querySelector('#patientSelector .small-avatar');
if(initialName) initialName.textContent='Nenhum paciente';
if(initialProfile) initialProfile.textContent='Nenhum paciente';
if(initialSelectorAvatar) initialSelectorAvatar.textContent='—';
loadCalculatorPatient(null);



// ===============================
// EDIÇÃO DO PACIENTE / CONFIGURAÇÕES / SUGESTÃO DE PLANO
// ===============================
const editPatientModal=document.getElementById('editPatientModal');
const settingsModal=document.getElementById('settingsModal');
const suggestPlanModal=document.getElementById('suggestPlanModal');
const byId=id=>document.getElementById(id);
renderDashboard();
function openModal(m){if(!m)return;m.classList.add('open');m.setAttribute('aria-hidden','false')}
function closeModal(m){if(!m)return;m.classList.remove('open');m.setAttribute('aria-hidden','true')}
let editingPatientId=null;
function fillEditForm(p,mode='edit'){
  const isCreate=mode==='create'||!p; editingPatientId=isCreate?null:p.id;
  byId('editPatientTitle').textContent=isCreate?'Novo cliente':'Informações do paciente';
  byId('editPatientSubtitle').textContent=isCreate?'Cadastre um novo paciente para usar nas demais áreas do NutriFit.':`Atualize os dados de ${p.name}. As alterações ficam vinculadas a este cliente.`;
  byId('editName').value=p?.name||''; byId('editEmail').value=p?.email||''; byId('editAge').value=p?.age||''; byId('editSex').value=p?.sex||'m';
  byId('editWeight').value=isCreate?'':(parseFloat(String(p.weight||'').replace(',','.'))||''); byId('editHeight').value=p?.height||''; byId('editObjective').value=p?.objective||'Manutenção de peso';
  byId('editCalories').value=p?.calories||''; byId('editProtein').value=p?.protein||''; byId('editWaterGoal').value=p?.waterGoal||2500;
  byId('editRestrictions').value=p?.restrictions||''; byId('editPreferences').value=p?.preferences||'';
  const ea=byId('editPatientAvatar'); if(ea)ea.textContent=isCreate?'NF':(p.initials||'PT');
  const del=byId('deleteEditPatient'); if(del){del.hidden=isCreate;del.disabled=isCreate;}
  const save=byId('saveEditPatient'); if(save)save.textContent=isCreate?'Criar cliente':'Salvar alterações';
}
function persistPatients(){localStorage.setItem('nutrifit-patients',JSON.stringify(patients))}
function refreshCurrentPatientViews(){ renderPatients(); renderPatientsCrud(byId('patientSearch')?.value||''); renderPatientPlan(); renderAlimentacao(); if(typeof loadCalculatorPatient==='function') loadCalculatorPatient(selectedPatient||null); const current=localStorage.getItem('nutrifit-page'); if(current) showPage(current); window.scrollTo({top:0,behavior:'smooth'}); }
function loadPatients(){try{const saved=JSON.parse(localStorage.getItem('nutrifit-patients'));if(Array.isArray(saved)&&saved.length){patients.splice(0,patients.length,...saved)}}catch(e){}}
loadPatients();
renderPatientsCrud();
if(selectedPatient){const fresh=patients.find(p=>p.id===selectedPatient.id);if(fresh)selectedPatient=fresh}
renderPatientPlan();
function refreshSelectedPatient(){if(selectedPatient)applyPatientData(selectedPatient)}
function renderPatientsCrud(filter=''){
  const box=byId('patientsCrudList'), stats=byId('patientStats'); if(!box)return;
  const term=String(filter||'').trim().toLowerCase();
  const list=patients.filter(p=>!term||`${p.name||''} ${p.email||''} ${p.objective||''}`.toLowerCase().includes(term));
  if(stats)stats.innerHTML=`<span><b>${patients.length}</b> pacientes</span><span><b>${selectedPatient?'1':'0'}</b> ativo</span>`;
  if(!list.length){box.innerHTML='<div class="card clients-empty"><div class="clients-empty-icon">+</div><div><h3>Nenhum cliente encontrado</h3><p>Cadastre um novo cliente ou altere a busca.</p></div></div>';return;}
  box.innerHTML=list.map(p=>`<article class="client-card card ${selectedPatient?.id===p.id?'is-active':''}"><button class="client-main" type="button" data-client-select="${p.id}"><span class="client-avatar">${p.initials||'PT'}</span><span class="client-main-text"><b>${p.name}</b><small>${p.email||'E-mail não informado'}</small><em>${p.objective||'Objetivo não informado'}</em></span><span class="client-check">${selectedPatient?.id===p.id?'Selecionado':'Selecionar'}</span></button><div class="client-meta"><span><small>Peso</small><b>${p.weight||'—'}</b></span><span><small>Meta</small><b>${Number(p.calories||0).toLocaleString('pt-BR')} kcal</b></span><span><small>Proteína</small><b>${Number(p.protein||0)} g</b></span></div><div class="client-actions"><button class="outline-btn" type="button" data-client-edit="${p.id}">Editar</button><button class="danger-btn" type="button" data-client-delete="${p.id}">Excluir</button></div></article>`).join('');
}
function openEditPatient(p,mode='edit'){fillEditForm(p,mode);openModal(editPatientModal);}
function deletePatientById(id){
  const p=patients.find(x=>x.id===id); if(!p)return false;
  if(!confirm(`Excluir o cliente ${p.name}? Esta ação também removerá o plano alimentar e os dados da calculadora salvos para ele.`))return false;
  const idx=patients.findIndex(x=>x.id===id); if(idx>=0)patients.splice(idx,1);
  try{const plans=JSON.parse(localStorage.getItem('nutrifit-patient-plans')||'{}')||{};delete plans[id];localStorage.setItem('nutrifit-patient-plans',JSON.stringify(plans));const metas=JSON.parse(localStorage.getItem('nutrifit-calculator-meta')||'{}')||{};delete metas[id];localStorage.setItem('nutrifit-calculator-meta',JSON.stringify(metas));const drafts=JSON.parse(localStorage.getItem('nutrifit-plan-builder-drafts')||'{}')||{};delete drafts[id];localStorage.setItem('nutrifit-plan-builder-drafts',JSON.stringify(drafts));}catch(e){}
  if(selectedPatient?.id===id){selectedPatient=null;pendingPatient=null;localStorage.removeItem('nutrifit-selected-patient');loadCalculatorPatient(null);renderPatientPlan();renderAlimentacao();}
  persistPatients();renderPatients();renderPatientsCrud(byId('patientSearch')?.value||'');renderPatientPlan();renderAlimentacao();closeModal(editPatientModal);showToast(`${p.name} foi excluído.`);window.scrollTo({top:0,behavior:'smooth'});return true;
}
byId('editPatientBtn')?.addEventListener('click',()=>{if(pendingPatient)openEditPatient(pendingPatient,'edit')});
byId('addPatientBtn')?.addEventListener('click',()=>openEditPatient(null,'create'));
byId('patientSearch')?.addEventListener('input',e=>renderPatientsCrud(e.target.value));
byId('patientsCrudList')?.addEventListener('click',e=>{
  const sel=e.target.closest('[data-client-select]'); if(sel){const p=patients.find(x=>x.id===sel.dataset.clientSelect);if(p){pendingPatient=p;applyPatientData(p);renderPatients();renderPatientsCrud(byId('patientSearch')?.value||'');}}
  const edit=e.target.closest('[data-client-edit]'); if(edit){const p=patients.find(x=>x.id===edit.dataset.clientEdit);if(p)openEditPatient(p,'edit');}
  const del=e.target.closest('[data-client-delete]'); if(del)deletePatientById(del.dataset.clientDelete);
});
byId('deleteEditPatient')?.addEventListener('click',()=>{if(editingPatientId)deletePatientById(editingPatientId)});
byId('closeEditPatientModal')?.addEventListener('click',()=>closeModal(editPatientModal));
byId('cancelEditPatient')?.addEventListener('click',()=>closeModal(editPatientModal));
byId('editPatientForm')?.addEventListener('submit',e=>{
 e.preventDefault(); const name=byId('editName').value.trim(); if(!name){showToast('Informe o nome do cliente.');return;}
 const age=Number(byId('editAge').value||0),weight=Number(byId('editWeight').value||0),height=Number(byId('editHeight').value||0); if(!age||age<10||!weight||weight<=0||!height||height<=0){showToast('Preencha idade, peso e altura corretamente.');return;}
 const email=byId('editEmail').value.trim(); let p=editingPatientId?patients.find(x=>x.id===editingPatientId):null; const isCreate=!p;
 if(isCreate){p={id:`patient_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,name,initials:name.split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase(),email,age,sex:byId('editSex').value,height,objective:byId('editObjective').value,calories:Number(byId('editCalories').value||0),protein:Number(byId('editProtein').value||0),waterGoal:Number(byId('editWaterGoal').value||2500),weight:weight.toFixed(1).replace('.',',')+' kg',restrictions:byId('editRestrictions').value.trim(),preferences:byId('editPreferences').value.trim()};patients.push(p);}
 else{p.name=name;p.email=email;p.age=age;p.sex=byId('editSex').value;p.height=height;p.objective=byId('editObjective').value;p.calories=Number(byId('editCalories').value||0);p.protein=Number(byId('editProtein').value||0);p.waterGoal=Number(byId('editWaterGoal').value||2500);p.weight=weight.toFixed(1).replace('.',',')+' kg';p.restrictions=byId('editRestrictions').value.trim();p.preferences=byId('editPreferences').value.trim();p.initials=name.split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase();}
 pendingPatient=p;persistPatients();if(selectedPatient?.id===p.id){selectedPatient=p;applyPatientData(p);renderPatientPlan();renderAlimentacao();}
 renderPatients();renderPatientsCrud(byId('patientSearch')?.value||'');closeModal(editPatientModal);showToast(isCreate?`${p.name} foi cadastrado.`:`Dados de ${p.name} salvos.`);
});
byId('settingsBtn')?.addEventListener('click',()=>{byId('settingDark').checked=document.body.classList.contains('dark');byId('settingsPatientName').textContent=selectedPatient?.name||'Nenhum';openModal(settingsModal)});
byId('closeSettingsModal')?.addEventListener('click',()=>closeModal(settingsModal));
byId('saveSettingsBtn')?.addEventListener('click',()=>{applyTheme(byId('settingDark').checked?'dark':'light');localStorage.setItem('nutrifit-autosave',byId('settingAutoSave').checked?'1':'0');localStorage.setItem('nutrifit-suggestions',byId('settingSuggestions').checked?'1':'0');closeModal(settingsModal);showToast('Configurações salvas.')});
byId('settingsEditPatient')?.addEventListener('click',()=>{closeModal(settingsModal);pendingPatient=selectedPatient;if(pendingPatient){openEditPatient(pendingPatient,'edit')}});

const mealPlanModal=byId('mealPlanModal');
const mealSlots=[['07:00','Café da manhã'],['10:00','Lanche da manhã'],['12:30','Almoço'],['16:30','Lanche da tarde'],['20:00','Jantar']];
function getPlanMeta(p){
  const stored=JSON.parse(localStorage.getItem('nutrifit-calculator-meta')||'{}');
  const saved=p?stored[p.id]:null;
  if(saved?.calories && saved?.protein && saved?.carbs && saved?.fat) return saved;
  const meta=getMetabolicData(p||{});
  return {calories:meta.target||Number(p?.calories)||2000,protein:meta.protein||Number(p?.protein)||Math.round((Number(p?.weight)||70)*1.6),carbs:meta.carbs||Math.round(((meta.target||Number(p?.calories)||2000)-(meta.protein||Number(p?.protein)||112)*4)*.6/4),fat:meta.fat||Math.round(((meta.target||Number(p?.calories)||2000)-(meta.protein||Number(p?.protein)||112)*4)*.4/9)};
}
function renderPlanTargets(p){
  const t=getPlanMeta(p), box=byId('planTargetPanel'); if(!box)return;
  box.innerHTML=`<div class="plan-target-title"><div><span class="eyebrow">METAS DA CALCULADORA</span><h3>Meta diária do paciente</h3></div><span class="target-source">${localStorage.getItem('nutrifit-calculator-meta')&&p&&JSON.parse(localStorage.getItem('nutrifit-calculator-meta')||'{}')[p.id]?'Calculada':'Estimativa atual'}</span></div><div class="plan-target-grid"><div><b>${Math.round(t.calories).toLocaleString('pt-BR')}</b><span>kcal</span></div><div><b>${Math.round(t.protein)}</b><span>g proteína</span></div><div><b>${Math.round(t.carbs)}</b><span>g carboidratos</span></div><div><b>${Math.round(t.fat)}</b><span>g gorduras</span></div></div>`;
}
function foodChoiceLabel(k){const f=foodCatalog[k];return `<label class="food-choice"><input type="checkbox" value="${k}" class="plan-food-check"><span><b>${f.name}</b><small>${f.kcal} kcal / ${f.ref}${f.unit==='un'?' un':' g'}</small></span><i>✓</i></label>`}
function renderFoodChoices(selected=[]){
 const box=byId('foodChoiceGrid'); if(!box)return; const groups=[['Arroz, cereais e massas',['arroz','arroz_integral','macarrao','cuscuz','tapioca','aveia','granola']],['Feijões e tubérculos',['feijao','lentilha','grao_bico','batata','batata_inglesa','mandioca']],['Pães e frutas',['pao','pao_integral','banana','maca','laranja','mamao','morango']],['Proteínas',['frango','carne','carne_moida','peixe','tilapia','atum','sardinha','ovos']],['Lácteos',['iogurte','leite','leite_integral','queijo','cottage','ricota']],['Gorduras, sementes e vegetais',['azeite','castanhas','amendoim','pasta_amendoim','chia','abacate','salada','brocolis','cenoura','abobora','tomate']]];
 box.innerHTML=groups.map(([g,ks])=>`<div class="food-choice-group"><h4>${g}</h4>${ks.map(k=>foodChoiceLabel(k)).join('')}</div>`).join(''); box.querySelectorAll('.plan-food-check').forEach(c=>c.checked=selected.includes(c.value));
}
function optimizeFoods(keys,target){
 const goals=[Number(target.calories)||0,Number(target.protein)||0,Number(target.carbs)||0,Number(target.fat)||0];
 let amounts={}; keys.forEach(k=>{const f=foodCatalog[k]; amounts[k]=f.unit==='un'?1:Math.max(f.ref*.5, f.ref)});
 const weight=[1,3,2.5,2.5];
 const sum=()=>keys.reduce((a,k)=>{const f=foodCalc(k,amounts[k]);return {kcal:a.kcal+f.kcal,protein:a.protein+f.protein,carbs:a.carbs+f.carbs,fat:a.fat+f.fat}},{kcal:0,protein:0,carbs:0,fat:0});
 for(let iter=0;iter<900;iter++){
   const cur=sum(), vals=[cur.kcal,cur.protein,cur.carbs,cur.fat];
   keys.forEach(k=>{const f=foodCatalog[k];const c=foodCalc(k,amounts[k]);let pressure=0;
     pressure+=weight[0]*(goals[0]-vals[0])/Math.max(goals[0],1)*(c.kcal/Math.max(vals[0],1));
     pressure+=weight[1]*(goals[1]-vals[1])/Math.max(goals[1],1)*(c.protein/Math.max(vals[1],1));
     pressure+=weight[2]*(goals[2]-vals[2])/Math.max(goals[2],1)*(c.carbs/Math.max(vals[2],1));
     pressure+=weight[3]*(goals[3]-vals[3])/Math.max(goals[3],1)*(c.fat/Math.max(vals[3],1));
     const factor=Math.max(.985,Math.min(1.015,1+pressure*.10)); amounts[k]*=factor;
   });
 }
 keys.forEach(k=>{const f=foodCatalog[k];amounts[k]=f.unit==='un'?Math.max(1,Math.round(amounts[k])):Math.max(5,Math.round(amounts[k]/5)*5)});
 let foods=keys.map(k=>foodCalc(k,amounts[k])).filter(Boolean);
 for(let pass=0;pass<120;pass++){
   const total=foods.reduce((a,f)=>({kcal:a.kcal+f.kcal,protein:a.protein+f.protein,carbs:a.carbs+f.carbs,fat:a.fat+f.fat}),{kcal:0,protein:0,carbs:0,fat:0});
   const errors=[(goals[0]-total.kcal)/Math.max(goals[0],1),(goals[1]-total.protein)/Math.max(goals[1],1),(goals[2]-total.carbs)/Math.max(goals[2],1),(goals[3]-total.fat)/Math.max(goals[3],1)];
   const score=Math.abs(errors[0])+Math.abs(errors[1])+Math.abs(errors[2])+Math.abs(errors[3]); if(score<.025)break;
   let best=null;
   keys.forEach(k=>{const f=foodCatalog[k], old=amounts[k], step=f.unit==='un'?1:5; [old-step,old+step].filter(x=>x>0).forEach(x=>{const test=keys.map(j=>foodCalc(j,j===k?x:amounts[j]));const t=test.reduce((a,z)=>({kcal:a.kcal+z.kcal,protein:a.protein+z.protein,carbs:a.carbs+z.carbs,fat:a.fat+z.fat}),{kcal:0,protein:0,carbs:0,fat:0});const sc=Math.abs((goals[0]-t.kcal)/Math.max(goals[0],1))+Math.abs((goals[1]-t.protein)/Math.max(goals[1],1))+Math.abs((goals[2]-t.carbs)/Math.max(goals[2],1))+Math.abs((goals[3]-t.fat)/Math.max(goals[3],1));if(!best||sc<best.sc)best={k,x,sc}})}); if(!best)break; amounts[best.k]=best.x; foods=keys.map(k=>foodCalc(k,amounts[k])).filter(Boolean);
 }
 const total=foods.reduce((a,f)=>({kcal:a.kcal+f.kcal,protein:a.protein+f.protein,carbs:a.carbs+f.carbs,fat:a.fat+f.fat}),{kcal:0,protein:0,carbs:0,fat:0});
 return {foods,total};
}
function distributeCalculatedPlan(foods,target){
  /* Distribuição determinística: cada alimento escolhido entra em apenas uma refeição.
     Proteínas não são duplicadas entre almoço/jantar; ovos têm prioridade no café. */
  const defs=[['07:00','Café da manhã'],['10:00','Lanche da manhã'],['12:30','Almoço'],['16:30','Lanche da tarde'],['20:00','Jantar']];
  const groups=defs.map(([time,name])=>({time,name,foods:[]}));
  const used=new Set();
  const keyOf=f=>Object.keys(foodCatalog).find(k=>foodCatalog[k].name===f.name);
  const category=k=>{
    if(['frango','carne','carne_moida','peixe','tilapia','atum','sardinha','ovos'].includes(k))return 'protein';
    if(['iogurte','leite','leite_integral','queijo','cottage','ricota'].includes(k))return 'dairy';
    if(['banana','maca','laranja','mamao','morango','abacate'].includes(k))return 'fruit';
    if(['arroz','arroz_integral','macarrao','cuscuz','tapioca','batata','batata_inglesa','mandioca','pao','pao_integral','aveia','granola'].includes(k))return 'carb';
    if(['feijao','lentilha','grao_bico'].includes(k))return 'legume';
    if(['azeite','castanhas','amendoim','pasta_amendoim','chia'].includes(k))return 'fat';
    if(['salada','brocolis','cenoura','abobora','tomate'].includes(k))return 'vegetable';
    return 'other';
  };
  const add=(f,i)=>{if(!f||used.has(f.name))return false;groups[i].foods.push(f);used.add(f.name);return true};
  const byCat=c=>foods.filter(f=>category(keyOf(f))===c&&!used.has(f.name));

  // Café da manhã: ovos/dairy + cereal/pão + fruta.
  const eggs=byCat('protein').find(f=>keyOf(f)==='ovos');
  if(eggs)add(eggs,0);
  const breakfastDairy=byCat('dairy')[0]; if(breakfastDairy)add(breakfastDairy,0);
  const breakfastCarb=byCat('carb').find(f=>['aveia','pao','pao_integral','cuscuz','tapioca'].includes(keyOf(f)))||byCat('carb')[0];
  if(breakfastCarb)add(breakfastCarb,0);
  const breakfastFruit=byCat('fruit')[0]; if(breakfastFruit)add(breakfastFruit,0);

  // Lanches: fruta + dairy ou oleaginosas, sem criar uma nova proteína principal.
  const snack1Fruit=byCat('fruit')[0]; if(snack1Fruit)add(snack1Fruit,1);
  const snack1Dairy=byCat('dairy')[0]; if(snack1Dairy)add(snack1Dairy,1);
  const snack2Fruit=byCat('fruit')[0]; if(snack2Fruit)add(snack2Fruit,3);
  const snackFat=byCat('fat')[0]; if(snackFat)add(snackFat,3);

  // Proteínas principais: uma escolha diferente no almoço e outra no jantar.
  const proteins=byCat('protein');
  const mainProteins=proteins.filter(f=>f!==eggs);
  if(mainProteins[0])add(mainProteins[0],2);
  if(mainProteins[1])add(mainProteins[1],4);

  // Carboidratos, leguminosas, vegetais e gordura acompanham as refeições principais.
  const lunchCarb=byCat('carb')[0]; if(lunchCarb)add(lunchCarb,2);
  const dinnerCarb=byCat('carb')[0]; if(dinnerCarb)add(dinnerCarb,4);
  const legume=byCat('legume')[0]; if(legume)add(legume,2);
  const legume2=byCat('legume')[0]; if(legume2)add(legume2,4);
  const veg1=byCat('vegetable')[0]; if(veg1)add(veg1,2);
  const veg2=byCat('vegetable')[0]; if(veg2)add(veg2,4);
  const fat1=byCat('fat')[0]; if(fat1)add(fat1,2);
  const fat2=byCat('fat')[0]; if(fat2)add(fat2,4);

  // Qualquer alimento adicional escolhido é distribuído por compatibilidade, uma única vez.
  foods.forEach(f=>{
    if(used.has(f.name))return;
    const c=category(keyOf(f));
    const preferred=c==='fruit'||c==='dairy'||c==='fat'?[1,3,0,2,4]:c==='protein'?[2,4,0,3,1]:[2,4,0,1,3];
    const slot=preferred.find(i=>groups[i].foods.length<4) ?? 2;
    add(f,slot);
  });

  const sum=fs=>fs.reduce((a,f)=>({kcal:a.kcal+f.kcal,protein:a.protein+f.protein,carbs:a.carbs+f.carbs,fat:a.fat+f.fat}),{kcal:0,protein:0,carbs:0,fat:0});
  return groups.filter(m=>m.foods.length).map(m=>{
    const total=sum(m.foods);
    return {time:m.time,name:m.name,kcal:total.kcal,protein:+total.protein.toFixed(1),carbs:+total.carbs.toFixed(1),fat:+total.fat.toFixed(1),foods:m.foods,items:m.foods.map(f=>`${f.name} — ${f.amount}${f.unit==='un'?' un':' g'}`)};
  });
}

let calculatedPlan=null;
function planToBuilderDraft(plan){
  const byName={};
  Object.keys(foodCatalog).forEach(k=>{byName[foodCatalog[k].name.toLowerCase()]=k});
  const meals=BUILDER_MEALS.map(m=>({...m,items:[]}));
  (plan?.meals||[]).forEach((m,mi)=>{
    const target=meals.find(x=>x.name===m.name)||meals[mi]||meals[0];
    (m.foods||[]).forEach(f=>{
      const key=f.key||foodKey(f)||byName[String(f.name||'').toLowerCase()];
      if(!key||!foodCatalog[key])return;
      const amount=Number(f.amount)||builderDefaultAmount(foodCatalog[key]);
      const existing=target.items.find(it=>it.key===key);
      if(existing)existing.amount+=amount; else target.items.push({key,amount});
    });
    // Compatibilidade com planos antigos que só tinham strings em items.
    if(!(m.foods||[]).length){(m.items||[]).forEach(text=>{
      const match=String(text).match(/^(.+?)\s+—\s+(\d+(?:[.,]\d+)?)\s*(g|un)?/i);
      if(!match)return; const key=byName[match[1].trim().toLowerCase()]; if(!key)return;
      const amount=Number(String(match[2]).replace(',','.')); const existing=target.items.find(it=>it.key===key);
      if(existing)existing.amount+=amount; else target.items.push({key,amount});
    })}
  });
  return {meals};
}
function openMealPlanModal(edit=false){
 const p=selectedPatient;if(!p){showToast('Selecione um paciente primeiro.');return;} const plan=getPlan();
 byId('planPatientName').textContent=p.name;byId('planPatientAvatar').textContent=p.initials;byId('planHeaderAvatar')&&(byId('planHeaderAvatar').textContent=p.initials);byId('mealPlanName').value=plan?.name||`Plano alimentar — ${p.name}`;renderPlanTargets(p);
 if(edit && plan){ saveBuilderDraft(p.id,planToBuilderDraft(plan)); }
 const oldKeys=plan?.preferences||plan?.foods?.map(f=>foodKey(f))||[];renderFoodChoices(oldKeys);calculatedPlan=null;byId('calculatedPlanPanel').hidden=true;byId('saveCalculatedPlanBtn').disabled=true;byId('planCalcStatus').textContent=edit?'Plano carregado para edição. Use a aba Plano alimentar para ajustar alimentos e quantidades.':'Escolha os alimentos para começar.';mealPlanModal?.classList.add('open');mealPlanModal?.setAttribute('aria-hidden','false');
}
const openAddPlan=()=>openMealPlanModal(false);
byId('addMealPlanBtn')?.addEventListener('click',openAddPlan);byId('foodAddPlanBtn')?.addEventListener('click',openAddPlan);document.addEventListener('click',e=>{if(e.target.closest('#bannerAddPlan,#foodEmptyAddPlan'))openAddPlan()});byId('closeMealPlanModal')?.addEventListener('click',()=>closeModal(mealPlanModal));byId('cancelMealPlan')?.addEventListener('click',()=>closeModal(mealPlanModal));mealPlanModal?.addEventListener('click',e=>{if(e.target===mealPlanModal)closeModal(mealPlanModal)});
byId('calculateMealPlanBtn')?.addEventListener('click',()=>{const p=selectedPatient;if(!p)return;const keys=[...document.querySelectorAll('.plan-food-check:checked')].map(x=>x.value);if(keys.length<2){showToast('Escolha pelo menos 2 alimentos para calcular.');return}const meta=getPlanMeta(p);const optimized=optimizeFoods(keys,meta);const meals=distributeCalculatedPlan(optimized.foods,meta);const total=meals.reduce((a,m)=>({kcal:a.kcal+m.kcal,protein:a.protein+m.protein,carbs:a.carbs+m.carbs,fat:a.fat+m.fat}),{kcal:0,protein:0,carbs:0,fat:0});calculatedPlan={meta,keys,meals,total,foods:optimized.foods};const diff={kcal:total.kcal-meta.calories,protein:total.protein-meta.protein,carbs:total.carbs-meta.carbs,fat:total.fat-meta.fat};byId('calculatedPlanPanel').hidden=false;byId('calculatedPlanPanel').innerHTML=`<div class="calculated-head"><div><span class="eyebrow">RESULTADO</span><h3>Quantidades calculadas</h3><p class="muted">As quantidades foram ajustadas para aproximar simultaneamente as quatro metas.</p></div><div class="calculated-total"><b>${Math.round(total.kcal).toLocaleString('pt-BR')} kcal</b><small>${Math.round(total.protein)} g P · ${Math.round(total.carbs)} g C · ${Math.round(total.fat)} g G</small></div></div><div class="calculated-foods">${optimized.foods.map(f=>`<div><b>${f.name}</b><strong>${f.amount}${f.unit==='un'?' un':' g'}</strong><span>${f.kcal} kcal · ${f.protein} P · ${f.carbs} C · ${f.fat} G</span></div>`).join('')}</div><div class="calculated-meals">${meals.map(m=>`<article><b>${m.time} · ${m.name}</b><strong>${m.kcal} kcal</strong><small>${m.items.join(' · ')}</small></article>`).join('')}</div><div class="target-difference">Diferença da meta: ${diff.kcal>=0?'+':''}${Math.round(diff.kcal)} kcal · ${diff.protein>=0?'+':''}${Math.round(diff.protein)} g P · ${diff.carbs>=0?'+':''}${Math.round(diff.carbs)} g C · ${diff.fat>=0?'+':''}${Math.round(diff.fat)} g G</div>`;byId('saveCalculatedPlanBtn').disabled=false;byId('planCalcStatus').textContent='Cálculo concluído. Revise e salve o plano.';showToast('Quantidades calculadas com base nas metas da calculadora.')});
byId('mealPlanForm')?.addEventListener('submit',e=>{e.preventDefault();const p=selectedPatient;if(!p||!calculatedPlan){showToast('Calcule as quantidades antes de salvar.');return}patientPlans[p.id]={name:byId('mealPlanName').value.trim()||`Plano alimentar — ${p.name}`,calories:Math.round(calculatedPlan.meta.calories),protein:Math.round(calculatedPlan.meta.protein),carbs:Math.round(calculatedPlan.meta.carbs),fat:Math.round(calculatedPlan.meta.fat),meals:calculatedPlan.meals,foods:calculatedPlan.foods,preferences:calculatedPlan.keys,updatedAt:new Date().toISOString()};persistPlans();renderPatientPlan();renderAlimentacao();closeModal(mealPlanModal);showToast(`Plano de ${p.name} salvo com sucesso.`)});

function getMetabolicData(p){
  const weight=Number(String(p.weight||'0').replace(' kg','').replace(',','.'))||0;
  const age=Number(p.age)||0;
  const height=Number(p.height)||0;
  const activity=Number(byId('activity')?.value||1.55);
  if(!weight||!age||!height)return {bmr:0,tdee:0,target:Math.round(Number(p.calories)||0),protein:Math.round(Number(p.protein)||0)};
  const bmr=10*weight+6.25*height-5*age+(p.sex==='m'?5:-161);
  const tdee=bmr*activity;
  const obj=String(p.objective||'').toLowerCase();
  let target=tdee;
  if(obj.includes('emag'))target=tdee-500;
  else if(obj.includes('massa')||obj.includes('hipertrof'))target=tdee+250;
  target=Math.max(1200,Math.round(target/50)*50);
  const protein=Math.round(weight*(obj.includes('massa')||obj.includes('hipertrof')?1.8:1.6));
  const remaining=Math.max(0,target-protein*4);const carbs=Math.round((remaining*.60)/4);const fat=Math.round((remaining*.40)/9);return {bmr:Math.round(bmr),tdee:Math.round(tdee),target,protein,carbs,fat};
}

/* NutriFit AI — cálculo por alimentos preferidos */
const foodCatalog={
 arroz:{name:'Arroz branco cozido',ref:100,kcal:130,protein:2.7,carbs:28,fat:.3,unit:'g'},
 arroz_integral:{name:'Arroz integral cozido',ref:100,kcal:124,protein:2.6,carbs:25.8,fat:1,unit:'g'},
 feijao:{name:'Feijão cozido',ref:100,kcal:77,protein:4.8,carbs:14,fat:.5,unit:'g'},
 lentilha:{name:'Lentilha cozida',ref:100,kcal:116,protein:9,carbs:20,fat:.4,unit:'g'},
 grao_bico:{name:'Grão-de-bico cozido',ref:100,kcal:164,protein:8.9,carbs:27.4,fat:2.6,unit:'g'},
 macarrao:{name:'Macarrão cozido',ref:100,kcal:158,protein:5.8,carbs:30.9,fat:.9,unit:'g'},
 cuscuz:{name:'Cuscuz de milho cozido',ref:100,kcal:112,protein:2.2,carbs:25, fat:.7,unit:'g'},
 tapioca:{name:'Tapioca preparada',ref:50,kcal:80,protein:.1,carbs:20,fat:0,unit:'g'},
 batata:{name:'Batata-doce cozida',ref:100,kcal:86,protein:1.6,carbs:20.1,fat:.1,unit:'g'},
 batata_inglesa:{name:'Batata inglesa cozida',ref:100,kcal:87,protein:1.9,carbs:20.1,fat:.1,unit:'g'},
 mandioca:{name:'Mandioca cozida',ref:100,kcal:125,protein:.6,carbs:30,fat:.3,unit:'g'},
 pao:{name:'Pão francês',ref:50,kcal:135,protein:4.5,carbs:28,fat:1.2,unit:'g'},
 pao_integral:{name:'Pão integral',ref:50,kcal:125,protein:5,carbs:22,fat:2,unit:'g'},
 aveia:{name:'Aveia em flocos',ref:100,kcal:389,protein:16.9,carbs:66.3,fat:6.9,unit:'g'},
 granola:{name:'Granola',ref:30,kcal:135,protein:3,carbs:21,fat:5,unit:'g'},
 banana:{name:'Banana',ref:100,kcal:89,protein:1.1,carbs:22.8,fat:.3,unit:'g'},
 maca:{name:'Maçã',ref:100,kcal:52,protein:.3,carbs:13.8,fat:.2,unit:'g'},
 laranja:{name:'Laranja',ref:100,kcal:47,protein:.9,carbs:11.8,fat:.1,unit:'g'},
 mamao:{name:'Mamão',ref:100,kcal:43,protein:.5,carbs:10.8,fat:.3,unit:'g'},
 morango:{name:'Morango',ref:100,kcal:32,protein:.7,carbs:7.7,fat:.3,unit:'g'},
 abacate:{name:'Abacate',ref:100,kcal:160,protein:2,carbs:8.5,fat:14.7,unit:'g'},
 frango:{name:'Peito de frango grelhado',ref:100,kcal:165,protein:31,carbs:0,fat:3.6,unit:'g'},
 carne:{name:'Carne bovina magra',ref:100,kcal:217,protein:26,carbs:0,fat:12,unit:'g'},
 carne_moida:{name:'Carne moída magra',ref:100,kcal:215,protein:26,carbs:0,fat:11,unit:'g'},
 peixe:{name:'Filé de peixe grelhado',ref:100,kcal:120,protein:26,carbs:0,fat:2,unit:'g'},
 tilapia:{name:'Tilápia grelhada',ref:100,kcal:128,protein:26,carbs:0,fat:2.7,unit:'g'},
 atum:{name:'Atum em água',ref:100,kcal:116,protein:26,carbs:0,fat:.8,unit:'g'},
 sardinha:{name:'Sardinha',ref:100,kcal:208,protein:25,carbs:0,fat:11,unit:'g'},
 ovos:{name:'Ovos inteiros',ref:1,kcal:72,protein:6.3,carbs:.4,fat:4.8,unit:'un'},
 iogurte:{name:'Iogurte natural desnatado',ref:170,kcal:92,protein:10,carbs:14,fat:0,unit:'g'},
 leite:{name:'Leite desnatado',ref:200,kcal:70,protein:6.6,carbs:10,fat:.2,unit:'ml'},
 leite_integral:{name:'Leite integral',ref:200,kcal:122,protein:6.4,carbs:9.4,fat:6.6,unit:'ml'},
 queijo:{name:'Queijo minas frescal',ref:30,kcal:79,protein:5.2,carbs:1,fat:6.2,unit:'g'},
 cottage:{name:'Queijo cottage',ref:100,kcal:98,protein:11,carbs:3.4,fat:4.3,unit:'g'},
 ricota:{name:'Ricota',ref:100,kcal:140,protein:12,carbs:3,fat:9,unit:'g'},
 azeite:{name:'Azeite de oliva',ref:10,kcal:90,protein:0,carbs:0,fat:10,unit:'g'},
 castanhas:{name:'Castanhas',ref:20,kcal:118,protein:4,carbs:4,fat:10,unit:'g'},
 amendoim:{name:'Amendoim',ref:20,kcal:114,protein:5.2,carbs:3.2,fat:9.8,unit:'g'},
 pasta_amendoim:{name:'Pasta de amendoim',ref:15,kcal:90,protein:3.8,carbs:3,fat:7.5,unit:'g'},
 chia:{name:'Chia',ref:15,kcal:73,protein:2.5,carbs:6.3,fat:4.6,unit:'g'},
 salada:{name:'Salada variada',ref:100,kcal:30,protein:1.5,carbs:5,fat:.2,unit:'g'},
 brocolis:{name:'Brócolis cozido',ref:100,kcal:35,protein:2.4,carbs:7.2,fat:.4,unit:'g'},
 cenoura:{name:'Cenoura cozida',ref:100,kcal:35,protein:.8,carbs:8.2,fat:.2,unit:'g'},
 abobora:{name:'Abóbora cozida',ref:100,kcal:40,protein:1.2,carbs:10,fat:.1,unit:'g'},
 tomate:{name:'Tomate',ref:100,kcal:18,protein:.9,carbs:3.9,fat:.2,unit:'g'}
};
const foodAliases={arroz:'arroz','arroz branco':'arroz','arroz integral':'arroz_integral','feijão':'feijao',feijao:'feijao',frango:'frango','peito de frango':'frango',carne:'carne',peixe:'peixe',ovo:'ovos',ovos:'ovos',aveia:'aveia',banana:'banana',iogurte:'iogurte',batata:'batata','batata doce':'batata','batata-doce':'batata',pão:'pao',pao:'pao',leite:'leite',queijo:'queijo',azeite:'azeite',castanha:'castanhas',castanhas:'castanhas',salada:'salada'};
function foodKey(t){const s=String(t||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');for(const [a,k] of Object.entries(foodAliases)){const aa=a.normalize('NFD').replace(/[\u0300-\u036f]/g,'');if(s.includes(aa))return k}return null}
function foodCalc(k,amount){const f=foodCatalog[k],x=Number(amount)||0;if(!f||!x)return null;const q=x/f.ref;return {name:f.name,amount:x,unit:f.unit,kcal:Math.round(f.kcal*q),protein:+(f.protein*q).toFixed(1),carbs:+(f.carbs*q).toFixed(1),fat:+(f.fat*q).toFixed(1)}}
function smartPlan(p,request){
 const meta=getMetabolicData(p), target=Math.max(800,Number(meta.target)||2000);
 const text=String(request||'').toLowerCase(); let keys=[...new Set(Object.entries(foodAliases).filter(([a])=>text.includes(a.normalize('NFD').replace(/[\u0300-\u036f]/g,''))).map(([,k])=>k))];
 if(text.includes('sem lactose'))keys=keys.filter(k=>!['leite','iogurte','queijo'].includes(k));
 if(text.includes('sem peixe'))keys=keys.filter(k=>k!=='peixe');
 if(!keys.length)keys=['arroz','feijao','frango','ovos','banana','aveia'];
 const prot=keys.filter(k=>['frango','carne','peixe','ovos','iogurte','queijo'].includes(k)), carb=keys.filter(k=>['arroz','arroz_integral','feijao','batata','pao','aveia','banana'].includes(k));
 const defs=[['07:00','Café da manhã',.25],['10:00','Lanche da manhã',.10],['12:30','Almoço',.30],['16:30','Lanche da tarde',.10],['20:00','Jantar',.25]];
 const meals=defs.map(([time,name,share],i)=>{
   let ks=i===0?keys.filter(k=>['ovos','aveia','banana','iogurte','pao','leite','queijo'].includes(k)).slice(0,3):((i===2||i===4)?[prot[i===2?0:Math.min(1,prot.length-1)]||'ovos',carb[0]||'arroz',keys.includes('feijao')&&i===2?'feijao':null,keys.includes('salada')?'salada':null,keys.includes('azeite')?'azeite':null].filter(Boolean):keys.filter(k=>['banana','aveia','iogurte','pao','castanhas','ovos'].includes(k)).slice(0,2));
   if(!ks.length)ks=['ovos','banana'];
   const per=target*share/ks.length; let foods=ks.map(k=>{const f=foodCatalog[k];let a=f.ref*per/f.kcal;if(f.unit==='un')a=Math.max(1,Math.round(a));else a=Math.max(5,Math.round(a/5)*5);return foodCalc(k,a)}).filter(Boolean);
   const total=foods.reduce((a,f)=>({kcal:a.kcal+f.kcal,protein:a.protein+f.protein,carbs:a.carbs+f.carbs,fat:a.fat+f.fat}),{kcal:0,protein:0,carbs:0,fat:0});
   return {time,name,kcal:total.kcal,protein:+total.protein.toFixed(1),carbs:+total.carbs.toFixed(1),fat:+total.fat.toFixed(1),foods,items:foods.map(f=>`${f.name} — ${f.amount}${f.unit==='un'?' un':' g'}`)};
 });
 const total=meals.reduce((a,m)=>({kcal:a.kcal+m.kcal,protein:a.protein+m.protein,carbs:a.carbs+m.carbs,fat:a.fat+m.fat}),{kcal:0,protein:0,carbs:0,fat:0});
 return {meta,target,keys,meals,total};
}

const nutritionCatalog={
  ovos:{name:'Ovos inteiros',unit:'2 unidades',kcal:144,protein:13,carbs:1,fat:10},
  aveia:{name:'Aveia em flocos',unit:'60 g',kcal:234,protein:10,carbs:40,fat:4},
  banana:{name:'Banana',unit:'120 g',kcal:107,protein:1,carbs:28,fat:0},
  iogurte:{name:'Iogurte natural desnatado',unit:'170 g',kcal:92,protein:10,carbs:14,fat:0},
  frango:{name:'Peito de frango grelhado',unit:'180 g',kcal:297,protein:56,carbs:0,fat:6},
  arroz:{name:'Arroz integral cozido',unit:'200 g',kcal:260,protein:5,carbs:54,fat:2},
  feijao:{name:'Feijão cozido',unit:'100 g',kcal:77,protein:5,carbs:14,fat:1},
  salada:{name:'Salada variada',unit:'150 g',kcal:45,protein:2,carbs:8,fat:0},
  azeite:{name:'Azeite de oliva',unit:'10 g',kcal:90,protein:0,carbs:0,fat:10},
  castanhas:{name:'Castanhas',unit:'20 g',kcal:118,protein:4,carbs:4,fat:10},
  batata:{name:'Batata-doce cozida',unit:'250 g',kcal:215,protein:4,carbs:50,fat:0},
  peixe:{name:'Filé de peixe grelhado',unit:'180 g',kcal:198,protein:42,carbs:0,fat:4}
};
function scaleFood(food,factor){return {...food,kcal:Math.round(food.kcal*factor),protein:Math.round(food.protein*factor),carbs:Math.round(food.carbs*factor),fat:Math.round(food.fat*factor),unit:food.unit};}
function planForPatient(p,request){
  const meta=getMetabolicData(p), r=(request||'').toLowerCase();
  const lactose=r.includes('lactose')||String(p.restrictions||'').toLowerCase().includes('lactose');
  const cheap=r.includes('barat')||r.includes('econôm')||r.includes('simples');
  const obj=String(p.objective||'').toLowerCase();
  const base=obj.includes('massa')||obj.includes('hipertrof')
    ? [["Café da manhã",'07:00',['ovos','aveia','banana']],['Almoço','12:30',['frango','arroz','feijao','salada','azeite']],['Lanche da tarde','16:30',['iogurte','banana','castanhas']],['Jantar','20:00',['peixe','batata','salada','azeite']]]
    : [["Café da manhã",'07:00',['ovos','aveia','banana']],['Almoço','12:30',['frango','arroz','feijao','salada','azeite']],['Lanche da tarde','16:30',['iogurte','banana']],['Jantar','20:00',['peixe','batata','salada']]];
  const shares=[.25,.35,.15,.25];
  return base.map((meal,i)=>{
    const desired=Math.round(meta.target*shares[i]);
    let foods=meal[2].map(k=>nutritionCatalog[k]).filter(Boolean);
    if(lactose)foods=foods.filter(f=>f!==nutritionCatalog.iogurte);
    if(cheap)foods=foods.map(f=>f===nutritionCatalog.peixe?nutritionCatalog.frango:f);
    const current=foods.reduce((sum,f)=>sum+f.kcal,0)||1;
    const factor=desired/current;
    const scaled=foods.map(f=>scaleFood(f,factor));
    const total=scaled.reduce((sum,f)=>sum+f.kcal,0);
    const protein=scaled.reduce((sum,f)=>sum+f.protein,0);
    const carbs=scaled.reduce((sum,f)=>sum+f.carbs,0);
    const fat=scaled.reduce((sum,f)=>sum+f.fat,0);
    return {time:meal[1],name:meal[0],kcal:total,protein,carbs,fat,foods:scaled,items:scaled.map(f=>`${f.name} — ${f.unit}`)};
  });
}
function renderSuggestSummary(){
  const p=selectedPatient;
  if(!p){byId('suggestSummary').innerHTML='<b>Nenhum paciente selecionado.</b><br><small>Selecione um paciente para calcular a meta e gerar o plano.</small>';return;}
  const m=getMetabolicData(p);
  const avatar=byId('suggestPatientAvatar');
  if(avatar) avatar.textContent=p.initials||String(p.name||'').split(/\s+/).map(n=>n[0]).slice(0,2).join('').toUpperCase()||'—';
  const title=byId('suggestPatientTitle');
  if(title) title.textContent=`Sugerir plano alimentar · ${p.name}`;
  const subtitle=byId('suggestPatientSubtitle');
  if(subtitle) subtitle.textContent=`Objetivo: ${p.objective||'não informado'} · usando as informações cadastradas no paciente.`;
  byId('suggestSummary').innerHTML=`<div class="suggest-patient-meta"><span><small>TMB</small><b>${m.bmr.toLocaleString('pt-BR')} kcal</b></span><span><small>Gasto diário</small><b>${m.tdee.toLocaleString('pt-BR')} kcal</b></span><span><small>Meta do plano</small><b>${m.target.toLocaleString('pt-BR')} kcal</b></span><span><small>Proteína</small><b>${m.protein} g/dia</b></span></div><div class="suggest-patient-details"><div><small>Restrições</small><b>${p.restrictions||'Nenhuma'}</b></div><div><small>Preferências</small><b>${p.preferences||'Não informadas'}</b></div></div>`;
}
byId('suggestPlanBtn')?.addEventListener('click',()=>{renderSuggestSummary();byId('generatedPlan').hidden=true;openModal(suggestPlanModal)});
byId('closeSuggestPlanModal')?.addEventListener('click',()=>closeModal(suggestPlanModal));
byId('cancelSuggestPlan')?.addEventListener('click',()=>closeModal(suggestPlanModal));
byId('suggestPlanForm')?.addEventListener('submit',e=>{
  e.preventDefault();const p=selectedPatient;if(!p){showToast('Selecione um paciente primeiro.');return;}
  const request=`${byId('planRequest').value||''} ${byId('preferredFoods')?.value||''}`.trim(),smart=smartPlan(p,request),meals=smart.meals,meta=smart.meta,box=byId('generatedPlan');box.hidden=false;
  box.innerHTML=`<div class="generated-head"><div><span class="eyebrow">SUGESTÃO GERADA</span><h3>Plano de ${p.name}</h3><p class="muted">Meta calculada pela TMB/TDEE: ${meta.target.toLocaleString('pt-BR')} kcal/dia · ${meta.protein} g de proteína</p></div><b>${meta.target.toLocaleString('pt-BR')} kcal</b></div>${meals.map(m=>`<div class="generated-meal"><span>${m.time}</span><div><b>${m.name}</b><p>${m.foods.map(f=>`${f.name}: ${f.unit}`).join(' · ')}</p><small>${m.protein} g proteína · ${m.carbs} g carboidratos · ${m.fat} g gorduras</small></div><strong>${m.kcal} kcal</strong></div>`).join('')}<div class="disclaimer">Sugestão automática para apoio ao atendimento. Revise o plano antes de entregar ao paciente.</div><button class="primary full" type="button" id="assignGeneratedPlan">Atribuir este plano ao paciente</button>`;
  byId('assignGeneratedPlan')?.addEventListener('click',()=>{
    const plan={id:`plan_${Date.now()}`,type:'suggested',name:`Plano personalizado — ${p.name}`,calories:smart.target,protein:Math.round(smart.total.protein),carbs:Math.round(smart.total.carbs),fat:Math.round(smart.total.fat),meals:smart.meals.map(m=>({time:m.time,name:m.name,kcal:m.kcal,protein:m.protein,carbs:m.carbs,fat:m.fat,foods:m.foods,items:m.items})),preferences:smart.keys,updatedAt:new Date().toISOString()};
    patientPlans[p.id]=plan; persistPlans(); saveBuilderDraft(p.id,planToBuilderDraft(plan)); renderPatientPlan(); renderAlimentacao(); closeModal(suggestPlanModal); showToast(`Plano de ${p.name} criado e disponível para edição.`);
  });
});

/* NutriFit v4 — correções de plano alimentar */
(function(){
  const q=s=>document.querySelector(s);
  function getPatient(){ return typeof selectedPatient!=='undefined' ? selectedPatient : null; }
  function getPlans(){
    if(typeof patientPlans!=='undefined') return patientPlans;
    try{return JSON.parse(localStorage.getItem('nutrifit-patient-plans')||'{}')||{};}catch(e){return {};}
  }
  function removePlan(){
    const p=getPatient();
    if(!p){alert('Selecione um paciente antes de remover o plano.');return;}
    const plans=getPlans();
    if(!plans[p.id]){alert('Este paciente não possui um plano alimentar salvo.');return;}
    if(!confirm('Remover o plano alimentar deste paciente?')) return;
    delete plans[p.id];
    try{localStorage.setItem('nutrifit-patient-plans',JSON.stringify(plans));const drafts=JSON.parse(localStorage.getItem('nutrifit-plan-builder-drafts')||'{}')||{};delete drafts[p.id];localStorage.setItem('nutrifit-plan-builder-drafts',JSON.stringify(drafts));}catch(e){}
    if(typeof renderAlimentacao==='function') renderAlimentacao();
    if(typeof renderPatientPlan==='function') renderPatientPlan();
    if(typeof renderPlanPage==='function') renderPlanPage();
    const b=q('#removeMealPlanBtn');if(b)b.disabled=true;
    window.scrollTo({top:0,behavior:'smooth'});
  }
  document.addEventListener('click',e=>{const b=e.target.closest('#removeMealPlanBtn');if(b){e.preventDefault();e.stopImmediatePropagation();removePlan();}},true);
  function refreshGoals(){
    const modal=q('#suggestPlanModal'), p=getPatient(); if(!modal||!p)return;
    let d=null; try{if(typeof getMetabolicData==='function')d=getMetabolicData(p)}catch(e){}
    d=d||{}; const kcal=Number(d.target||p.calories||0), prot=Number(d.protein||p.protein||0);
    const carbs=Number(d.carbs||p.carbs||0), fat=Number(d.fat||p.fat||0);
    let panel=modal.querySelector('.nf-goal-panel');
    if(!panel){panel=document.createElement('div');panel.className='nf-goal-panel';const form=modal.querySelector('#suggestPlanForm');if(form)form.prepend(panel);}
    panel.innerHTML=`<div class="nf-goal-card"><span>Calorias</span><b>${kcal} kcal</b><small>Da calculadora</small></div><div class="nf-goal-card"><span>Proteínas</span><b>${prot} g</b><small>Da calculadora</small></div><div class="nf-goal-card"><span>Carboidratos</span><b>${carbs} g</b><small>Da calculadora</small></div><div class="nf-goal-card"><span>Gorduras</span><b>${fat} g</b><small>Da calculadora</small></div>`;
  }
  document.addEventListener('click',e=>{if(e.target.closest('#suggestPlanBtn'))setTimeout(refreshGoals,30)});
  const removeDownload=()=>document.querySelectorAll('#downloadPlanBtn').forEach(e=>e.remove());
  removeDownload();new MutationObserver(removeDownload).observe(document.body,{childList:true,subtree:true});
})();


/* NutriFit v9 — construtor simples de plano alimentar */
document.addEventListener('click',e=>{
  const b=e.target.closest('#addMealPlanBtn');
  if(b){e.preventDefault();showPage('plano');renderPatientPlan();}
});
