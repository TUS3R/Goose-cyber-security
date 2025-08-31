const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const W = canvas.width;
const H = canvas.height;
const BASE_GAME_SPEED = 9; // Базовая скорость предметов
const BASE_PLAYER_SPEED = 13; // Базовая скорость персонажа

const isMobile =/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
// Player
const player = {
  x: canvas.width / 2 - 60,
  y: canvas.height - 150,
  w: 135,
  h: 140,
  vx: 0,
  speed: BASE_PLAYER_SPEED,
  hitbox:{
    x: 33,
    y: 10,
    w: 70,
    h: 250
  }
};


const UI = {
  score: document.getElementById("score"),
  lives: document.getElementById("lives"),
  acc: document.getElementById("acc"),
  shield: document.getElementById("shield"),
  btnStart: document.getElementById("btnStart"),
  btnPause: document.getElementById("btnPause"),
  btnRestart: document.getElementById("btnRestart"),
  btnTrain: document.getElementById("btnTrain"),
  btnNext: document.getElementById("btnNext"),
  startScreen: document.getElementById("startScreen"),
  tutorialScreen: document.getElementById("tutorialScreen"),
  learnOverlay: document.getElementById("learnOverlay"),
  learnTitle: document.getElementById("learnTitle"),
  learnText: document.getElementById("learnText"),
  learnOk: document.getElementById("learnOk"),
  toast: document.getElementById("toast"),
  btnLeft: document.getElementById('btnLeft'),
  btnRight: document.getElementById('btnRight'),
};

const STATE = {
  running: false,
  paused: false,
  score: 0,
  lives: 3,
  tick: 0,
  spawnEvery: 60,
  speed: BASE_GAME_SPEED,
  correct: 0,
  mistakes: 0,
  shield: 0,
  mode: "game",
  tStart: 0,
  tNow: 0,
  tutIdx: 0,
  tutSchedule: [],
  animationId: null,
};



const bindHold = (btn, key) => {
  const on = e => { 
    e.preventDefault(); 
    keys[key] = true;
    btn.style.backgroundColor = 'rgba(255,255,255,0.3)';
  };
  const off = e => { 
    e.preventDefault(); 
    keys[key] = false;
    btn.style.backgroundColor = 'rgba(255,255,255,0.2)';
  };
  btn.addEventListener('touchstart', on);
  btn.addEventListener('touchend', off);
  btn.addEventListener('mousedown', on);
  btn.addEventListener('mouseup', off);
  btn.addEventListener('mouseleave', off);
};

// Инициализация кнопок
if (UI.btnLeft && UI.btnRight && UI.btnPause) {
  bindHold(UI.btnLeft, 'left');
  bindHold(UI.btnRight, 'right');
  UI.btnPause.addEventListener('click', togglePause);
}

// Обновите обработчики клавиатуры
window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft" || e.key === "a") keys.left = true;
  if (e.key === "ArrowRight" || e.key === "d") keys.right = true;
});

window.addEventListener("keyup", (e) => {
  if (e.key === "ArrowLeft" || e.key === "a") keys.left = false;
  if (e.key === "ArrowRight" || e.key === "d") keys.right = false;
});



document.querySelectorAll('.mobileBtn').forEach(btn => {
  btn.addEventListener('touchstart', function() {
    this.style.backgroundColor = 'rgba(0,91,255,0.4)';
  });
  
  btn.addEventListener('touchend', function() {
    this.style.backgroundColor = 'rgba(0,91,255,0.7)';
  });
});

// --- Audio (WebAudio) ---
let AC = null;
function ensureAudio() {
  if (!AC) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    AC = new Ctx();
  }
}
function envGain(seconds = 0.2) {
  const g = AC.createGain();
  g.gain.setValueAtTime(0, AC.currentTime);
  g.gain.linearRampToValueAtTime(0.8, AC.currentTime + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + seconds);
  return g;
}
function quack() {
  if (!AC) ensureAudio();
  const noise = AC.createBufferSource();
  const buffer = AC.createBuffer(1, AC.sampleRate * 0.25, AC.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.35;
  }
  noise.buffer = buffer;
  const filter = AC.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 800;
  filter.Q.value = 1.2;
  const g = envGain(0.25);
  noise.connect(filter).connect(g).connect(AC.destination);
  noise.start();

  const osc = AC.createOscillator();
  osc.type = "square";
  osc.frequency.setValueAtTime(540, AC.currentTime);
  osc.frequency.exponentialRampToValueAtTime(220, AC.currentTime + 0.18);
  const g2 = envGain(0.18);
  osc.connect(g2).connect(AC.destination);
  osc.start();
  osc.stop(AC.currentTime + 0.22);
  noise.stop(AC.currentTime + 0.25);
}
function sad() {
  if (!AC) ensureAudio();
  const osc = AC.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(220, AC.currentTime);
  osc.frequency.linearRampToValueAtTime(140, AC.currentTime + 0.35);
  const g = envGain(0.4);
  osc.connect(g).connect(AC.destination);
  osc.start();
  osc.stop(AC.currentTime + 0.4);
}
function shieldUp() {
  if (!AC) ensureAudio();
  const o1 = AC.createOscillator();
  o1.type = "triangle";
  o1.frequency.value = 660;
  const o2 = AC.createOscillator();
  o2.type = "triangle";
  o2.frequency.value = 990;
  const g = envGain(0.35);
  o1.connect(g);
  o2.connect(g);
  g.connect(AC.destination);
  o1.start();
  o2.start();
  o1.stop(AC.currentTime + 0.25);
  o2.stop(AC.currentTime + 0.25);
}
function shieldBlock() {
  if (!AC) ensureAudio();
  const o = AC.createOscillator();
  o.type = "sawtooth";
  o.frequency.value = 160;
  const g = envGain(0.18);
  const filt = AC.createBiquadFilter();
  filt.type = "lowpass";
  filt.frequency.value = 400;
  o.connect(filt).connect(g).connect(AC.destination);
  o.start();
  o.stop(AC.currentTime + 0.18);
}



function updateAccuracy() {
  const total = STATE.correct + STATE.mistakes;
  const acc = total ? Math.round((STATE.correct / total) * 100) : 100;
  UI.acc.textContent = acc + "%";
}



// document.addEventListener('touchstart', (e) => {
//   if (e.target === canvas && document.fullscreenElement === null) {
//     canvas.requestFullscreen();
//   }
// });


document.addEventListener('DOMContentLoaded', () => {
  UI.startScreen.classList.remove('hidden');
});

// Переход ко второму экрану
UI.btnNext.addEventListener('click', () => {
  UI.startScreen.classList.add('hidden');
  UI.tutorialScreen.classList.remove('hidden');
});

UI.btnStart.addEventListener('click', () => {
  UI.tutorialScreen.classList.add('hidden');
  ensureAudio();
  STATE.running = true;
  STATE.paused = false;
  loop();
});


// --- Goose sprite (optional SVG) ---
const gooseImg = new Image();
gooseImg.src = "assets/goose.svg"; 
let gooseReady = false;
gooseImg.onload = () => {
  gooseReady = true;
};

// shield sprite
const shieldImg = new Image(); shieldImg.src = "assets/shield.png";
let shieldReady = false;
shieldImg.onload = () => {
    shieldReady = true;
};

const images = {
  boxImg: new Image(),
  usbImg: new Image(),
  phishImg: new Image(),
  ddosImg: new Image(),
  shieldImg: new Image(), 
}
images.boxImg.src = "assets/box.png";
images.usbImg.src = "assets/usb.png";
images.phishImg.src = "assets/phish.png";
images.ddosImg.src = "assets/ddos.png";
images.shieldImg.src = "assets/shield.png";




// Items and animation
const items = [];
const ANIM = { t: 0, blinkT: 0, blinkOpen: 1, wing: 0 };

// Item
const CATALOG = [
  {
    type: "buff",
    image: images.shieldImg,
    width: 80,
    height: 80,
    weight: 2,
    hitbox: { x: 0, y: 0, w: 80, h: 80 }
  },
  {
    type: "safe",
    image: images.boxImg,
    width: 80,
    height: 80,
    weight: 5,
    hitbox: { x: 10, y: 10, w: 60, h: 60 }
  },
  { 
    type: "threatUSB",
    image: images.usbImg,
    width: 80,
    height: 80,
    weight: 4,
    hitbox: { x: 10, y: 10, w: 60, h: 60 },
    title: "USB-угроза",
    description: "Подозрительная флешка! Это может быть вредоносное устройство."
  },
  {
    type: "threatPhishing",
    image: images.phishImg,
    width: 80,
    height: 80,
    hitbox: { x: 10, y: 10, w: 60, h: 60 },
    weight: 6,
    title: "Фишинг",
    description: "Это письмо пытается украсть твои данные!"
  },
  {
    
    type: "threatDDos",
    image: images.ddosImg,
    width: 80,
    height: 80,
    hitbox: { x: 10, y: 10, w: 60, h: 60 },
    weight: 4,
    title: "DDoS-атака",
    description: "Обнаружена попытка перегрузки сети!"
  },
];




// Input
const keys = {};
window.addEventListener("keydown", (e) => {
  keys[e.key] = true;
  if (e.key === "p" || e.key === "P") togglePause();
  if (e.key === "r" || e.key === "R") restart();
});
window.addEventListener("keyup", (e) => {
  keys[e.key] = false;
});
canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
  player.x = mx - player.w / 2;
});

UI.btnStart.addEventListener("click", start);
UI.btnPause.addEventListener("click", togglePause);
UI.btnRestart.addEventListener("click", restart);

UI.learnOk.addEventListener("click", () => {
  STATE.paused = false;
  UI.learnOverlay.classList.add("hidden");
  if (!STATE.animationId) {    
    loop()
  }
});





function preloadImages() {
  const images = [
    { name: 'goose', url: 'assets/goose.svg' },
    { name: 'shield', url: 'assets/shield.png' },
    { name: 'box', url: 'assets/box.png' },
    { name: 'usb', url: 'assets/usb.png' },
    { name: 'phish', url: 'assets/phish.png' },
    { name: 'ddos', url: 'assets/ddos.png' }
  ];

  return Promise.all(
    images.map(img => {
      return new Promise((resolve, reject) => {
        const image = new Image();
        image.src = img.url;
        image.onload = () => resolve();
        image.onerror = reject;
      });
    })
  );
}





function start() {
  ensureAudio();
  UI.startScreen.classList.add("hidden");
  STATE.mode = "game";
  STATE.running = true;
  STATE.paused = false;
  STATE.speed;
  player.speed;
  console.log("[start] Game Speed:", STATE.speed, "Player Speed:", player.speed);
  updateAccuracy();
  restart()
  
}
function togglePause() {
  if (!STATE.running) return;
  STATE.paused = !STATE.paused;
  UI.btnPause.textContent = STATE.paused ? "▶" : "⏸";
}

function restart() {
  if (STATE.animationId) {
    cancelAnimationFrame(STATE.animationId);
  }
  ensureAudio();
  console.log("[Restart] Game Speed:", STATE.speed, "Player Speed:", player.speed);
  STATE.spawnEvery = 50; 
  STATE.score = 0;
  STATE.lives = 3;
  STATE.tick = 0;
  items.length = 0;
  STATE.correct = 0;
  STATE.mistakes = 0;
  STATE.shield = 0;
  
  player.speed = BASE_PLAYER_SPEED;
  STATE.speed = BASE_GAME_SPEED; 

  UI.score.textContent = "0";
  UI.lives.textContent = "❤️❤️❤️";
  UI.shield.textContent = "0";
  updateAccuracy();
  STATE.running = true;
  STATE.paused = false;
  UI.startScreen.classList.add("hidden");
  loop();  
}


function spawn() {
  // const totalWeight = CATALOG.reduce((sum, item) => sum + item.weight, 0);
  // let random = Math.random() * totalWeight;


  // let selected;
  // for (const item of CATALOG) {
  //   random -= item.weight;
  //   if (random <= 0) {
  //     selected = item;
  //     break;
  //   }
  // }

  // const data = CATALOG[Math.floor(Math.random() * CATALOG.length)];
  // const width = data.image ? data.width : 56 + Math.min(260, data.text.length * 6);
  
  
  // items.push({
    
  //   ...selected,
  //   x: Math.random() * (canvas.width - width - 20) + 10,
  //   y: -40,
  //   w: width,
  //   h: data.image ? data.height : 34,
    
  //   vy: BASE_GAME_SPEED + Math.random() * 1.5,
  // });
  

  let SPAWN_COUNT = Math.floor(Math.random() *3)+1;


  // const SPAWN_COUNT = 2; 
  const totalWeight = CATALOG.reduce((sum, item) => sum + item.weight, 0);

  for (let i = 0; i < SPAWN_COUNT; i++) {
    let random = Math.random() * totalWeight;
    const selected = CATALOG.find(item => {
      random -= item.weight;
      return random <= 0;
    }) || CATALOG[0];

    // Расчёт параметров
    const width = selected.image ? selected.width : 56 + Math.min(260, (selected.text?.length || 0) * 6);
    
    // Позиция с проверкой пересечений
    let x;
    let attempts = 0;
    do {
      x = Math.random() * (canvas.width - width - 20) + 10;
      attempts++;
    } while (items.some(item => 
      Math.abs(item.x - x) < (item.w + width) * 0.8
    ) && attempts < 100);

    items.push({
      ...selected,
      x: x,
      y: -40 * (i + 1), // Смещение для каждого предмета
      w: width,
      h: selected.image ? selected.height : 34,
      vy: STATE.speed + Math.random() * 1.5
    });
  }
}


function vibrate() {
  if (navigator.vibrate && STATE.running) {
    navigator.vibrate([15, 30, 15]);
  }
}


function collide(a, b) {
  
  const aBox ={
    x: a.x + (a.hitbox?.x || 0),
    y: a.y + (a.hitbox?.y || 0),
    w: a.hitbox?.w || a.w,
    h: a.hitbox?.h || a.h
  };

  const bBox ={
    x: b.x + (b.hitbox?.x || 0),
    y: b.y + (b.hitbox?.y || 0),
    w: b.hitbox?.w || b.w,
    h: b.hitbox?.h || b.h
  };

  return !(
    aBox.x + aBox.w < bBox.x ||
    aBox.x > bBox.x + bBox.w ||
    aBox.y + aBox.h < bBox.y ||
    aBox.y > bBox.y + bBox.h 
  );
 
}

function drawItem(it) {
  if (it.image) {
    ctx.drawImage(it.image, it.x, it.y, it.w, it.h);
    return;
  }
  const isSafe = it.type === "safe",
    isBuff = it.type === "buff";
  ctx.fillStyle = isSafe
    ? "rgba(101,240,165,0.16)"
    : isBuff
      ? "rgba(255,215,64,0.16)"
      : "rgba(255,113,113,0.16)";
     
  ctx.strokeStyle = isSafe ? "#65f0a5" : isBuff ? "#FFD740" : "#ff7171";
  roundRect(ctx, it.x, it.y, it.w, it.h, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#e6ecff";
  ctx.font = "12px Inter, system-ui, sans-serif";
  ctx.textBaseline = "middle";
  ctx.save();
  ctx.beginPath();
  ctx.rect(it.x + 8, it.y, it.w - 16, it.h);
  ctx.clip();
  ctx.fillText(it.text, it.x + 10, it.y + it.h / 2);
  ctx.restore();
  if (isBuff) {
    ctx.save();
    ctx.translate(it.x + it.w - 28, it.y + it.h / 2);
    ctx.scale(0.8, 0.8);
    ctx.fillStyle = "#FFD740";
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.bezierCurveTo(12, -12, 16, -6, 16, 0);
    ctx.bezierCurveTo(16, 10, 6, 16, 0, 20);
    ctx.bezierCurveTo(-6, 16, -16, 10, -16, 0);
    ctx.bezierCurveTo(-16, -6, -12, -12, 0, -12);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function drawBackground() {
  ctx.save();
  ctx.globalAlpha = 0.2;
  for (let i = 0; i < 50; i++) {
    const sx = (i * 97 + STATE.tick * 0.2) % canvas.width,
      sy = (i * 53) % canvas.height;
    ctx.fillStyle = "#9fb3ff";
    ctx.fillRect(sx, sy, 2, 2);
  }
  ctx.restore();
  ctx.strokeStyle = "#26345f";
  ctx.beginPath();
  ctx.moveTo(0, canvas.height - 6);
  ctx.lineTo(canvas.width, canvas.height - 6);
  ctx.stroke();
}





function update() {
  if (STATE.paused) return;
  console.log("[Update] Game Speed:", STATE.speed);
  console.log("[Update player speed:", player.speed);
  console.log("Tick:", STATE.tick, "Speed:", STATE.speed);
  ANIM.t += 1;
  ANIM.blinkT += 1;
  if (ANIM.blinkT > 240 + Math.random() * 120) {
    ANIM.blinkOpen = 0;
    if (ANIM.blinkT > 250) {
      ANIM.blinkOpen = 1;
      ANIM.blinkT = 0;
    }
  }

  player.vx = 0;


  if (keys.left) player.vx = -player.speed;
  if (keys.right) player.vx = player.speed;

  player.x += player.vx;
  player.x = Math.max(4, Math.min(canvas.width - player.w - 4, player.x));

  // обычный спавн
  if (STATE.tick % STATE.spawnEvery === 0) spawn();

  for (const it of items) {
    it.y += it.vy;
  }

  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    if (collide({ x: player.x, y: player.y, w: player.w, h: player.h }, it)) {
      if (it.type === "safe") {
        quack();
        STATE.score += 10;
        STATE.correct++;
        items.splice(i, 1);
      } else if (it.type === "buff") {
        items.splice(i,1);
        shieldUp();
        STATE.shield = Math.min(3, STATE.shield + 1);
        STATE.score += 5;

        UI.shield.textContent = String(STATE.shield);
      } else if (it.type.startsWith("threat")) {
        items.splice(i, 1);
        if (STATE.shield > 0) {
          STATE.shield--;
          shieldBlock();
        } else {
          sad();
          STATE.lives -= 1;
          STATE.mistakes++;
          STATE.paused = true;
          showLearn(it);;
          
        }
      }
      
      UI.score.textContent = String(STATE.score);
      UI.lives.textContent = "❤️".repeat(Math.max(0, STATE.lives));
      UI.shield.textContent = String(STATE.shield);
      updateAccuracy();

      if (STATE.lives <= 0) {
        gameOver();
        return;
      }
      if (STATE.score >= 300){
        win();
        return;
      }
    } else if (it.y > canvas.height + 40) {
      if (it.type === "safe") {
        STATE.score = Math.max(0, STATE.score - 10);
        UI.score.textContent = String(STATE.score);
        STATE.mistakes++;
        
      } else if (it.type === "threat") {
        STATE.correct++;
      }
      items.splice(i, 1);
      updateAccuracy();
      
    }
  }

  if (STATE.tick % 300 === 0 && STATE.tick > 0) {
    STATE.spawnEvery = Math.max(26, STATE.spawnEvery - 4);
    STATE.speed += 0.25;
    player.speed += 0.25;

  }
}





function drawAllHitboxes() {
  ctx.save();

  ctx.globalCompositeOperation = 'screen'; // Чтобы хитбоксы были поверх всего
  
  // Стили для хитбоксов
  const styles = {
    player: { color: '#00ff88', lineWidth: 2 },
    item: { color: '#ff0044', lineWidth: 1 },
    image: { color: '#0095ff', lineWidth: 1 }
  };

  // Хитбокс игрока
  ctx.strokeStyle = styles.player.color;
  ctx.lineWidth = styles.player.lineWidth;
  const p = player;
  ctx.strokeRect(
    p.x + (p.hitbox?.x || 0),
    p.y + (p.hitbox?.y || 0),
    p.hitbox?.w || p.w,
    p.hitbox?.h || p.h
  );

  // Хитбоксы предметов
  ctx.strokeStyle = styles.item.color;
  ctx.lineWidth = styles.item.lineWidth;
  items.forEach(item => {
    ctx.beginPath();
    ctx.rect(
      item.x + (item.hitbox?.x || 0),
      item.y + (item.hitbox?.y || 0),
      item.hitbox?.w || item.w,
      item.hitbox?.h || item.h
    );
    ctx.stroke();
  });

  // Хитбоксы загруженных изображений (для отладки спрайтов)
  ctx.strokeStyle = styles.image.color;
  ctx.lineWidth = styles.image.lineWidth;
  Object.entries(images).forEach(([name, img]) => {
    if (img.complete) {
      ctx.strokeRect(
        canvas.width - img.width - 10,
        10 + Object.keys(images).indexOf(name) * (img.height + 10),
        img.width,
        img.height
      );
    }
  });

  ctx.restore();
}



function drawDebugHitboxes() {
  ctx.strokeStyle = '#ff0000';
  // Для игрока
  const p = player;
  ctx.strokeRect(p.x + p.hitbox.x, p.y + p.hitbox.y, p.hitbox.w, p.hitbox.h);
  
  // Для предметов
  items.forEach(item => {
    ctx.strokeRect(
      item.x + (item.hitbox?.x || 0),
      item.y + (item.hitbox?.y || 0),
      item.hitbox?.w || item.w,
      item.hitbox?.h || item.h
    );
  });
}



function render() {
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground();

  for (const it of items) {
    drawItem(it);
  }

  
  const idleAngle = Math.sin(ANIM.t * 0.06) * 0.03;
  const moveAngle =
    (player.vx > 0 ? 1 : player.vx < 0 ? -1 : 0) * ANIM.wing * 0.06;
  const angle = idleAngle + moveAngle;
  const bob = Math.sin(ANIM.t * 0.12) * 2;

  ctx.save();
  const pivotX = player.x + player.w * 0.5;
  const pivotY = player.y + player.h - 8;
  ctx.translate(pivotX, pivotY + bob);
  ctx.rotate(angle);
  const drawX = -player.w * 0.5;
  const drawY = -player.h + 8;

  if (gooseReady) {
    ctx.drawImage(gooseImg, drawX, drawY - 8, player.w, player.h + 16);
    // ctx.strokeRect(player.hitbox.x, player.hitbox.y, player.hitbox.w, player.hitbox.h);
  } 
  


  if (shieldReady && STATE.shield > 0) {
    
    ctx.save();
    ctx.translate(drawX, drawY + 16);
    ctx.rotate(angle);

    const shieldOffsetY = 70; 
    const shieldY = -player.h * 0.5 + shieldOffsetY;
    ctx.drawImage(
        shieldImg,
        -player.w * -0.3, 
        shieldY + player.h * 0.3,   
        player.w * 0.5,              
        player.h * 0.5,               
    );
    ctx.restore();
    
  } 

  if (ANIM.blinkOpen === 0) {
    ctx.fillStyle = "rgba(11,18,33,0.85)";
    ctx.fillRect(
      player.w * 0.18,
      -player.h * 0.76,
      player.w * 0.22,
      player.h * 0.06,
    );
  }
  ctx.restore();
  if (window.DEBUG_MODE) {
    drawAllHitboxes();
  }
  
}

function loop() {
  if (!STATE.running) return;
  if (!STATE.paused) {
    STATE.tick++;
    update();
    render();
  }
  STATE.animationId = requestAnimationFrame(loop);
}

function gameOver() {
  STATE.running = false;
  cancelAnimationFrame(STATE.animationId);
  const total = STATE.correct + STATE.mistakes;
  const acc = total ? Math.round((STATE.correct / total) * 100) : 100;
  UI.startScreen.classList.remove("hidden");
  UI.startScreen.querySelector(".panel").innerHTML = `
    <h2>Игра окончена</h2>
    <p>Очки: <b>${STATE.score}</b></p>
    <p>Точность: <b>${acc}%</b></p>
    <button id="btnAgain">Ещё раз</button>
  `;
  
  document.getElementById('btnAgain').addEventListener('click', restart, {once: true});
}


function win() {
  STATE.running = false;
  cancelAnimationFrame(STATE.animationId);
  const total = STATE.correct + STATE.mistakes;
  const acc = total ? Math.round((STATE.correct / total) * 100) : 100;
  UI.startScreen.classList.remove("hidden");
  UI.startScreen.querySelector(".panel").innerHTML = `
    <h2>Победа</h2>
    <p>Очки: <b>${STATE.score}</b></p>
    <p>Точность: <b>${acc}%</b></p>
    <button id="btnAgain">Ещё раз</button>
  `;
  
  document.getElementById('btnAgain').addEventListener('click', restart, {once: true});
}


function showLearn(item, title) {
  STATE.paused = true;


  UI.learnTitle.textContent = title || "Почему это ошибка?";
  const threatTitles = {
    threatUSB: "USB-угроза перехвачена!",
    threatDDoS: "DDoS-атака предотвращена!",
    threatPhishing: "Фишинг обнаружен!"
  };
  const defaultMessage = "Киберугроза нейтрализована!";
  
  UI.learnTitle.textContent = item.title || threatTitles[item.type] || defaultMessage;
  UI.learnText.textContent = item.description || "Это действие могло привести к утечке данных.";
  UI.learnOverlay.classList.remove("hidden");
}


function showToast(msg, ms = 1500) {
  if (!UI.toast) return;
  UI.toast.textContent = msg;
  UI.toast.classList.remove("hidden");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => UI.toast.classList.add("hidden"), ms);
}