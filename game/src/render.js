// DOM rendering for Tidepool Tussle: heroes, hands, boards, bubbles, log, overlays.
// The selection lives here: selectedHand (index) or selectedAttacker (creature).

let selectedHand = -1;
let selectedAttacker = null;

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

function buildCardElement(card, opts) {
  const fam = FAMILIES[card.family];
  const node = el('div', 'card ' + fam.css);
  node.appendChild(el('div', 'cost', String(card.cost)));
  node.appendChild(el('div', 'family ' + fam.css, fam.glyph + ' ' + fam.name));
  node.appendChild(el('div', 'art', card.art));
  node.appendChild(el('div', 'name', card.name));
  if (card.keyword) node.appendChild(el('div', 'keyword', card.keyword));
  const stats = el('div', 'stats');
  stats.appendChild(el('span', 'atk', '⚔ ' + card.atk));
  stats.appendChild(el('span', 'hp', '♥ ' + card.hp));
  node.appendChild(stats);
  if (opts && opts.onClick) node.addEventListener('click', opts.onClick);
  return node;
}

function buildBoardCardElement(game, creature, side) {
  const classes = [];
  const isPlayer = side === game.player;
  if (isPlayer && game.active === 'player' && game.phase === 'playing') {
    if (creature.canAttack) classes.push('ready');
    if (selectedAttacker === creature) classes.push('selected');
  }
  if (creature.justPlayed && !creature.canAttack) classes.push('sick');
  if (selectedAttacker && !isPlayer) classes.push('targetable');
  const node = buildCardElement(creature, {
    onClick: function () { onBoardCardClick(game, creature, side); },
  });
  for (const c of classes) node.classList.add(c);
  if (creature.justPlayed) {
    node.classList.add('just-played');
    creature.justPlayed = false;
  }
  return node;
}

function renderHero(game, side, isPlayer) {
  const tideEl = document.getElementById(isPlayer ? 'player-tide' : 'enemy-tide');
  const fillEl = document.getElementById(isPlayer ? 'player-tide-fill' : 'enemy-tide-fill');
  const deckEl = document.getElementById(isPlayer ? 'player-deck' : 'enemy-deck');
  tideEl.textContent = String(side.tide);
  fillEl.style.width = Math.max(0, (side.tide / side.maxTide) * 100) + '%';
  deckEl.textContent = String(side.deck.length);
  const heroEl = document.getElementById(isPlayer ? 'player-hero' : 'enemy-hero');
  heroEl.classList.toggle(
    'targetable',
    !isPlayer && !!selectedAttacker && game.phase === 'playing' && game.active === 'player',
  );
  if (!isPlayer) {
    heroEl.onclick = function () {
      if (selectedAttacker) attackHero(game, game.player, selectedAttacker, game.enemy);
    };
  }
}

function renderHand(game, side, isPlayer) {
  const handEl = document.getElementById(isPlayer ? 'player-hand' : 'enemy-hand');
  handEl.innerHTML = '';
  if (!isPlayer) {
    for (let i = 0; i < side.hand.length; i++) handEl.appendChild(el('div', 'card-back'));
    return;
  }
  side.hand.forEach(function (cardId, index) {
    const base = CARD_BY_ID[cardId];
    const node = buildCardElement(base, {
      onClick: function () { onHandCardClick(game, index); },
    });
    if (index === selectedHand) node.classList.add('selected');
    if (!canPlayCard(game, index)) node.classList.add('unaffordable');
    handEl.appendChild(node);
  });
}

function renderBoard(game, side, isPlayer) {
  const boardEl = document.getElementById(isPlayer ? 'player-board' : 'enemy-board');
  boardEl.innerHTML = '';
  if (side.board.length === 0) {
    boardEl.appendChild(el('div', 'empty-note', isPlayer ? 'Your creatures gather here' : 'No enemy creatures yet'));
    return;
  }
  for (const creature of side.board) {
    boardEl.appendChild(buildBoardCardElement(game, creature, side));
  }
}

function renderBubbles(game) {
  const wrap = document.getElementById('bubbles');
  wrap.innerHTML = '';
  const side = game.player;
  for (let i = 0; i < side.maxBubbles; i++) {
    const bubble = el('span', i < side.bubbles ? '' : 'spent', '🫧');
    wrap.appendChild(bubble);
  }
  wrap.appendChild(el('span', '', ' ' + side.bubbles + '/' + side.maxBubbles + ' bubbles'));
}

function renderLog(game) {
  const logEl = document.getElementById('log');
  logEl.innerHTML = '';
  for (const line of game.log) {
    logEl.appendChild(el('div', '', line));
  }
}

function renderPower(game) {
  const btn = document.getElementById('btn-power');
  const used = game.player.powerUsed;
  btn.disabled = used || game.phase !== 'playing' || game.active !== 'player';
  btn.textContent = used ? '🌊 Tide Surge (spent)' : '🌊 Tide Surge (once) · +2 bubbles, +2 Tide';
  const status = document.getElementById('enemy-power');
  status.textContent = game.enemy.powerUsed
    ? '👑 Royal Blessing: spent'
    : '👑 Royal Blessing: ready (fires at 12 Tide)';
  status.classList.toggle('spent', game.enemy.powerUsed);
}

function renderTurn(game) {
  const banner = document.getElementById('turn-banner');
  const endBtn = document.getElementById('btn-end-turn');
  if (game.phase === 'won') banner.textContent = 'You win! 🏆';
  else if (game.phase === 'lost') banner.textContent = 'Pell wins this tide.';
  else if (game.active === 'player') banner.textContent = 'Your turn — turn ' + game.turn;
  else banner.textContent = 'Pell is thinking…';
  endBtn.disabled = !(game.phase === 'playing' && game.active === 'player');
  endBtn.textContent = game.phase === 'playing' ? 'End turn ⏎' : '—';
}

function renderAll(game) {
  renderHero(game, game.enemy, false);
  renderHero(game, game.player, true);
  renderHand(game, game.enemy, false);
  renderHand(game, game.player, true);
  renderBoard(game, game.enemy, false);
  renderBoard(game, game.player, true);
  renderBubbles(game);
  renderPower(game);
  renderLog(game);
  renderTurn(game);
  if (game.phase === 'title') showTitleOverlay(game);
  else if (game.phase === 'won') showEndOverlay(game, true);
  else if (game.phase === 'lost') showEndOverlay(game, false);
  else hideOverlay();
}

function onHandCardClick(game, index) {
  if (game.phase !== 'playing' || game.active !== 'player') return;
  if (canPlayCard(game, index)) {
    selectedHand = -1;
    selectedAttacker = null;
    playCard(game, index);
  } else {
    selectedHand = index;
  }
  renderAll(game);
}

function onBoardCardClick(game, creature, side) {
  if (game.phase !== 'playing' || game.active !== 'player') return;
  if (side === game.player) {
    if (creature.canAttack) {
      selectedAttacker = selectedAttacker === creature ? null : creature;
      selectedHand = -1;
    }
  } else if (selectedAttacker) {
    const attacker = selectedAttacker;
    selectedAttacker = null;
    attackCreature(game, game.player, attacker, game.enemy, creature);
  }
  renderAll(game);
}

function hideOverlay() {
  document.getElementById('overlay').classList.remove('show');
}

function showOverlay(html) {
  const card = document.getElementById('overlay-card');
  card.innerHTML = '';
  card.appendChild(html);
  document.getElementById('overlay').classList.add('show');
}

function showTitleOverlay(game) {
  const wrap = el('div');
  wrap.appendChild(el('h1', '', '🌊 TIDEPOOL TUSSLE'));
  wrap.appendChild(el('h2', '', 'A duel of the tidepools — you vs Pell, King of the Tidepools · 24 creatures · hero powers'));
  const rules = el('ul', 'rules');
  const lines = [
    'Both guardians start with 20 Tide. Reduce Pell\u2019s Tide to 0 and you win. Pell goes second, so he opens with 4 cards to your 3.',
    'Each turn you gain bubbles: turn 1 gives 1, turn 2 gives 2, up to 8. Bubbles refill every turn.',
    'Click a card in your hand to play it if you can afford its cost. Creatures wait a turn before they can attack — unless they are Swift.',
    'Click one of your ready creatures, then click an enemy creature or Pell himself to attack. Creatures strike back when attacked.',
    'Splash cards deal 1 damage to the enemy hero the moment they are played.',
    'Hero powers, once per game: your Tide Surge (button, or P) gives +2 bubbles and +2 Tide. Pell\u2019s Royal Blessing fires on its own the first time his Tide drops to 12 — he restores 5. Spend yours after his is gone, or strike through it.',
    'Empty deck? The deep claims 1 Tide, then 2, then 3, and so on — no duel drags forever.',
    'Keys: 1–7 play a hand card · P uses Tide Surge · Enter ends your turn · Esc returns here.',
  ];
  for (const line of lines) rules.appendChild(el('li', '', line));
  wrap.appendChild(rules);
  const btn = el('button', 'big-btn', '▶ Start the duel');
  btn.addEventListener('click', function () { startDuel(game); });
  wrap.appendChild(btn);
  showOverlay(wrap);
}

function showEndOverlay(game, won) {
  const wrap = el('div');
  const title = el('h1', won ? 'win-title' : 'lose-title', won ? '🏆 YOU WIN!' : '🌊 PELL WINS');
  wrap.appendChild(title);
  wrap.appendChild(el('h2', '', won
    ? 'The tidepools are yours. Pell bows out with a grumble.'
    : 'Pell keeps the pools this time. The tide will turn.'));
  wrap.appendChild(el('div', 'stat-line', 'Turns played: ' + game.stats.turns));
  wrap.appendChild(el('div', 'stat-line', 'Creatures summoned: ' + game.stats.played));
  wrap.appendChild(el('div', 'stat-line', 'Damage dealt: ' + game.stats.damageDealt + ' · Enemy creatures sunk: ' + game.stats.killed));
  const btn = el('button', 'big-btn', '↻ Play again');
  btn.addEventListener('click', function () { restartGame(game); });
  wrap.appendChild(btn);
  showOverlay(wrap);
}

function showRulesOverlay(game) {
  const wrap = el('div');
  wrap.appendChild(el('h1', '', 'HOW TO PLAY'));
  const rules = el('ul', 'rules');
  const lines = [
    'Goal: reduce Pell\u2019s Tide from 20 to 0 before he does the same to you.',
    'Bubbles are your energy. Turn N gives N bubbles (max 8); they refill each turn.',
    'Play a card by clicking it. A creature cannot attack the turn it arrives, unless it is Swift.',
    'Attack: click your ready creature, then click an enemy creature or Pell.',
    'Splash: the card deals 1 damage to the enemy hero as soon as it is played.',
    'Empty deck: the deep claims 1 Tide, then 2, then 3, and so on.',
    'Families: 🌊 Wave (balanced) · 🐚 Shell (tough) · 🪸 Coral (fierce) · 🌿 Kelp (quick).',
    'Keys: 1–7 play a hand card · Enter ends your turn · Esc shows this help.',
  ];
  for (const line of lines) rules.appendChild(el('li', '', line));
  wrap.appendChild(rules);
  const btn = el('button', 'big-btn', 'Back to the table');
  btn.addEventListener('click', function () { renderAll(game); });
  wrap.appendChild(btn);
  showOverlay(wrap);
}
