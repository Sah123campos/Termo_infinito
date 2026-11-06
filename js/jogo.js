(() => {
  'use strict';

  // ---------- Dados ----------
  const semAcento = (p) => p.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const VALIDAS_SET = new Set(VALIDAS.split(' '));
  const LISTA = RESPOSTAS.map((p) => ({ texto: p, chave: semAcento(p) }));
  LISTA.forEach((p) => VALIDAS_SET.add(p.chave));

  const MODOS = { 1: 'Termo', 2: 'Dueto', 4: 'Quarteto', 8: 'Oiteto', 10: 'Dezeto' };
  const LETRAS = 5;
  const tentativasDo = (n) => n + 5; // 6, 7, 9, 13, 15
  const COLUNAS = { 1: [1], 2: [2, 1], 4: [4, 2], 8: [8, 4, 2], 10: [10, 5, 2] };

  // ---------- Armazenamento (opcional) ----------
  const guardar = (k, v) => { try { localStorage.setItem('termoInf_' + k, JSON.stringify(v)); } catch (e) {} };
  const ler = (k, padrao) => {
    try { const v = localStorage.getItem('termoInf_' + k); return v === null ? padrao : JSON.parse(v); }
    catch (e) { return padrao; }
  };

  // ---------- Estado ----------
  const est = {
    n: ler('modo', 1),
    palavras: [],      // [{texto, chave}]
    tentativas: [],    // chaves já enviadas
    resolvido: [],     // índice da linha onde acertou, ou -1
    atual: Array(LETRAS).fill(''),
    cursor: 0,
    bloqueado: false,
    fimRodada: false,
    placar: 0,
    sequencia: 0,
    teclas: [],        // por quadro: {letra: 'certo'|'lugar'|'errado'}
    saco: [],
    tempo: { ativo: false, acabou: false, minutos: ler('minutos', 3), fimEm: 0, id: null },
  };
  if (!MODOS[est.n]) est.n = 1;

  // ---------- Elementos ----------
  const $ = (id) => document.getElementById(id);
  const elTab = $('tabuleiros');
  const elTeclado = $('teclado');
  const elArea = $('area');
  const elToast = $('toast');

  // ---------- Sorteio sem repetir ----------
  function sortear() {
    if (est.saco.length === 0) {
      est.saco = LISTA.slice();
      for (let i = est.saco.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [est.saco[i], est.saco[j]] = [est.saco[j], est.saco[i]];
      }
    }
    return est.saco.pop();
  }

  // ---------- Avaliação de uma tentativa ----------
  function avaliar(tentativa, resposta) {
    const res = Array(LETRAS).fill('errado');
    const sobra = {};
    for (let i = 0; i < LETRAS; i++) {
      if (tentativa[i] === resposta[i]) res[i] = 'certo';
      else sobra[resposta[i]] = (sobra[resposta[i]] || 0) + 1;
    }
    for (let i = 0; i < LETRAS; i++) {
      if (res[i] === 'certo') continue;
      const l = tentativa[i];
      if (sobra[l] > 0) { res[i] = 'lugar'; sobra[l]--; }
    }
    return res;
  }

  // ---------- Montagem da tela ----------
  function montarTabuleiros() {
    const linhas = tentativasDo(est.n);
    elTab.innerHTML = '';
    for (let q = 0; q < est.n; q++) {
      const quadro = document.createElement('div');
      quadro.className = 'quadro';
      for (let r = 0; r < linhas; r++) {
        const linha = document.createElement('div');
        linha.className = 'linha vazia';
        for (let c = 0; c < LETRAS; c++) {
          const p = document.createElement('div');
          p.className = 'peca';
          p.dataset.col = c;
          linha.appendChild(p);
        }
        quadro.appendChild(linha);
      }
      elTab.appendChild(quadro);
    }
    ajustarTamanho();
  }

  function ajustarTamanho() {
    const linhas = tentativasDo(est.n);
    const W = elArea.clientWidth - 16;
    const H = elArea.clientHeight - 12;
    let melhor = { s: 0, c: 1, sW: 0 };
    for (const c of COLUNAS[est.n]) {
      const r = Math.ceil(est.n / c);
      // quadro = 5 peças + 4 vãos (0,08) + 6px de borda interna; vão entre quadros = 0,45 peça
      const sW = (W - 6 * c) / (c * (5 + 4 * 0.08) + (c - 1) * 0.45);
      const sH = (H - 6 * r) / (r * (linhas + (linhas - 1) * 0.08) + (r - 1) * 0.45);
      const s = Math.min(sW, sH, 62);
      if (s > melhor.s + 0.5) melhor = { s, c, sW };
    }
    // nunca passa da largura; se faltar altura, a área rola
    const s = Math.floor(Math.min(melhor.sW, 62, Math.max(melhor.s, 16)));
    document.documentElement.style.setProperty('--peca', s + 'px');
    document.documentElement.style.setProperty('--fonte-peca', Math.round(s * (s < 22 ? 0.62 : 0.55)) + 'px');
    elTab.style.gridTemplateColumns = `repeat(${melhor.c}, auto)`;
  }

  const FILEIRAS = ['qwertyuiop', 'asdfghjkl⌫', 'zxcvbnm↵'];
  function montarTeclado() {
    elTeclado.innerHTML = '';
    FILEIRAS.forEach((f) => {
      const fil = document.createElement('div');
      fil.className = 'fileira';
      for (const ch of f) {
        const b = document.createElement('button');
        b.className = 'tecla';
        b.type = 'button';
        if (ch === '⌫') { b.textContent = '⌫'; b.dataset.k = 'apagar'; b.classList.add('larga'); b.setAttribute('aria-label', 'Apagar'); }
        else if (ch === '↵') { b.textContent = 'ENTER'; b.dataset.k = 'enter'; b.classList.add('larga'); }
        else { b.textContent = ch; b.dataset.k = ch; }
        fil.appendChild(b);
      }
      elTeclado.appendChild(fil);
    });
  }

  const CORES = { certo: 'var(--certo)', lugar: 'var(--lugar)', errado: 'var(--errado)' };
  function pintarTeclado() {
    elTeclado.querySelectorAll('.tecla').forEach((b) => {
      const k = b.dataset.k;
      if (k.length !== 1) return;
      b.classList.remove('certo', 'lugar', 'errado');
      b.style.background = '';
      b.style.opacity = '';
      const estados = est.teclas.map((t) => t[k]);
      if (est.n === 1) {
        if (estados[0]) b.classList.add(estados[0]);
        return;
      }
      // apaga a letra quando ela não serve para nenhum quadro que ainda falta resolver
      const faltando = estados.filter((_, q) => est.resolvido[q] < 0);
      if (faltando.length && faltando.every((e) => e === 'errado')) { b.classList.add('errado'); return; }
      // apaga aos poucos: quanto mais quadros sem a letra, mais apagada
      // (Dueto apaga em 2 passos de 50%, Quarteto em 4, Oiteto em 8, Dezeto em 10 passos de 10%)
      const semLetra = faltando.filter((e) => e === 'errado').length;
      if (semLetra) b.style.opacity = (1 - 0.55 * semLetra / faltando.length).toFixed(2);
      if (estados.every((e) => !e)) return;
      // uma faixa de cor por quadro
      const passo = 100 / est.n;
      const partes = estados.map((e, i) => {
        const cor = e ? CORES[e] : 'var(--tecla)';
        return `${cor} ${(i * passo).toFixed(2)}% ${((i + 1) * passo).toFixed(2)}%`;
      });
      b.style.background = `linear-gradient(to right, ${partes.join(', ')})`;
    });
  }

  // ---------- Linha atual ----------
  function linhaEl(q, r) { return elTab.children[q].children[r]; }

  function desenharAtual() {
    const r = est.tentativas.length;
    if (r >= tentativasDo(est.n)) return;
    for (let q = 0; q < est.n; q++) {
      if (est.resolvido[q] >= 0) continue;
      const linha = linhaEl(q, r);
      linha.classList.add('atual');
      linha.classList.remove('vazia');
      [...linha.children].forEach((p, c) => {
        const l = est.atual[c];
        if (l && p.textContent !== l) { p.classList.remove('cheia'); void p.offsetWidth; p.classList.add('cheia'); }
        p.textContent = l;
        if (!l) p.classList.remove('cheia');
        p.classList.toggle('cursor', c === est.cursor && !est.bloqueado);
      });
    }
  }

  // ---------- Nova rodada ----------
  function novaRodada() {
    est.palavras = [];
    const usadas = new Set();
    while (est.palavras.length < est.n) {
      const p = sortear();
      if (usadas.has(p.chave)) continue;
      usadas.add(p.chave);
      est.palavras.push(p);
    }
    est.tentativas = [];
    est.resolvido = Array(est.n).fill(-1);
    est.teclas = Array.from({ length: est.n }, () => ({}));
    est.atual = Array(LETRAS).fill('');
    est.cursor = 0;
    est.bloqueado = false;
    est.fimRodada = false;
    $('faixa').classList.add('oculto');
    montarTabuleiros();
    pintarTeclado();
    desenharAtual();
    elArea.scrollTop = 0;
  }

  // ---------- Entrada ----------
  function digitar(l) {
    if (est.bloqueado || est.fimRodada) return;
    est.atual[est.cursor] = l;
    // pula para a próxima casa vazia à direita (ou só avança)
    let prox = est.cursor + 1;
    while (prox < LETRAS && est.atual[prox]) prox++;
    est.cursor = prox < LETRAS ? prox : Math.min(est.cursor + 1, LETRAS - 1);
    desenharAtual();
  }

  function apagar() {
    if (est.bloqueado || est.fimRodada) return;
    if (est.atual[est.cursor]) est.atual[est.cursor] = '';
    else if (est.cursor > 0) { est.cursor--; est.atual[est.cursor] = ''; }
    desenharAtual();
  }

  function moverCursor(d) {
    if (est.bloqueado || est.fimRodada) return;
    est.cursor = Math.max(0, Math.min(LETRAS - 1, est.cursor + d));
    desenharAtual();
  }

  function tremer() {
    const r = est.tentativas.length;
    for (let q = 0; q < est.n; q++) {
      if (est.resolvido[q] >= 0) continue;
      const l = linhaEl(q, r);
      l.classList.remove('treme'); void l.offsetWidth; l.classList.add('treme');
    }
  }

  function enviar() {
    if (est.bloqueado || est.fimRodada) return;
    if (!est.atual.every(Boolean)) { aviso('Só palavras com 5 letras'); tremer(); return; }
    const chave = est.atual.join('');
    if (!VALIDAS_SET.has(chave)) { aviso('Essa palavra não é aceita'); tremer(); return; }

    const r = est.tentativas.length;
    est.tentativas.push(chave);
    est.bloqueado = true;
    const novosAcertos = [];

    for (let q = 0; q < est.n; q++) {
      if (est.resolvido[q] >= 0) continue;
      const resp = est.palavras[q];
      const cores = avaliar(chave, resp.chave);
      const linha = linhaEl(q, r);
      linha.classList.remove('atual', 'vazia');
      const acertou = chave === resp.chave;
      [...linha.children].forEach((p, c) => {
        p.classList.remove('cursor', 'cheia');
        // mostra o acento da resposta quando a letra está no lugar certo
        p.textContent = cores[c] === 'certo' ? resp.texto[c] : chave[c];
        p.style.animationDelay = (c * 0.12) + 's';
        p.classList.add('vira');
        setTimeout(() => p.classList.add(cores[c]), c * 120 + 250);
      });
      cores.forEach((cor, c) => {
        const l = chave[c];
        const antes = est.teclas[q][l];
        if (cor === 'certo' || (cor === 'lugar' && antes !== 'certo') || (cor === 'errado' && !antes)) est.teclas[q][l] = cor;
      });
      if (acertou) { est.resolvido[q] = r; novosAcertos.push(q); }
    }

    est.atual = Array(LETRAS).fill('');
    est.cursor = 0;

    setTimeout(() => {
      elTab.querySelectorAll('.vira').forEach((p) => { p.classList.remove('vira'); p.style.animationDelay = ''; });
      pintarTeclado();
      novosAcertos.forEach((q) => {
        elTab.children[q].classList.add('resolvido');
        [...linhaEl(q, r).children].forEach((p, c) => {
          p.style.animationDelay = (c * 0.08) + 's';
          p.classList.add('pula');
        });
      });
      if (novosAcertos.length) {
        est.placar += novosAcertos.length;
        atualizarPainel();
      }
      if (tempoEsgotado()) return;
      est.bloqueado = false;
      verificarFim();
    }, LETRAS * 120 + 450);
  }

  function verificarFim() {
    const todas = est.resolvido.every((v) => v >= 0);
    const acabou = est.tentativas.length >= tentativasDo(est.n);
    if (todas) {
      est.fimRodada = true;
      est.sequencia++;
      atualizarPainel();
      const frases = ['Mandou bem!', 'Boa!', 'Incrível!', 'Na mosca!', 'Show!', 'Arrasou!'];
      aviso(`${frases[Math.floor(Math.random() * frases.length)]} Próximas palavras…`);
      setTimeout(() => { if (est.fimRodada && !tempoEsgotado()) novaRodada(); }, 1300);
      return;
    }
    if (acabou) {
      est.fimRodada = true;
      est.sequencia = 0;
      atualizarPainel();
      const faltaram = est.palavras.filter((_, q) => est.resolvido[q] < 0).map((p) => p.texto.toUpperCase());
      const texto = (faltaram.length === 1 ? 'A palavra era ' : 'As palavras eram ') + faltaram.map((p) => `<b>${p}</b>`).join(', ');
      if (est.tempo.ativo) {
        aviso(texto.replace(/<\/?b>/g, ''), 2400);
        setTimeout(() => { if (est.fimRodada && est.tempo.ativo && !tempoEsgotado()) novaRodada(); }, 2400);
      } else {
        $('faixaTexto').innerHTML = texto;
        $('faixa').classList.remove('oculto');
        $('btnProxima').focus();
      }
      return;
    }
    desenharAtual();
  }

  // ---------- Painel ----------
  function atualizarPainel() {
    $('placar').textContent = est.placar;
    $('sequencia').textContent = est.sequencia;
    $('infoSequencia').classList.toggle('oculto', est.tempo.ativo);
    $('infoRelogio').classList.toggle('oculto', !est.tempo.ativo);
    $('btnParar').classList.toggle('oculto', !est.tempo.ativo);
    $('btnTempo').classList.toggle('ativo', est.tempo.ativo);
    document.querySelectorAll('#modos button').forEach((b) => b.classList.toggle('ativo', +b.dataset.n === est.n));
  }

  let toastId = null;
  function aviso(msg, ms = 1500) {
    elToast.textContent = msg;
    elToast.classList.add('visivel');
    clearTimeout(toastId);
    toastId = setTimeout(() => elToast.classList.remove('visivel'), ms);
  }

  // ---------- Contra o tempo ----------
  const formatar = (s) => {
    s = Math.max(0, Math.ceil(s));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(ss).padStart(2, '0');
  };
  const minTxt = (m) => m < 1 ? Math.round(m * 60) + ' s' : m.toLocaleString('pt-BR') + ' min';
  const tempoEsgotado = () => est.tempo.ativo && est.tempo.acabou;
  const chaveRecorde = () => `recorde_${est.n}_${est.tempo.minutos}`;

  function iniciarTempo() {
    pararRelogio();
    est.tempo.ativo = true;
    est.tempo.acabou = false;
    est.tempo.fimEm = Date.now() + est.tempo.minutos * 60000;
    est.placar = 0;
    est.sequencia = 0;
    atualizarPainel();
    novaRodada();
    tique();
    est.tempo.id = setInterval(tique, 250);
  }

  function tique() {
    const rest = (est.tempo.fimEm - Date.now()) / 1000;
    $('relogio').textContent = formatar(rest);
    $('infoRelogio').classList.toggle('acabando', rest <= 10);
    if (rest <= 0) terminarTempo();
  }

  function pararRelogio() {
    clearInterval(est.tempo.id);
    est.tempo.id = null;
    $('infoRelogio').classList.remove('acabando');
  }

  function terminarTempo() {
    pararRelogio();
    est.tempo.acabou = true;
    est.bloqueado = true;
    est.fimRodada = true;
    const pontos = est.placar;
    const recordeAnt = ler(chaveRecorde(), 0);
    const novo = pontos > recordeAnt;
    if (novo) guardar(chaveRecorde(), pontos);
    $('fimPontos').textContent = pontos;
    const palavra = pontos === 1 ? 'palavra' : 'palavras';
    $('fimTexto').textContent = `Você acertou ${pontos} ${palavra} em ${minTxt(est.tempo.minutos)} no modo ${MODOS[est.n]}.`;
    $('fimRecorde').textContent = novo && pontos > 0 ? 'Novo recorde!' : (recordeAnt ? `Seu recorde: ${recordeAnt}` : '');
    abrir('modalFim');
  }

  function sairDoTempo() {
    pararRelogio();
    est.tempo.ativo = false;
    est.placar = 0;
    est.sequencia = 0;
    atualizarPainel();
    novaRodada();
  }

  // ---------- Modais ----------
  function abrir(id) { $(id).classList.remove('oculto'); }
  function fechar(id) { $(id).classList.add('oculto'); }
  const algumModalAberto = () => [...document.querySelectorAll('.modal')].some((m) => !m.classList.contains('oculto'));

  function prepararModalTempo() {
    $('usarTempo').checked = est.tempo.ativo || ler('usarTempo', false);
    $('minutos').value = est.tempo.minutos;
    atualizarOpcoesTempo();
    abrir('modalTempo');
  }

  function atualizarOpcoesTempo() {
    const ligado = $('usarTempo').checked;
    $('opcoesTempo').classList.toggle('desligado', !ligado);
    const min = parseFloat($('minutos').value);
    document.querySelectorAll('#atalhos button').forEach((b) => b.classList.toggle('ativo', +b.dataset.min === min));
    const rec = ler(`recorde_${est.n}_${min}`, 0);
    $('recordeTexto').textContent = rec ? `Recorde no ${MODOS[est.n]} em ${minTxt(min)}: ${rec}` : '';
    $('btnComecar').textContent = ligado ? 'Começar' : (est.tempo.ativo ? 'Voltar ao modo livre' : 'Jogar sem tempo');
  }

  // ---------- Eventos ----------
  elTeclado.addEventListener('click', (e) => {
    const b = e.target.closest('.tecla');
    if (!b) return;
    b.blur();
    const k = b.dataset.k;
    if (k === 'enter') enviar();
    else if (k === 'apagar') apagar();
    else digitar(k);
  });

  elTab.addEventListener('click', (e) => {
    const p = e.target.closest('.linha.atual .peca');
    if (!p || est.bloqueado || est.fimRodada) return;
    est.cursor = +p.dataset.col;
    desenharAtual();
  });

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (algumModalAberto()) {
      if (e.key === 'Escape') document.querySelectorAll('.modal').forEach((m) => { if (m.id !== 'modalFim') m.classList.add('oculto'); });
      return;
    }
    if (e.target.tagName === 'INPUT') return;
    if (e.key === 'Enter') {
      e.preventDefault();
      if (est.fimRodada && !$('faixa').classList.contains('oculto')) { novaRodada(); return; }
      enviar();
    }
    else if (e.key === 'Backspace') { e.preventDefault(); apagar(); }
    else if (e.key === 'Delete') { if (!est.bloqueado && !est.fimRodada) { est.atual[est.cursor] = ''; desenharAtual(); } }
    else if (e.key === 'ArrowLeft') moverCursor(-1);
    else if (e.key === 'ArrowRight') moverCursor(1);
    else {
      const l = semAcento(e.key);
      if (/^[a-z]$/.test(l)) digitar(l);
    }
  });

  document.querySelectorAll('#modos button').forEach((b) => b.addEventListener('click', () => {
    const n = +b.dataset.n;
    if (n === est.n) return;
    est.n = n;
    guardar('modo', n);
    if (est.tempo.ativo) { iniciarTempo(); aviso(`${MODOS[n]} contra o tempo: relógio reiniciado`); }
    else { est.placar = 0; est.sequencia = 0; atualizarPainel(); novaRodada(); }
  }));

  $('btnProxima').addEventListener('click', novaRodada);
  $('btnAjuda').addEventListener('click', () => abrir('modalAjuda'));
  $('btnTempo').addEventListener('click', prepararModalTempo);
  document.querySelectorAll('[data-fechar]').forEach((b) => b.addEventListener('click', () => b.closest('.modal').classList.add('oculto')));
  document.querySelectorAll('.modal').forEach((m) => m.addEventListener('click', (e) => {
    if (e.target === m && m.id !== 'modalFim') m.classList.add('oculto');
  }));

  $('usarTempo').addEventListener('change', atualizarOpcoesTempo);
  $('minutos').addEventListener('input', atualizarOpcoesTempo);
  document.querySelectorAll('#atalhos button').forEach((b) => b.addEventListener('click', () => {
    $('minutos').value = b.dataset.min;
    atualizarOpcoesTempo();
  }));

  $('btnComecar').addEventListener('click', () => {
    const ligado = $('usarTempo').checked;
    guardar('usarTempo', ligado);
    fechar('modalTempo');
    if (!ligado) { if (est.tempo.ativo) sairDoTempo(); return; }
    let min = parseFloat($('minutos').value);
    if (!(min > 0)) { min = 3; }
    min = Math.min(180, Math.max(0.5, Math.round(min * 2) / 2));
    est.tempo.minutos = min;
    guardar('minutos', min);
    iniciarTempo();
  });

  $('btnParar').addEventListener('click', () => { if (est.tempo.ativo) terminarTempo(); });
  $('btnDeNovo').addEventListener('click', () => { fechar('modalFim'); iniciarTempo(); });
  $('btnLivre').addEventListener('click', () => { fechar('modalFim'); guardar('usarTempo', false); sairDoTempo(); });

  window.addEventListener('resize', ajustarTamanho);

  // ---------- Início ----------
  montarTeclado();
  atualizarPainel();
  novaRodada();
  if (!ler('viuAjuda', false)) { abrir('modalAjuda'); guardar('viuAjuda', true); }
})();
