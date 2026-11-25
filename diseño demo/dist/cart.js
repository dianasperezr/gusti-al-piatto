'use strict';
const cart=GustiOrder.load();
let products=[];
const $=s=>document.querySelector(s);
const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function render(){
 for(const [id] of cart)if(!products.some(p=>p.id===id&&p.available!==false))cart.delete(id);
 GustiOrder.save(cart);
 let total=0,units=0;
 $('#cartItems').innerHTML=[...cart].map(([id,n])=>{
  const p=products.find(p=>p.id===id);total+=p.price*n;units+=n;
  return `<article class="order-row">${p.image?`<img class="order-photo" src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}">`:'<div class="order-placeholder" aria-hidden="true">Gusti</div>'}<div class="order-info"><span class="result-category">${escapeHtml(p.category)}</span><h2>${escapeHtml(p.name)}</h2><p>${GustiOrder.money(p.price)} / unidad</p></div><div class="order-controls"><div class="quantity"><button data-change="${id}" data-delta="-1" aria-label="Quitar una unidad de ${escapeHtml(p.name)}">−</button><span>${n}</span><button data-change="${id}" data-delta="1" ${n===99?'disabled':''} aria-label="Agregar una unidad de ${escapeHtml(p.name)}">+</button></div><strong>${GustiOrder.money(n*p.price)}</strong><button class="remove" data-remove="${id}" aria-label="Eliminar ${escapeHtml(p.name)}">Eliminar</button></div></article>`;
 }).join('')||'<div class="empty-cart"><h2>Tu próximo antojo te espera.</h2><p>Tu carrito está vacío. Elige algo delicioso para comenzar.</p><a class="primary" href="index.html#menu">Explorar el menú</a></div>';
 $('#summary').hidden=!units;$('#clearCart').disabled=!units;
 $('#unitCount').textContent=`Subtotal (${units} ${units===1?'artículo':'artículos'})`;
 $('#total').textContent=GustiOrder.money(total)+' MXN';
}
document.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.change){const id=b.dataset.change,n=(cart.get(id)||0)+Number(b.dataset.delta);if(n<=0)cart.delete(id);else cart.set(id,Math.min(99,n));render();}
 if(b.dataset.remove){cart.delete(b.dataset.remove);render();}
 if(b.dataset.close)document.getElementById(b.dataset.close).close();
});
$('#clearCart').onclick=()=>{cart.clear();render();};
$('#sendOrder').onclick=()=>{
 if(!cart.size)return;
 const message=GustiOrder.message(cart,products,$('#notes').value.trim());
 const url=GustiOrder.url(message);
 if(url){window.open(url,'_blank','noopener,noreferrer');return;}
 $('#message').value=message;$('#copyStatus').textContent='';$('#messageDialog').showModal();
};
$('#copyMessage').onclick=async()=>{try{await navigator.clipboard.writeText($('#message').value);$('#copyStatus').textContent='Mensaje copiado. No se ha enviado ningún pedido.';}catch{$('#message').focus();$('#message').select();$('#copyStatus').textContent='Selecciona y copia el mensaje.';}};
try{$('#notes').value=sessionStorage.getItem('gusti-notes')||'';}catch{}
$('#notes').oninput=()=>{try{sessionStorage.setItem('gusti-notes',$('#notes').value);}catch{}};
fetch('catalog.json').then(r=>{if(!r.ok)throw Error();return r.json();}).then(data=>{products=data;render();}).catch(()=>{$('#cartItems').textContent='No pudimos cargar el carrito. Recarga la página para intentarlo de nuevo.';});
