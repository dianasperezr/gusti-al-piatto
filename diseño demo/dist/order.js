'use strict';
window.GustiOrder = {
 // Set only after the restaurant confirms its WhatsApp number, including country code.
 phone: null,
 load() {
  try {return new Map(JSON.parse(localStorage.getItem('gusti-cart') || '[]').filter(row => Array.isArray(row) && typeof row[0] === 'string' && Number.isInteger(row[1]) && row[1] > 0 && row[1] <= 99));} catch {return new Map();}
 },
 save(cart) {try {localStorage.setItem('gusti-cart',JSON.stringify([...cart]));} catch {}},
 money(n) {return new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(n);},
 message(cart, products, notes) {
  const lines = [...cart].map(([id,n])=>{const p=products.find(p=>p.id===id);return `${n} × ${p.name} (${p.category}) — ${this.money(p.price*n)}`;});
  const total=[...cart].reduce((sum,[id,n])=>sum+products.find(p=>p.id===id).price*n,0);
  return ['Hola, Gusti Al Piatto. Me gustaría solicitar:', '', ...lines, '', 'Subtotal: '+this.money(total)+' MXN', notes?'Notas: '+notes:'', 'Por favor, confirmen disponibilidad, precios y condiciones de entrega o recolección.'].filter((v,i)=>v||i===1).join('\n');
 },
 url(message) {return this.phone && /^\d{10,15}$/.test(this.phone) ? 'https://wa.me/'+this.phone+'?text='+encodeURIComponent(message) : null;}
};
