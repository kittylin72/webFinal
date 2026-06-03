// ===== GAME CONFIG =====
//定義遊戲的各種參數
const CANVAS_SIZE = 700;
const GRID_COLS = 7;
const GRID_ROWS = 7;
const CELL_SIZE = CANVAS_SIZE / GRID_COLS; // 100px per cell

const GAME_DURATION = 30;
const MAX_NPCS = 7;
const MIN_NPCS = 5;
const NPC_SPEED = 60; // px/sec
const BOSS_SPEED = 30; // px/sec
const CIRCLE_DURATION = 3; // seconds
const COLLISION_DIST = 45;
const INTERACT_DIST = 55;

// ===== CANVAS SETUP =====
//獲取html的canvas元素、設置2D繪製上下文
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = CANVAS_SIZE;
canvas.height = CANVAS_SIZE;

// ===== IMAGE LOADING =====
const SPRITES = {
  background: 'imgs/background.png',
  boss_left: 'imgs/boss_left.png',
  boss_right: 'imgs/boss_right.png',
  female_left: 'imgs/female_left.png',
  female_right: 'imgs/female_right.png',
  main: 'imgs/main.png',
  male_left: 'imgs/male_left.png',
  male_right: 'imgs/male_right.png',
};

const imgs = {};
const imgKeys = ['background','boss_left','boss_right','female_left','female_right','main','male_left','male_right'];
let imgsLoaded = 0;

function loadImages(callback) {
  imgKeys.forEach(key => {
    const img = new Image();
    img.onload = () => {
      imgsLoaded++;
      if (imgsLoaded === imgKeys.length) callback();
    };
    img.onerror = () => {
      imgsLoaded++;
      if (imgsLoaded === imgKeys.length) callback();
    };
    img.src = SPRITES[key];
    imgs[key] = img;
  });
}

// ===== GAME STATE =====
//定義遊戲狀態變量
//狀態分為start、playing、end
let gameState = 'start'; // 'start' | 'playing' | 'end'
let score = 0;
let timeLeft = GAME_DURATION;
let lastTime = 0;
let timerAccum = 0;

// Player的位置、大小、速度、方向、凍結狀態
const player = {
  x: CANVAS_SIZE / 2,
  y: CANVAS_SIZE / 2,
  w: 40,
  h: 64,
  speed: 190,
  dir: 'right', // 'left' | 'right'
  moving: false,
  frozen: false,       // true when hit by boss
  frozenTimer: 0,      // countdown in seconds
};

// Boss位置、大小、方向、生氣狀態
const boss = {
  x: 60,
  y: 60,
  w: 48,
  h: 72,
  dir: 'right',
  angry: false,
  angryTimer: 0,
};

// NPCs列表和ID計數器
let npcs = [];
let npcIdCounter = 0;

// Input
//監聽鍵盤狀態
//空白鍵觸發
const keys = {};
window.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code === 'Space' && gameState === 'playing') {
    e.preventDefault();
    tryInteract();
  }
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

// UI Elements
//獲取html中需要動態更新的UI元素
const scoreEl = document.getElementById('score');
const timerEl = document.getElementById('timer');
const startScreen = document.getElementById('start-screen');
const endScreen = document.getElementById('end-screen');
const finalScoreEl = document.getElementById('final-score');
const endResultEl = document.getElementById('end-result');
const endMsgEl = document.getElementById('end-message');
const penaltyFlash = document.getElementById('penalty-flash');

const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
if (startBtn) startBtn.addEventListener('click', startGame);
if (restartBtn) restartBtn.addEventListener('click', startGame);

// ===== NPC SPAWNING =====
//NPC生成系統
//定義NPC類型
//spawnNPC:在螢幕邊緣隨機生成NPC並加到npc列表中
let npcSpawnTimer = 0;
const NPC_TYPES = [
  { type: 'female', leftKey: 'female_left', rightKey: 'female_right' },
  { type: 'male', leftKey: 'male_left', rightKey: 'male_right' },
];

function spawnNPC() {
  // Pick a row (1-5) that has the fewest NPCs to avoid clustering
  //選擇人數最少的行加入NPC
  const rowCounts = {};
  for (let r = 1; r <= GRID_ROWS - 2; r++) rowCounts[r] = 0;
  for (const n of npcs) if (n.row >= 1 && n.row <= GRID_ROWS - 2) rowCounts[n.row]++;
  const minCount = Math.min(...Object.values(rowCounts));
  const leastUsed = Object.keys(rowCounts).filter(r => rowCounts[r] === minCount).map(Number);
  const row = leastUsed[Math.floor(Math.random() * leastUsed.length)];
  // Spawn from left or right edge
  const fromLeft = Math.random() < 0.5;
  const startX = fromLeft ? -30 : CANVAS_SIZE + 30;
  const targetX = fromLeft ? CANVAS_SIZE + 30 : -30;
  const dir = fromLeft ? 'right' : 'left';
  const typeInfo = NPC_TYPES[Math.floor(Math.random() * NPC_TYPES.length)];

  // Y position: center of the row + some variation
  const cellCenterY = (row + 0.5) * CELL_SIZE;
  const y = cellCenterY + (Math.random() - 0.5) * 30;

  npcs.push({
    id: npcIdCounter++,
    x: startX,
    y: y,
    row: row,
    dir: dir,
    targetX: targetX,
    w: 32,
    h: 56,
    type: typeInfo.type,
    leftKey: typeInfo.leftKey,
    rightKey: typeInfo.rightKey,
    circleTimer: -1,  // -1 = not showing circle
    circleActive: false,
    scored: false,
    heartsTimer: 0,
    hearts: [],
    paused: false, // paused when showing circle
  });
}

// Randomly trigger a circle on one NPC
//定期在隨機的NPC頭上顯示愛心圓圈
let circleEventTimer = 0;
const CIRCLE_EVENT_INTERVAL_MIN = 0.8;
const CIRCLE_EVENT_INTERVAL_MAX = 2;
let nextCircleEventTime = 1.5;

function triggerCircleEvent() {
  // Find NPCs that don't have a circle
  const eligible = npcs.filter(n => !n.circleActive && !n.scored && n.heartsTimer <= 0);
  if (eligible.length === 0) return;
  const npc = eligible[Math.floor(Math.random() * eligible.length)];
  npc.circleActive = true;
  npc.circleTimer = CIRCLE_DURATION;
  npc.paused = true;
}

// ===== INTERACT =====
//案空白鍵的時候檢查周遭是否有圈圈NPC
//如果有就得分並且生成浮動心型動畫
function tryInteract() {
  for (let npc of npcs) {
    if (!npc.circleActive) continue;
    const dx = player.x - npc.x;
    const dy = player.y - npc.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist < INTERACT_DIST) {
      // Score!
      score++;
      scoreEl.textContent = score;
      npc.circleActive = false;
      npc.circleTimer = -1;
      npc.paused = false;
      npc.heartsTimer = 1.5;
      // Spawn hearts
      npc.hearts = [];
      for (let i = 0; i < 4; i++) {
        npc.hearts.push({
          x: npc.x + (Math.random()-0.5)*20,
          y: npc.y - 20,
          vy: -40 - Math.random()*30,
          vx: (Math.random()-0.5)*30,
          life: 1.5,
          maxLife: 1.5,
        });
      }
      break;
    }
  }
}

// ===== BOSS COLLISION =====
let bossCollideCooldown = 0;
let postFreezeGrace = 0; // 2-second grace after unfreeze

function checkBossCollision() {
  if (bossCollideCooldown > 0) return;
  if (postFreezeGrace > 0) return; // grace period after unfreeze
  const dx = player.x - boss.x;
  const dy = player.y - boss.y;
  const dist = Math.sqrt(dx*dx + dy*dy);
  if (dist < COLLISION_DIST) {
    boss.angry = true;
    boss.angryTimer = 3;
    bossCollideCooldown = 3;
    // Freeze player for 3 seconds
    player.frozen = true;
    player.frozenTimer = 3;
    player.moving = false;
    // Show boss impact effect but no score penalty
    showPenaltyFlash();
  }
}

function showPenaltyFlash() {
  penaltyFlash.classList.remove('hidden');
  penaltyFlash.style.animation = 'none';
  void penaltyFlash.offsetHeight;
  penaltyFlash.style.animation = 'flashFade 0.4s ease-out forwards';
  setTimeout(() => penaltyFlash.classList.add('hidden'), 450);
}

// ===== GAME LOOP =====
function startGame() {
  gameState = 'playing';
  score = 0;
  timeLeft = GAME_DURATION;
  timerAccum = 0;
  scoreEl.textContent = 0;
  timerEl.textContent = GAME_DURATION;
  npcs = [];
  npcSpawnTimer = 0;
  circleEventTimer = 0;
  nextCircleEventTime = 3;
  bossCollideCooldown = 0;
  postFreezeGrace = 0;

  player.x = CANVAS_SIZE / 2;
  player.y = CANVAS_SIZE / 2;
  player.dir = 'right';
  player.frozen = false;
  player.frozenTimer = 0;

  boss.x = 60;
  boss.y = 60;
  boss.dir = 'right';
  boss.angry = false;
  boss.angryTimer = 0;

  startScreen.classList.add('hidden');
  startScreen.style.display = 'none';
  endScreen.classList.add('hidden');
  endScreen.style.display = 'none';

  lastTime = performance.now();
  requestAnimationFrame(gameLoop);
}

function sendGameResult(status, scoreValue = null, detail = '') {
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({
      type: 'GAME_RESULT',
      status: status,
      score: scoreValue,
      detail: detail,
    }, '*');
  }
}

function endGame() {
  gameState = 'end';
  finalScoreEl.textContent = score;
  const success = score >= 6;
  const msg = success ? '成功！你達成了任務！' : '失敗...分數未達到 6 分。';
  endMsgEl.textContent = msg;
  if (endResultEl) {
    endResultEl.textContent = success ? '成功' : '失敗';
    endResultEl.className = success ? 'end-result success' : 'end-result failure';
  }
  endScreen.classList.remove('hidden');
  endScreen.style.display = 'flex';
  endScreen.style.zIndex = '200';

  // 先讓玩家看見結果視窗，再延遲告訴父頁面完成遊戲
  setTimeout(() => {
    sendGameResult(success ? 'success' : 'fail', score, msg);
  }, 1500);

  return success;
}

function gameLoop(now) {
  if (gameState !== 'playing') return;
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  update(dt);
  render();
  requestAnimationFrame(gameLoop);
}

function update(dt) {
  // Timer
  timerAccum += dt;
  if (timerAccum >= 1) {
    timerAccum -= 1;
    timeLeft--;
    timerEl.textContent = timeLeft;
    if (timeLeft <= 5) timerEl.style.color = '#ff4444';
    if (timeLeft <= 0) { endGame(); return; }
  }

  // Player frozen timer
  if (player.frozen) {
    player.frozenTimer -= dt;
    if (player.frozenTimer <= 0) {
      player.frozen = false;
      player.frozenTimer = 0;
      postFreezeGrace = 2; // 2-second grace: boss collision disabled
    }
  }
  if (postFreezeGrace > 0) postFreezeGrace -= dt;

  // Player movement
  let dx = 0, dy = 0;
  if (!player.frozen) {
    if (keys['KeyW'] || keys['ArrowUp']) dy = -1;
    if (keys['KeyS'] || keys['ArrowDown']) dy = 1;
    if (keys['KeyA'] || keys['ArrowLeft']) { dx = -1; player.dir = 'left'; }
    if (keys['KeyD'] || keys['ArrowRight']) { dx = 1; player.dir = 'right'; }
  }
  if (dx !== 0 && dy !== 0) { dx *= 0.707; dy *= 0.707; }
  player.x = Math.max(20, Math.min(CANVAS_SIZE-20, player.x + dx * player.speed * dt));
  player.y = Math.max(CELL_SIZE + 10, Math.min(CANVAS_SIZE - CELL_SIZE - 10, player.y + dy * player.speed * dt));
  player.moving = dx !== 0 || dy !== 0;

  // Boss movement toward player
  if (!boss.angry) {
    const bx = player.x - boss.x;
    const by = player.y - boss.y;
    const bd = Math.sqrt(bx*bx + by*by);
    if (bd > 5) {
      boss.x += (bx/bd) * BOSS_SPEED * dt;
      boss.y += (by/bd) * BOSS_SPEED * dt;
      boss.dir = bx > 0 ? 'right' : 'left';
    }
    // Clamp boss to middle rows
    boss.x = Math.max(20, Math.min(CANVAS_SIZE-20, boss.x));
    boss.y = Math.max(CELL_SIZE + 10, Math.min(CANVAS_SIZE - CELL_SIZE - 10, boss.y));
  } else {
    boss.angryTimer -= dt;
    if (boss.angryTimer <= 0) { boss.angry = false; }
  }

  // Boss collision cooldown
  if (bossCollideCooldown > 0) bossCollideCooldown -= dt;
  checkBossCollision();

  // NPC spawning
  npcSpawnTimer += dt;
  if (npcSpawnTimer > 1.5 && npcs.length < MAX_NPCS) {
    npcSpawnTimer = 0;
    if (npcs.length < MIN_NPCS || Math.random() < 0.5) {
      spawnNPC();
    }
  }

  // Circle events
  circleEventTimer += dt;
  if (circleEventTimer >= nextCircleEventTime) {
    circleEventTimer = 0;
    nextCircleEventTime = CIRCLE_EVENT_INTERVAL_MIN + Math.random() * (CIRCLE_EVENT_INTERVAL_MAX - CIRCLE_EVENT_INTERVAL_MIN);
    triggerCircleEvent();
  }

  // Update NPCs
  for (let i = npcs.length - 1; i >= 0; i--) {
    const npc = npcs[i];

    // Move
    if (!npc.paused) {
      const moveDir = npc.dir === 'right' ? 1 : -1;
      npc.x += moveDir * NPC_SPEED * dt;
    }

    // Circle countdown
    if (npc.circleActive) {
      npc.circleTimer -= dt;
      if (npc.circleTimer <= 0) {
        npc.circleActive = false;
        npc.circleTimer = -1;
        npc.paused = false;
      }
    }

    // Hearts
    if (npc.heartsTimer > 0) {
      npc.heartsTimer -= dt;
      for (let h of npc.hearts) {
        h.life -= dt;
        h.x += h.vx * dt;
        h.y += h.vy * dt;
        h.vy += 10 * dt; // slight gravity
      }
    }

    // Remove if off screen
    if (npc.x < -60 || npc.x > CANVAS_SIZE + 60) {
      npcs.splice(i, 1);
    }
  }
}

// ===== RENDERING =====
function render() {
  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  // Background
  if (imgs.background && imgs.background.complete) {
    ctx.drawImage(imgs.background, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
  } else {
    ctx.fillStyle = '#7a8fa6';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  }

  // Draw grid lines (subtle)
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;
  for (let i = 1; i < GRID_COLS; i++) {
    ctx.beginPath();
    ctx.moveTo(i * CELL_SIZE, 0);
    ctx.lineTo(i * CELL_SIZE, CANVAS_SIZE);
    ctx.stroke();
  }
  for (let i = 1; i < GRID_ROWS; i++) {
    ctx.beginPath();
    ctx.moveTo(0, i * CELL_SIZE);
    ctx.lineTo(CANVAS_SIZE, i * CELL_SIZE);
    ctx.stroke();
  }

  // Collect all sprites for z-sort
  const sprites = [];

  // NPCs
  for (const npc of npcs) {
    sprites.push({ type: 'npc', obj: npc, y: npc.y });
  }

  // Boss
  sprites.push({ type: 'boss', obj: boss, y: boss.y });

  // Player
  sprites.push({ type: 'player', obj: player, y: player.y });

  // Sort by y
  sprites.sort((a, b) => a.y - b.y);

  // Draw sprites
  for (const s of sprites) {
    if (s.type === 'npc') drawNPC(s.obj);
    else if (s.type === 'boss') drawBoss(s.obj);
    else if (s.type === 'player') drawPlayer(s.obj);
  }
}

function drawPlayer(p) {
  const img = imgs.main;
  const h = 126;
  const imgW = img && img.naturalHeight > 0 ? img.naturalWidth / 2 : 0;
  const imgH = img && img.naturalHeight > 0 ? img.naturalHeight : 1;
  const w = imgW > 0 ? h * (imgW / imgH) : 0.5 * h;
  const sx = p.dir === 'left' ? 0 : imgW;
  const sw = imgW;
  const sh = imgH;

  // Frozen effect: ice-blue tint overlay + shake
  if (p.frozen) {
    const shakeX = (Math.random() - 0.5) * 3;
    ctx.save();
    ctx.translate(shakeX, 0);
  }

  if (img && img.complete && img.naturalHeight > 0) {
    ctx.drawImage(img, sx, 0, sw, sh, p.x - w/2, p.y - h*0.8, w, h);
  } else {
    ctx.fillStyle = '#4488ff';
    ctx.fillRect(p.x-12, p.y-30, 24, 40);
  }

  // Ice overlay when frozen
  if (p.frozen) {
    const pulse = 0.25 + Math.abs(Math.sin(Date.now()/200)) * 0.25;
    ctx.fillStyle = `rgba(100, 200, 255, ${pulse})`;
    ctx.fillRect(p.x - w/2 - 20, p.y - h*0.8, w + 40, h);

    // Frozen countdown
    const secs = Math.ceil(p.frozenTimer);
    ctx.fillStyle = '#00ccff';
    ctx.font = 'bold 13px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText(`🧊 ${secs}`, p.x, p.y - h*0.8 - 22);

    ctx.restore();
  }

  // Grace period indicator
  if (postFreezeGrace > 0) {
    const graceAlpha = 0.4 + Math.abs(Math.sin(Date.now()/200)) * 0.4;
    ctx.save();
    ctx.globalAlpha = graceAlpha;
    ctx.font = '16px serif';
    ctx.textAlign = 'center';
    ctx.fillText('🛡️', p.x, p.y - h*0.8 - 36);
    ctx.restore();
  }

  // Name tag (no background)
  ctx.fillStyle = '#00ffcc';
  ctx.font = 'bold 11px Courier New';
  ctx.textAlign = 'center';
  ctx.strokeStyle = 'rgba(0,0,0,0.8)';
  ctx.lineWidth = 3;
  ctx.strokeText('你', p.x, p.y - h*0.8 - 6);
  ctx.fillText('你', p.x, p.y - h*0.8 - 6);
}

function drawNPC(npc) {
  const imgKey = npc.dir === 'right' ? npc.rightKey : npc.leftKey;
  const img = imgs[imgKey];
  const h = 105;
  const w = img && img.naturalHeight > 0 ? h * (img.naturalWidth / img.naturalHeight) : 28;

  if (img && img.complete && img.naturalHeight > 0) {
    ctx.drawImage(img, npc.x - w/2, npc.y - h*0.8, w, h);
  } else {
    ctx.fillStyle = npc.type === 'female' ? '#ff88aa' : '#88aaff';
    ctx.fillRect(npc.x - 10, npc.y - 28, 20, 36);
  }

  // Circle indicator
  if (npc.circleActive && npc.circleTimer > 0) {
    const progress = npc.circleTimer / CIRCLE_DURATION;
    const maxR = 28;
    const r = progress * maxR;

    ctx.save();
    // Outer ring (no shadow)
    ctx.strokeStyle = `rgba(255, 100, 150, ${0.6 + Math.sin(Date.now()/150)*0.3})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(npc.x, npc.y - h*0.8 - 16, r, 0, Math.PI * 2);
    ctx.stroke();
    // Fill
    ctx.fillStyle = `rgba(255, 100, 150, 0.15)`;
    ctx.fill();
    ctx.restore();
  }

  // Floating hearts
  if (npc.heartsTimer > 0) {
    for (const h of npc.hearts) {
      if (h.life <= 0) continue;
      const alpha = h.life / h.maxLife;
      ctx.globalAlpha = alpha;
      ctx.font = '14px serif';
      ctx.textAlign = 'center';
      ctx.fillText('❤️', h.x, h.y);
      ctx.globalAlpha = 1;
    }
  }
}

function drawBoss(b) {
  const imgKey = b.dir === 'right' ? 'boss_right' : 'boss_left';
  const img = imgs[imgKey];
  const bh = 137;
  const bw = img && img.naturalHeight > 0 ? bh * (img.naturalWidth / img.naturalHeight) : 72;

  if (img && img.complete && img.naturalHeight > 0) {
    ctx.drawImage(img, b.x - bw/2, b.y - bh*0.8, bw, bh);
  } else {
    ctx.fillStyle = '#333';
    ctx.fillRect(b.x-16, b.y-36, 32, 50);
  }

  // Angry indicator
  if (b.angry) {
    ctx.font = '20px serif';
    ctx.textAlign = 'center';
    const bounce = Math.sin(Date.now()/100) * 3;
    ctx.fillText(':(', b.x, b.y - bh*0.8 - 10 + bounce);
  } else {
    // Warning aura
    const warningDist = 120;
    const dx = player.x - b.x;
    const dy = player.y - b.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist < warningDist) {
      const alpha = (1 - dist/warningDist) * 0.3;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#ff0000';
      ctx.beginPath();
      ctx.arc(b.x, b.y, warningDist, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
    }
  }

  // "BOSS" label (no background)
  ctx.font = 'bold 11px Courier New';
  ctx.textAlign = 'center';
  ctx.strokeStyle = 'rgba(0,0,0,0.9)';
  ctx.lineWidth = 3;
  ctx.strokeText('BOSS', b.x, b.y - bh*0.8 - 6);
  ctx.fillStyle = '#ff4444';
  ctx.fillText('BOSS', b.x, b.y - bh*0.8 - 6);
}

// ===== INIT =====
loadImages(() => {
  // Draw initial start screen canvas
  if (imgs.background && imgs.background.complete) {
    ctx.drawImage(imgs.background, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
  }
});