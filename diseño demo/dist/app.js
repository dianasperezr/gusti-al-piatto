'use strict';
let products=[];
let activeCategory='Pizzas clásicas';
const categories=['Pizzas clásicas','Pizzas italianas','Entradas y ensaladas','Pastas','Calzones','Postres'];
const cart=GustiOrder.load();
const byId=id=>products.find(p=>p.id===id);
const money=n=>new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',maximumFractionDigits:0}).format(n);
const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function renderMenu(){
 const term=norm(document.querySelector('#search').value.trim());
 const list=products.filter(p=>term?norm(p.name+' '+p.description+' '+p.category).includes(term):p.category===activeCategory);
 document.querySelector('#tabs').innerHTML=categories.map(c=>`<button data-category="${c}" aria-pressed="${!term&&c===activeCategory}">${c}</button>`).join('');
 document.querySelector('#categoryTitle').textContent=term?'Resultados de búsqueda':activeCategory;
 document.querySelector('#results').textContent=list.length+' platillos';
 document.querySelector('#products').innerHTML=list.map(p=>`<article class="product"><div class="product-content">${term?`<span class="result-category">${escapeHtml(p.category)}</span>`:''}<button class="product-title" data-detail="${p.id}">${escapeHtml(p.name)}</button><p>${escapeHtml(p.description)}</p><div class="product-bottom"><span class="price">${money(p.price)}</span><button class="add" data-add="${p.id}" aria-label="Agregar ${escapeHtml(p.name)}" ${p.available===false?'disabled':''}>${p.available===false?'Agotado':'+ Agregar'}</button></div></div>${p.image?`<img src="${p.image}" alt="${escapeHtml(p.name)}" loading="lazy">`:''}</article>`).join('')||'<p class="empty">No encontramos ese platillo. Prueba con otro nombre o ingrediente.</p>';
 document.querySelector('#menuNote').textContent=activeCategory==='Pastas'&&!term?'Todas las pastas se sirven con pan.':'';
}
function updateCart(){
 for(const [id,n] of cart)if(!byId(id)||byId(id).available===false)cart.delete(id);
 GustiOrder.save(cart);
 document.querySelector('#count').textContent=[...cart.values()].reduce((s,n)=>s+n,0);
}
function add(id){if(!byId(id)||byId(id).available===false)return;cart.set(id,Math.min(99,(cart.get(id)||0)+1));updateCart()}
document.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.category){activeCategory=b.dataset.category;document.querySelector('#search').value='';renderMenu()}
 if(b.dataset.add){add(b.dataset.add);b.textContent='✓';setTimeout(()=>{if(b.classList.contains('add'))b.textContent='+ Agregar';else b.textContent='Agregar al carrito'},850)}
 if(b.dataset.close)document.getElementById(b.dataset.close).close();
 if(b.dataset.change){const id=b.dataset.change;const n=Math.min(99,(cart.get(id)||0)+Number(b.dataset.delta));if(n<=0)cart.delete(id);else cart.set(id,n);updateCart()}
 if(b.dataset.detail){const p=byId(b.dataset.detail);document.querySelector('#productDetail').innerHTML=`${p.image?`<img src="${p.image}" alt="${escapeHtml(p.name)}">`:''}<p class="eyebrow">${escapeHtml(p.category)}</p><h2 id="productName">${escapeHtml(p.name)}</h2><p>${escapeHtml(p.description)}</p><p class="detail-price">${money(p.price)}</p><button class="primary" data-add="${p.id}">Agregar al carrito</button><p class="muted">Precio y disponibilidad pendientes de confirmación.</p>`;document.querySelector('#productDialog').showModal()}
});
document.querySelector('#search').addEventListener('input',renderMenu);
document.querySelector('#explorePasta').addEventListener('click',()=>{activeCategory='Pastas';document.querySelector('#search').value='';renderMenu();document.querySelector('#menu').scrollIntoView()});
fetch('catalog.json').then(r=>{if(!r.ok)throw Error('catalog');return r.json()}).then(data=>{products=data;renderMenu();updateCart()}).catch(()=>{document.querySelector('#products').innerHTML='<p>No pudimos cargar el menú. Recarga la página para volver a intentarlo.</p>'});
