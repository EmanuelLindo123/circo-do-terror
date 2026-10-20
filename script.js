(function () {
  'use strict';

  const cfg = window.CIRCO_CONFIG;
  if (!cfg || !Array.isArray(cfg.produtos)) {
    document.body.textContent = 'Não foi possível carregar o cardápio. Verifique o arquivo config.js.';
    return;
  }

  const storageKey = 'circo-terror-carrinho-v1';
  const products = new Map(cfg.produtos.map((p) => [p.id, p]));
  const money = (n) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
  const escapeHtml = (v) => String(v).replace(/[&<>"']/g, (s) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
  const byId = (id) => document.getElementById(id);

  let cart = {};
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
      for (const [id, qty] of Object.entries(saved)) {
        if (products.has(id) && Number.isSafeInteger(qty) && qty > 0) cart[id] = Math.min(qty, 99);
      }
    }
  } catch (_) { /* O carrinho continua funcionando mesmo com armazenamento indisponível. */ }

  let toastTimeout;
  let lastFocus = null;
  const entries = () => Object.entries(cart).filter(([id, qty]) => products.has(id) && qty > 0).map(([id, qty]) => ({ ...products.get(id), qty }));
  const cartCount = () => entries().reduce((sum, p) => sum + p.qty, 0);
  const cartTotal = () => entries().reduce((sum, p) => sum + p.preco * p.qty, 0);
  function saveCart() { try { localStorage.setItem(storageKey, JSON.stringify(cart)); } catch (_) {} }

  function notify(message) {
    const el = byId('toast');
    el.textContent = message;
    el.hidden = false;
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => { el.hidden = true; }, 2400);
  }

  function renderCatalog() {
    const container = byId('catalogo');
    container.innerHTML = cfg.categorias.map((cat) => {
      const list = cfg.produtos.filter((p) => p.categoria === cat.id);
      if (!list.length) return '';
      return `<section class="categoria" id="${escapeHtml(cat.id)}" aria-label="${escapeHtml(cat.titulo)}">
        <img class="placa" src="${escapeHtml(cat.placa)}" alt="${escapeHtml(cat.titulo)}" />
        <div class="lista">${list.map((p) => {
          const descricao = p.descricao || 'Confira os ingredientes';
          return `<article class="produto">
            ${p.categoria === 'salgados'
              ? `<div class="foto foto-salgado" role="img" aria-label="${escapeHtml(p.nome)}" style="background-position:${escapeHtml(p.imagemPos || '50%')} center"></div>`
              : `<img class="foto" src="${escapeHtml(p.imagem)}" alt="${escapeHtml(p.nome)}" loading="lazy" />`}
            <div class="produto-info"><h3 class="nome">${escapeHtml(p.nome)}</h3>
              <div class="sala">${escapeHtml(descricao)}</div>
              <div class="preco">${money(p.preco)}</div>
              <button class="add" type="button" data-add="${escapeHtml(p.id)}" aria-label="Adicionar ${escapeHtml(p.nome)} ao carrinho"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>Adicionar</button>
            </div></article>`;
        }).join('')}</div></section>`;
    }).join('');
  }

  function refreshCounters() {
    const count = cartCount();
    byId('topCount').textContent = count;
    byId('stickyCount').textContent = `(${count})`;
    byId('stickyTotal').textContent = money(cartTotal());
    byId('stickyCart').hidden = count === 0 || !byId('cartOverlay').hidden;
  }

  function add(id) {
    if (!products.has(id)) return;
    cart[id] = Math.min(99, (cart[id] || 0) + 1);
    saveCart(); refreshCounters();
    notify('Adicionado ao carrinho!');
  }

  function updateQuantity(id, diff) {
    if (!products.has(id)) return;
    const qty = Math.max(0, Math.min(99, (cart[id] || 0) + diff));
    if (!qty) delete cart[id]; else cart[id] = qty;
    saveCart(); renderCart(); refreshCounters();
  }

  function route() {
    const distinct = [...new Set(entries().map((p) => p.sala))];
    if (distinct.length > 1) return 'AB';
    return distinct[0] || null;
  }

  function generateMessage() {
    const list = entries();
    const different = [...new Set(list.map((p) => p.sala))];
    const lines = ['🎪 *CIRCO DO TERROR — NOVO PEDIDO*', ''];
    for (const sala of different) {
      if (different.length > 1) lines.push(`*${cfg.salas[sala]?.nome || 'Sala ' + sala}*`);
      for (const p of list.filter((p) => p.sala === sala)) {
        lines.push(`${p.qty}x ${p.nome} — ${money(p.qty * p.preco)}`);
      }
      lines.push('');
    }
    lines.push(`*TOTAL: ${money(cartTotal())}*`);
    lines.push('', 'Pedido feito pelo cardápio digital do Circo do Terror.');
    return lines.join('\n');
  }

  function renderCart() {
    const container = byId('cartContents');
    const list = entries();
    if (!list.length) {
      container.innerHTML = '<div class="empty"><div class="empty-icon">🛒</div>Seu carrinho está vazio.<br>Escolha um produto para começar.<button type="button" class="back-shopping" id="backShopping">Voltar ao cardápio</button></div>';
      return;
    }
    const r = route();
    const name = cfg.salas[r]?.nome || 'Sala a definir';
    container.innerHTML = `<div class="cart-list">${list.map((p) =>
      `<div class="cart-item"><div><h3>${escapeHtml(p.nome)}</h3><small>${escapeHtml(cfg.salas[p.sala]?.nome || p.sala)} · ${money(p.preco)} cada</small></div>
        <div class="item-price">${money(p.preco * p.qty)}</div>
        <div></div><div class="stepper"><button type="button" data-change="-1" data-product="${escapeHtml(p.id)}" aria-label="Diminuir quantidade de ${escapeHtml(p.nome)}">−</button><span>${p.qty}</span><button type="button" data-change="1" data-product="${escapeHtml(p.id)}" aria-label="Aumentar quantidade de ${escapeHtml(p.nome)}">+</button></div>
      </div>`).join('')}</div>
      <footer class="cart-foot"><div class="total"><span>Total</span><span>${money(cartTotal())}</span></div>
        <p class="routetip">${r === 'AB' ? 'Seu carrinho tem produtos de mais de uma sala. O pedido completo irá para o responsável pelos pedidos mistos.' : `Seu pedido será encaminhado para ${escapeHtml(name)}.`}</p>
        <button type="button" class="finalizar" id="checkout"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z"/></svg>Finalizar pelo WhatsApp</button>
        <p class="simulado">O WhatsApp abrirá com o pedido preenchido. Basta tocar em Enviar.</p>
      </footer>`;
  }

  function openSheet(id) {
    lastFocus = document.activeElement;
    byId(id).hidden = false;
    document.body.style.overflow = 'hidden';
    if (id === 'cartOverlay') { renderCart(); refreshCounters(); byId('closeCart').focus(); }
    else byId('closePreview').focus();
  }

  function closeSheet(id) {
    byId(id).hidden = true;
    if (byId('cartOverlay').hidden && byId('previewOverlay').hidden) document.body.style.overflow = '';
    refreshCounters();
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
  }

  function checkout() {
    if (!cartCount()) return;
    const r = route();
    const rawPhone = String(cfg.salas[r]?.whatsapp || '').replace(/\D/g, '');
    const message = generateMessage();
    // Não há número fictício ou envios simulados: sem configuração, mostramos a prévia.
    if (!/^\d{12,13}$/.test(rawPhone)) {
      byId('previewBody').textContent = message;
      openSheet('previewOverlay');
      return;
    }
    // Link oficial: abre a conversa com mensagem preenchida; o cliente envia manualmente.
    window.location.href = `https://wa.me/${rawPhone}?text=${encodeURIComponent(message)}`;
  }

  document.addEventListener('click', (event) => {
    const addButton = event.target.closest('[data-add]');
    if (addButton) { add(addButton.dataset.add); return; }
    const qButton = event.target.closest('[data-change]');
    if (qButton) { updateQuantity(qButton.dataset.product, Number(qButton.dataset.change)); return; }
    if (event.target.closest('#topCart,#stickyButton')) { openSheet('cartOverlay'); return; }
    if (event.target.closest('#closeCart,#backShopping')) { closeSheet('cartOverlay'); return; }
    if (event.target.closest('#closePreview')) { closeSheet('previewOverlay'); return; }
    if (event.target.closest('#checkout')) { checkout(); return; }
    if (event.target.closest('#copyMessage')) {
      const text = byId('previewBody').textContent;
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(() => notify('Pedido copiado!')).catch(() => notify('Selecione e copie a mensagem acima.'));
      else notify('Selecione e copie a mensagem acima.');
    }
    if (event.target === byId('cartOverlay')) closeSheet('cartOverlay');
    if (event.target === byId('previewOverlay')) closeSheet('previewOverlay');
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !byId('previewOverlay').hidden) closeSheet('previewOverlay');
    else if (event.key === 'Escape' && !byId('cartOverlay').hidden) closeSheet('cartOverlay');
  });

  renderCatalog();
  refreshCounters();
})();