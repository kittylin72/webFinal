// 場館配置，用來存放各個小遊戲的規則說明
// 每個場館物件定義了碰撞判定區域、對應 iframe 網址、成功後要加成的屬性與提示文字
const venues = [
    { 
        id: "dorm",
        name: "宿舍",
        x: 140, y: 70, w: 260, h: 140, //進入的判定範圍
        url: "/static/minigames/dorm/index.html",
        targetStat: "stamina", //成功後的加分數值
        bonus: 20, 
        // 對話框顯示的遊戲規則
        rules: "歡迎回到宿舍！在這裡可以好好休息，恢復你的體力。準備好迎接接下來的挑戰了嗎？"
    },
    { 
        id: "library", 
        name: "圖書館", 
        x: 930, y: 330, w: 240, h: 130, 
        url: "/static/minigames/library/index.html", 
        targetStat: "knowledge", 
        bonus: 15, 
        rules: "來到圖書館了！抓緊時間閱讀經典書籍，回答正確答案來大幅提升你的知識吧！"
    },
    { 
        id: "tennis", 
        name: "網球場", 
        x: 910, y: 520, w: 360, h: 170, 
        url: "/static/minigames/tennis/index.html", 
        targetStat: "fitness", 
        bonus: 15, 
        rules: "方向鍵移動，空白鍵發球！在網球場上揮灑汗水，擊敗對手來提升你的體能！"
    },
    { 
        id: "bench", 
        name: "辦公室", 
        x: 180, y: 350, w: 280, h: 150, 
        url: "/static/minigames/bench/index.html", 
        targetStat: "romance", 
        bonus: 15, 
        rules: "時薪可以只有最低薪資，但我的魅力值必須高到破表！讓他看你的眼神，比看到時數表劃滿還要有成就感！"
    },
    { 
        id: "track", 
        name: "操場", 
        x: 880, y: 90, w: 520, h: 170, 
        url: "/static/minigames/track/index.html",
        targetStat: "fun", 
        bonus: 15, 
        rules: "看準時機按下空白鍵進行跳躍，距離到達50m即可增加娛樂數值！"
    }
];

// 用來記錄目前正在進行哪個遊戲
// 這個變數會在進入小遊戲時設定，完成後會根據它判定加分與重新定位玩家
let activeVenue = null;


// ==========================================
// 1. 全域遊戲數據管理
// ==========================================
let gameTurn = 6; // 總行動次數
let gameState = 'selecting'; // 初始狀態：選擇角色
// gameState 可能值：'selecting'、'playing'、'minigame'、'ending'

let currentStats = { 
    stamina: 0, knowledge: 0, fitness: 0, romance: 0, fun: 0 
};
// currentStats 用來動態儲存玩家目前各項屬性值，會在 UI 與小遊戲結果中持續更新

let gameStartTimestamp = null;

// 定義角色初始值
const charInitialStats = {
    nerd:    { stamina: 10, knowledge: 60, fitness: 20, romance: 10, fun: 30 },
    athlete: { stamina: 10, knowledge: 20, fitness: 60, romance: 30, fun: 40 },
    player:  { stamina: 10, knowledge: 10, fitness: 40, romance: 50, fun: 60 }
};

// ==========================================
// 2. UI 更新與邏輯函式
// ==========================================

// 更新左側面板數值與進度條
// 此函式會把 currentStats 的數值寫進 DOM，並在必要時檢查是否遊戲結束
function updateStatsUI() {
    for (let key in currentStats) {
        const bar = document.getElementById(`bar-${key}`); // 取得對應進度條填滿層元素
        const text = document.getElementById(`txt-${key}`); // 取得對應數字文字標籤
        if (bar && text) {
            const percentage = Math.min(currentStats[key], 100); // 確保百分比最高不高於100%
            bar.style.width = percentage + "%"; // 設定CSS寬度
            text.innerText = currentStats[key]; // 寫入純文字數字
        }
    }
    // 更新剩餘行動顯示
    const remainText = document.getElementById('remain-count');
    if (remainText) remainText.innerText = gameTurn;

    // 檢查學期是否結束
    // 只有在真正玩地圖時才會觸發結算機制，避免選角階段誤判

    if (gameTurn <= 0 && gameState === 'playing') {
        checkGameOver();
    }
}

// 修改角色選擇函式
// 選擇角色後的初始化流程
window.selectCharacter = function(charType) {
    player.selectedChar = charType;
    currentStats = { ...charInitialStats[charType] }; // 載入初始數據
    gameStartTimestamp = Date.now();
    gameState = 'playing';
    
    // UI 顯示切換
    document.getElementById('charSelectUI').style.display = 'none'; // 隱藏選角畫面
    document.getElementById('stats-panel').style.display = 'block'; // 亮出左側狀態面板

    updateStatsUI(); // 立即同步數值到左側
    
    const charNames = { nerd: "書呆子", athlete: "運動健將", player: "玩咖" };
    showTeacherTalk(`選擇了${charNames[charType]}嗎？你有 ${gameTurn} 次行動機會，開始冒險吧！`, 50);
    // 請求框與玩家顯示都在此同步完成，確保進入遊戲後畫面清楚

    // 更新玩家名稱顯示
    document.getElementById('player-name-display').innerText = charNames[charType];

    // 更新角色頭像顯示
    const positionMap = { nerd: '12% 30%', athlete: '54% 30%', player: '95% 30%' };
    const avatar = document.getElementById('player-avatar');
    avatar.style.backgroundPosition = positionMap[charType];
};

// 由開始畫面切換到角色選擇畫面
window.enterCharacterSelect = function() {
    const start = document.getElementById('start-screen');
    const select = document.getElementById('charSelectUI');
    if (start) start.style.display = 'none';
    if (select) select.style.display = 'flex';
};

// 打開遊戲說明視窗
window.openInstructions = function() {
    const modal = document.getElementById('instruction-modal');
    if (modal) modal.style.display = 'flex';
};

// 關閉遊戲說明視窗
window.closeInstructions = function() {
    const modal = document.getElementById('instruction-modal');
    if (modal) modal.style.display = 'none';
};

// 從遊戲說明切換到校園地圖預覽
window.openCampusMap = function() {
    const modal = document.getElementById('instruction-modal');
    const mapOverlay = document.getElementById('campus-map-overlay');
    if (modal) modal.style.display = 'none';
    if (mapOverlay) mapOverlay.style.display = 'flex';
};

// 關閉校園地圖並返回說明視窗
window.closeCampusMap = function() {
    const mapOverlay = document.getElementById('campus-map-overlay');
    const modal = document.getElementById('instruction-modal');
    if (mapOverlay) mapOverlay.style.display = 'none';
    if (modal) modal.style.display = 'flex';
};

// 小遊戲的加分介面
// 這個函式可由內嵌 iframe 透過 postMessage 或其他流程觸發，直接加值並扣除行動次數
window.addStats = function(statName, amount) {
    if (currentStats.hasOwnProperty(statName)) {
        currentStats[statName] += amount;
        gameTurn--; // 玩完一次遊戲扣除一回合
        updateStatsUI();
    }
};

// ==========================================
// 3. 基礎遊戲設定 (畫布、資源、移動)
// ==========================================
// 初始化 Canvas 畫布、背景與角色精靈圖等靜態資源
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const viewWidth = 800;
const viewHeight = 600;
canvas.width = viewWidth;
canvas.height = viewHeight;

// 給予畫布獲取鍵盤焦點的能力，防止被 iframe 或外部 DOM 搶走焦點
canvas.tabIndex = 1; 
canvas.style.outline = "none"; // 移除點擊時預設出現的外框黑線

const background = new Image();
background.src = '/static/images/background.png'; 
const spriteSheet = new Image();
spriteSheet.src = '/static/images/spritesheet.png'; 

// player 保存主角座標、尺寸、移動速度與朝向狀態
const player = {
    x: 720, y: 450,
    width: 100, height: 130,
    speed: 5,
    direction: 'front',
    selectedChar: null
};

// 角色動畫切換設定
const gridX = 250; 
const gridY = 250; 
const cropW = 200; 
const cropH = 300; 

// 各角色在精靈圖中的垂直列索引與裁切偏移
// 用於 draw() 時選取正確角色圖塊
const charRows = {
    nerd:    { index: 0, offsetY: 5,  offsetX: 25 },
    athlete: { index: 1, offsetY: 40, offsetX: 25 }, 
    player:  { index: 2, offsetY: 90, offsetX: 10 }
};
const dirCols = { front: 1, back: 2, right: 3, left: 4 };

// 攝影機與鍵盤狀態
const camera = { x: 0, y: 0 };
const keys = {};

// 將監聽器改為同時綁在 window 與 canvas 上，雙重確保焦點回歸時鍵盤能正常工作
// 這裡只記錄按鍵狀態，不直接執行移動邏輯，讓 update() 統一判斷
window.addEventListener('keydown', e => keys[e.key] = true);
window.addEventListener('keyup', e => keys[e.key] = false);
canvas.addEventListener('keydown', e => keys[e.key] = true);
canvas.addEventListener('keyup', e => keys[e.key] = false);

// 這裡僅記錄鍵盤按鍵狀態，不直接處理遊戲邏輯，讓 update() 統一控制移動行為

// 老師說話效果
let typewriterTimer = null; //打字機內部的計時器
let teacherIdleTimer = null;  // 控制說完話後切回靜止動作的計時器
// showTeacherTalk 會啟動打字機動畫，並讓老師頭像在講話與靜止之間切換
window.showTeacherTalk = function(text, speed = 100) {
    const textElement = document.getElementById('dialogue-text');
    const avatar = document.querySelector('.teacher-avatar');
    if (!textElement || !avatar) return;

    // 確保對話系統可見
    document.getElementById('dialogue-system').style.display = 'flex';

    // 進入新對話前，強制清空並殺死先前的所有殘留計時器
    clearInterval(typewriterTimer);
    if (teacherIdleTimer) clearTimeout(teacherIdleTimer);
    
    textElement.innerText = ""; 
    let index = 0; // 字串指針歸零
    avatar.classList.remove('idle');
    avatar.classList.add('talking');

    // 打字機定時循環
    typewriterTimer = setInterval(() => {
        if (index < text.length) {
            textElement.innerText += text.charAt(index);
            index++;
        } else {
            // 所有字打印完畢，清除打字循環
            clearInterval(typewriterTimer);

            // 延時 2 秒後，將大頭照的狀態切換回安靜(idle)狀態
            teacherIdleTimer = setTimeout(() => {
                avatar.classList.remove('talking');
                avatar.classList.add('idle');
            }, 2000);
        }
    }, speed);
};

// ==========================================
// 4. 遊戲主迴圈
// ==========================================
// update() 是遊戲邏輯核心，負責讀取鍵盤、移動玩家、修正邊界、鏡頭追蹤與場館碰撞
function update() {
    if (gameState !== 'playing') return;

    // ✨ 自動焦點防護：如果玩家嘗試按下任何移動鍵，但 Canvas 當下沒有焦點，自動強行抓回
    const movementKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 's', 'a', 'd'];
    const isTryingToMove = movementKeys.some(key => keys[key]);
    
    if (isTryingToMove && document.activeElement !== canvas) {
        canvas.focus();
    }
    // 只要玩家有移動輸入，就強制把鍵盤焦點轉回 Canvas，避免按鍵失效

    if (keys['ArrowUp'] || keys['w']) {
        player.y -= player.speed;
        player.direction = 'back';
    } else if (keys['ArrowDown'] || keys['s']) {
        player.y += player.speed;
        player.direction = 'front';
    } else if (keys['ArrowLeft'] || keys['a']) {
        player.x -= player.speed;
        player.direction = 'left';
    } else if (keys['ArrowRight'] || keys['d']) {
        player.x += player.speed;
        player.direction = 'right';
    }

    const mapW = background.naturalWidth || 2000;
    const mapH = background.naturalHeight || 1500;
    if (player.x < 0) player.x = 0;
    if (player.y < 0) player.y = 0;
    if (player.x + player.width > mapW) player.x = mapW - player.width;
    if (player.y + player.height > mapH) player.y = mapH - player.height;

    // 攝影機鏡頭跟随演算法
    camera.x = player.x - viewWidth / 2 + player.width / 2;
    camera.y = player.y - viewHeight / 2 + player.height / 2;

    // 限制攝影機邊緣滾動
    camera.x = Math.max(0, Math.min(camera.x, mapW - viewWidth));
    camera.y = Math.max(0, Math.min(camera.y, mapH - viewHeight));

    // 確認是否撞入任何場館的矩形包圍盒中
    checkVenueCollision();
}

// 矩形碰撞偵測器
// 檢查玩家目前矩形是否進入任一場館範圍，找到即可觸發對應小遊戲
function checkVenueCollision() {
    if (gameState !== 'playing') return;

    venues.forEach(venue => {
        if (player.x < venue.x + venue.w &&
            player.x + player.width > venue.x &&
            player.y < venue.y + venue.h &&
            player.y + player.height > venue.y) {
            
            enterMinigame(venue); // 發生碰撞，觸發進入小遊戲
        }
    });
}

// 進入小遊戲的流程
function enterMinigame(venue) {
    activeVenue = venue; // 記憶當前活動場館
    gameState = 'minigame'; // 暫停主地圖移動
    
    // 讓老師立刻顯現，並在對話框內跑馬燈輸出該小遊戲的專屬規則文字
    showTeacherTalk(venue.rules, 50);

    // 取得覆蓋層和內嵌 iframe 節點
    const overlay = document.getElementById('minigame-ui') || document.getElementById('minigame-overlay');
    const confirmBox = document.getElementById('popup-confirm');
    const frame = document.getElementById('minigame-frame');
    
    if (!overlay || !frame) {
        console.error("無法載入小遊戲，結構異常。");
        gameState = 'playing';
        return;
    }

    // 進入到特定場所，直接給iframe塞入小遊戲的網址，並顯示覆蓋層
    overlay.style.display = 'flex';
    if (confirmBox) confirmBox.style.display = 'none'; 
    frame.style.display = 'block';
    frame.src = venue.url; // iframe正式發起網路請求加載小遊戲網頁
    
    // 轉移鍵盤焦點至小遊戲
    setTimeout(() => {
        if (frame.contentWindow) frame.contentWindow.focus();
    }, 100);
}

// draw() 負責每一幀的畫面繪製，先清除舊畫面後畫背景與玩家精靈
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height); // 擦除前一幀畫面
    if (background.complete) {
        ctx.drawImage(background, -camera.x, -camera.y);
    }

    // 角色繪製
    if (gameState !== 'selecting' && player.selectedChar && spriteSheet.complete) {
        const charInfo = charRows[player.selectedChar];
        const sx = (dirCols[player.direction] * gridX) + charInfo.offsetX;
        const sy = (charInfo.index * gridY) + charInfo.offsetY;
        ctx.drawImage(
            spriteSheet,
            sx, sy, cropW, cropH,
            player.x - camera.x, player.y - camera.y,
            player.width, player.height
        );
    }
}

// gameLoop() 使用 requestAnimationFrame 連續呼叫 update 與 draw，讓遊戲保持順暢執行
function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// 資源加載檢查
// 當所有關鍵圖片就緒後才開始遊戲主迴圈，避免畫面卡住或空白
let loadedImages = 0;
function onImageLoad() {
    loadedImages++;
    if (loadedImages === 2) gameLoop();
}
background.onload = onImageLoad;
spriteSheet.onload = onImageLoad;
if (background.complete && spriteSheet.complete) gameLoop();

// 監聽小遊戲 iframe 傳回的結果訊息，這是主程式與小遊戲間的通訊橋樑
// 小遊戲會使用 window.parent.postMessage({ type: 'GAME_RESULT', ... }, '*') 將結果送回來
window.addEventListener('message', function(event) {
    if (event.data.type === 'GAME_RESULT') {
        handleGameResult(event.data);
    }
});

// 處理小遊戲結果數據
// 小遊戲結束後會呼叫這裡，負責關閉 iframe、還原畫面並計算屬性變更
function handleGameResult(result) {
    // 取得遮罩與內嵌 iframe 元素
    const overlay = document.getElementById('minigame-ui') || document.getElementById('minigame-overlay'); 
    const frame = document.getElementById('minigame-frame');

    // 清空並完美隱藏 iframe 與遮罩，還原探險地圖外觀
    if (overlay) overlay.style.display = 'none';
    if (frame) {
        frame.style.display = 'none';
        frame.src = ""; 
    }

    gameState = 'playing'; // 恢復狀態機為可走地圖探險狀態

    // 清空移動快取，防止方向鍵卡死
    for (let key in keys) {
        keys[key] = false;
    }
    
    // 將角色安全彈出邊界之外，防止重疊卡死
    // 這段讓角色回到場館外，避免立刻再次觸發碰撞進入同一個場館
    if (activeVenue) {
        if (player.direction === 'front') {
            player.y = activeVenue.y - player.height - 15;
        } else if (player.direction === 'back') {
            player.y = activeVenue.y + activeVenue.h + 15;
        } else if (player.direction === 'left') {
            player.x = activeVenue.x + activeVenue.w + 15;
        } else if (player.direction === 'right') {
            player.x = activeVenue.x - player.width - 15;
        }
    }

    // 確保返回主畫面時，對話框結構依然保持顯示
    const mainDialogue = document.getElementById('dialogue-system');
    if (mainDialogue) mainDialogue.style.display = 'flex';

    // 先強行將焦點從 iframe 身邊剝離
    if (document.activeElement) {
        document.activeElement.blur();
    }

    // 延時 50 毫秒強行下達 focus，逼迫瀏覽器把鍵盤讀取主導權從 iframe 還給 Canvas
    setTimeout(() => {
        canvas.setAttribute('tabindex', '1'); // 確保 tabindex 存在
        canvas.focus({ preventScroll: true }); // 防止焦點造成畫面跳動
        window.focus();
    }, 50);

    setTimeout(() => {
        // 雙重保險：150ms 後如果焦點還是沒回來，再強抓一次
        if (document.activeElement !== canvas && gameState === 'playing') {
            canvas.focus();
        }
    }, 150);

    if (!activeVenue) return;

    // 1. 扣除行動次數
    gameTurn--;
    document.getElementById('remain-count').innerText = gameTurn;

    // 2. 根據場館加分與勝敗給予回饋
    const isSuccess = result.status === 'success';
    if (isSuccess) {
        currentStats[activeVenue.targetStat] += activeVenue.bonus;
        showTeacherTalk(`從 ${activeVenue.name} 特訓回來了！${activeVenue.targetStat} 提升了！`, 50);
    } else {
        showTeacherTalk(`在 ${activeVenue.name} 的挑戰失敗了，再接再厲！`, 50);
    }

    // 3. 扣除體力(每次扣5)
    if (activeVenue.id !== 'dorm') {
        currentStats.stamina -= 5; 
    }

    // 4. 數值限制
    for (let key in currentStats) {
        if (currentStats[key] < 0) currentStats[key] = 0;
        if (currentStats[key] > 100) currentStats[key] = 100;
    }

    updateStatsUI();

    // 5. 檢查結局
    checkGameOver();
}

// 將遊戲歷時轉成易讀文字，例如「2分15秒」
function formatElapsedTime(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) return `${hours}小時${minutes}分${seconds}秒`;
    if (minutes > 0) return `${minutes}分${seconds}秒`;
    return `${seconds}秒`;
}

function checkGameOver() {
    if (currentStats.stamina <= 0 || gameTurn <= 0) {
        triggerEndGame();
    }
}

// 遊戲結束觸發流程：準備發送最終數據到後端，進行成績與結局結算
function triggerEndGame() {
    gameState = 'ending';
    
    // 顯示載入中提示
    showTeacherTalk("正在結算學期成績，教授正在撰寫評語中...", 50);

    console.log("準備發送的數據：", { stats: currentStats, character: player.selectedChar });

    // 將數據發送到 Flask 後端 (補齊完整路徑防止路由迷路)
    // 後端會回傳結算結果，然後儲存於 sessionStorage 再跳轉到 /result
    fetch('/api/game_over', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify({
            stats: currentStats,
            character: player.selectedChar || 'nerd'
        })
    })
    .then(response => {
        console.log("收到後端回應狀態：", response.status);
        if (!response.ok) throw new Error('網路回應不成功，狀態碼：' + response.status);
        return response.json();
    })
    .then(data => {
        console.log("成功拿到後端結算資料：", data);
        const duration = gameStartTimestamp ? formatElapsedTime(Date.now() - gameStartTimestamp) : '0秒';
        data.play_duration = duration;
        // 將後端運算好的結局與評語暫存到 sessionStorage
        sessionStorage.setItem('gameResult', JSON.stringify(data));
        // 跳轉到結局成績單頁面
        window.location.href = '/result';
    })
    .catch(error => {
        console.error('Error:', error);
        alert('結算失敗，詳細原因請看 Console 控制台！\n錯誤訊息：' + error.message);
        gameState = 'playing';
    });
}