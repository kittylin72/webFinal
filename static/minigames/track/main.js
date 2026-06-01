/** * 跑酷小遊戲邏輯 (running/main.js)
 * 核心玩法：玩家按空白鍵跳躍躲避障礙物，移動距離達到 50m 即獲勝。
 */

// 取得 HTML 中的 Canvas 畫布元素與 2D 繪圖環境
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// ==========================================
// 1. 配置與初始化（遊戲資料結構）
// ==========================================

// 定義跑道/障礙物的來源圖片裁切參數 (Sprite Sheet 坐標)
// sx, sy: 圖片來源的起始 X, Y 坐標；sw, sh: 裁切的寬度與高度
const trackTypes = [
    { name: "empty",   sx: 285,  sy: 350, sw: 206, sh: 125 }, // 空白跑道（無障礙物）
    { name: "hurdle",  sx: 605,  sy: 350, sw: 216, sh: 125 }, // 跨欄障礙
    { name: "puddle",  sx: 1050, sy: 350, sw: 212, sh: 125 }, // 水窪障礙
    { name: "basket",  sx: 1350, sy: 350, sw: 157, sh: 125 }  // 竹籃障礙
];

// 玩家（跑者）的狀態與屬性設定
const player = {
    x: 180,           // 玩家在畫布上的固定 X 軸位置
    y: 280,           // 玩家目前的 Y 軸高度（預設在地板）
    width: 80,        // 畫布上繪製的角色寬度
    height: 80,       // 畫布上繪製的角色高度
    dy: 0,            // Y 軸每幀的移動速度（垂直速度）
    jumpForce: 14,    // 跳躍的瞬間向上衝力
    gravity: 0.7,     // 重力加速度（每幀將角色往下拉）
    isJumping: false, // 是否正在跳躍中
    isTripped: false, // 是否被絆倒/撞到障礙物
    tripType: null,   // 絆倒玩家的障礙物類型名稱
    isSuccess: false, // 是否挑戰成功
    
    // 角色跑步時的動畫影格（裁切來源圖的五個連續動作）
    runFrames: [
        {sx: 30,   sy: 490, sw: 100, sh: 150}, 
        {sx: 190, sy: 490, sw: 100, sh: 150}, 
        {sx: 340, sy: 490, sw: 100, sh: 150}, 
        {sx: 490, sy: 490, sw: 100, sh: 150}, 
        {sx: 640, sy: 490, sw: 100, sh: 150}
    ],
    // 角色撞到不同障礙物時，對應的跌倒/失敗動畫影格
    fallFrames: {
        "hurdle": {sx: 150,  sy: 800, sw: 150, sh: 180}, 
        "puddle": {sx: 790,  sy: 800, sw: 150, sh: 180}, 
        "basket": {sx: 1380, sy: 800, sw: 150, sh: 180}  
    }
};

// 載入遊戲所需的圖片資源
const bgImg = new Image();
bgImg.src = "images/background.png"; // 跑道與障礙物的背景來源圖
const runnerImg = new Image();
runnerImg.src = "images/runner.png";   // 角色（跑步與跌倒）的來源圖

// 遊戲控制變數
let gameSpeed = 8;        // 地圖向左滾動的速度
let score = 0;            // 玩家目前得分（移動距離，單位：公尺）
let hurdleCount = 0;     // 成功跨越的障礙物次數
let frameCounter = 0;    // 遊戲幀數計數器，用於控制跑步動畫切換速度
let isGameOver = false;   // 遊戲是否結束
let isGameStarted = false;// 遊戲是否已經開始
let tracks = [];          // 畫面上正在滾動的跑道物件陣列
const TW = 220;           // 每段跑道在 Canvas 上的顯示寬度

// 遊戲初始化：預先產生 6 段空白跑道填滿畫面
for (let i = 0; i < 6; i++) {
    tracks.push({ x: i * TW, data: trackTypes[0] });
}

// ==========================================
// 2. 遊戲狀態處理邏輯
// ==========================================

/**
 * 結束遊戲處理函式
 * @param {boolean} success - true 代表勝利（達標），false 代表失敗（撞牆）
 */
function endGame(success) {
    if (isGameOver) return; // 避免重複觸發結束邏輯
    isGameOver = true;
    player.isSuccess = success;
    
    showEndOverlay(success); // 顯示 HTML 疊加層的結算畫面

    // 延時 3 秒後，向父視窗（例如 iframe 的主網頁）發送跨網域訊息，通知遊戲結果
    setTimeout(() => {
        window.parent.postMessage({
            type: 'GAME_RESULT',
            status: success ? 'success' : 'fail',
            score: score,
            detail: success ? '成功完成操場跨欄特訓！' : '不小心被障礙物絆倒了...'
        }, '*');
    }, 3000); 
}

/**
 * 核心更新循環（主要遊戲迴圈，每秒執行約 60 次）
 */
function update() {
    // 若遊戲尚未點擊開始，僅維持繪製畫面，不進行物理運算
    if (!isGameStarted) {
        draw();
        return;
    }

    // 關鍵修正：若遊戲已結束，直接繪製最後一幀並停止所有物理運動
    if (isGameOver) {
        draw(); 
        return; 
    }

    // 成功條件判定：達到 50 公尺立即贏得遊戲並結算
    if (score >= 50) {
        endGame(true);
        draw(); 
        return;
    }

    // --- 玩家物理運算 (跳躍與重力) ---
    player.dy += player.gravity; // 每幀加上重力速度
    player.y += player.dy;       // 更新玩家的 Y 軸位置

    // 落地碰撞偵測（限制玩家不能掉入地板下）
    if (player.y > 280) {
        player.y = 280;          // 強制鎖定在地面高度
        player.dy = 0;           // 垂直速度歸零
        player.isJumping = false;// 解除跳躍狀態
    }

    // --- 跑道滾動與碰撞偵測 ---
    tracks.forEach(t => {
        t.x -= gameSpeed; // 讓跑道依照遊戲速度向左移動
        
        // 計分邏輯：當障礙物完全通過玩家身後 (player.x)，且尚未被計算過時，跨越數 +1
        if (!t.passed && t.data.name !== "empty" && t.x + 100 < player.x) {
            hurdleCount++;
            t.passed = true; // 標記為已通過
        }

        // 碰撞偵測核心（AABB 矩形碰撞）
        if (t.data.name !== "empty") {
            let obstacleX = t.x + 85; // 預設障礙物在該段跑道內的左側相對邊界
            let obstacleW = 45;       // 預設障礙物的碰撞判定寬度
            let triggerY = 265;       // 預設安全高度（玩家 Y 軸高於此數值，即高度不夠低，代表撞到）

            // 針對不同障礙物的圖片位置與大小進行微調，以求碰撞精準
            if (t.data.name === "puddle") {
                obstacleX = t.x + 95;  // 水窪 X 軸偏移
                obstacleW = 50;        // 水窪比較寬
                triggerY = 272;        // 水窪貼近地面，主角跳得極低才會踩到
            } else if (t.data.name === "basket") {
                obstacleX = t.x + 150; // 竹籃在圖片偏後方
                obstacleW = 40;
                triggerY = 268;
            } else if (t.data.name === "hurdle") {
                obstacleX = t.x + 180; // 跨欄在圖片更後方
                obstacleW = 40;
                triggerY = 262;        // 跨欄較高，主角高度高於 262 就會撞到
            }

            // AABB 交叉判定：
            // 主角右邊界 (player.x + 65) > 障礙物左邊界 &&
            // 主角左邊界 (player.x + 25) < 障礙物右邊界 &&
            // 主角腳底高度 (player.y) > 障礙物頂端觸發高度 (代表跳得不夠高)
            if (player.x + 65 > obstacleX && 
                player.x + 25 < obstacleX + obstacleW && 
                player.y > triggerY) {
                player.isTripped = true; 
                player.tripType = t.data.name; // 紀錄是被哪種障礙物絆倒
                endGame(false);                // 觸發失敗結算
            }
        }
    });

    // --- 跑道自動無限生成機制 ---
    // 當最左邊的跑道完全移出畫面外 (-TW) 時
    if (tracks[0].x < -TW) {
        tracks.shift(); // 移除最左邊的跑道
        score++;        // 玩家往前進 1 公尺，分數 +1
        
        let nextType;
        let lastTrack = tracks[tracks.length - 1];
        
        // 防呆機制：若前一段跑道已經有障礙物，下一段強制生成「空白跑道」，避免連續障礙無法跳過
        if (lastTrack.data.name !== "empty") {
            nextType = trackTypes[0]; 
        } else {
            // 30% 機率生成障礙物 (1~3 隨機)，70% 機率生成空白跑道
            nextType = (Math.random() > 0.7) ? 
                trackTypes[Math.floor(Math.random() * 3) + 1] : trackTypes[0];
        }
        // 將新生成的跑道推入陣列最右側
        tracks.push({ x: tracks[tracks.length-1].x + TW, data: nextType, passed: false });
    }

    // 渲染最新畫面並繼續下一幀的循環
    draw();
    frameCounter++; // 累加動畫幀計數（僅在遊戲進行中增加）
    requestAnimationFrame(update);
}

// ==========================================
// 3. 繪圖邏輯（Canvas 渲染）
// ==========================================

function draw() {
    // 清空畫布，準備繪製新畫面
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // --- A. 左上角遊戲資訊 UI 面板 ---
    ctx.fillStyle = "rgba(61, 122, 129, 0.8)"; // 半透明藍綠色背景
    ctx.beginPath();
    ctx.roundRect(10, 10, 140, 100, 10);      // 繪製圓角矩形
    ctx.fill();
    ctx.strokeStyle = "#dbdab4";               // 邊框顏色
    ctx.lineWidth = 3;
    ctx.stroke();

    // 繪製 UI 文字 (距離與跨越次數)
    ctx.fillStyle = "#fff";
    ctx.textAlign = "left";
    ctx.font = "bold 16px Arial";
    ctx.fillText(`距離: ${score} m`, 25, 45);
    ctx.fillText(`跨越: ${hurdleCount} 次`, 25, 80);

    // --- B. 繪製滾動跑道與障礙物 ---
    tracks.forEach(t => {
        // 從 bgImg 的指定裁切坐標 (sx, sy, sw, sh) 繪製到畫布的對應位置 (t.x, 380, 寬 TW, 高 180)
        ctx.drawImage(bgImg, t.data.sx, t.data.sy, t.data.sw, t.data.sh, t.x, 380, TW, 180);
    });

    // --- C. 繪製角色動作 ---
    let frame;
    let xOffset = 0;  // 修正跌倒時圖片的 X 軸偏移
    let yOffset = 80; // 修正跑步時圖片的 Y 軸偏移

    if (player.isTripped && player.tripType) {
        // 狀況一：若被絆倒，使用對應的跌倒影格
        frame = player.fallFrames[player.tripType]; 
        yOffset = 80;  
        xOffset = 80;  
    } else { 
        // 狀況二：正常跑步，每 8 幀切換一次動作影格 (動態輪播 runFrames)
        let fIdx = Math.floor(frameCounter / 8) % player.runFrames.length; 
        frame = player.runFrames[fIdx]; 
    }

    // 將處理好的角色影格繪製到畫布上
    ctx.drawImage(runnerImg, frame.sx, frame.sy, frame.sw, frame.sh, 
                  player.x + xOffset, player.y + yOffset, player.width, player.height);

    // --- D. Canvas 內建結算視窗 (當 isGameOver 成立時疊加顯示) ---
    if (isGameOver) {
        // 黑色半透明遮罩背景
        ctx.fillStyle = "rgba(0, 0, 0, 0.5)"; 
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 結算浮動視窗尺寸與置中坐標計算
        const boxW = 320;
        const boxH = 220;
        const boxX = (canvas.width - boxW) / 2;
        const boxY = (canvas.height - boxH) / 2;
        
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxW, boxH, 20); 
        ctx.fillStyle = "#dbdab4"; // 視窗底色
        ctx.fill();
        ctx.lineWidth = 10;
        // 根據成功或失敗，給予綠色或紅色的邊框
        ctx.strokeStyle = player.isSuccess ? "#27ae60" : "#c0392b"; 
        ctx.stroke();

        // 繪製結算標題文字
        ctx.textAlign = "center";
        ctx.font = "bold 30px Arial";
        if (player.isSuccess) {
            ctx.fillStyle = "#27ae60";
            ctx.fillText("挑戰成功！", canvas.width / 2, boxY + 60);
        } else {
            ctx.fillStyle = "#c0392b";
            ctx.fillText("挑戰失敗...", canvas.width / 2, boxY + 60);
        }

        // 繪製結算數據
        ctx.fillStyle = "#000";
        ctx.font = "20px Arial";
        ctx.fillText(`最終距離: ${score} m`, canvas.width / 2, boxY + 95);
        ctx.fillText(`跨越次數: ${hurdleCount} 次`, canvas.width / 2, boxY + 130);
        
        // 倒數提示
        ctx.font = "14px Arial";
        ctx.fillStyle = "#555";
        ctx.fillText("3 秒後自動返回校園...", canvas.width / 2, boxY + 195);
    }
}

// ==========================================
// 4. 事件監聽與 UI 互動
// ==========================================

// 監聽鍵盤按下事件
window.addEventListener("keydown", e => {
    // 觸發條件：按下空白鍵、當前不在跳躍中、沒有被絆倒、遊戲未結束且已開始
    if (e.code === "Space" && !player.isJumping && !player.isTripped && !isGameOver && isGameStarted) {
        player.dy = -player.jumpForce; // 給予向上的初速度
        player.isJumping = true;       // 設定跳躍狀態為 true
        e.preventDefault();            // 阻止網頁因為空白鍵而捲動
    }
});

/**
 * 開始遊戲按鈕觸發函式
 */
function startTrackGame() {
    const overlay = document.getElementById('intro-overlay');
    const endOverlay = document.getElementById('end-overlay');
    
    // 隱藏 HTML 的遊戲說明與結束畫面疊加層
    if (overlay) overlay.style.display = 'none';
    if (endOverlay) {
        endOverlay.classList.add('hidden');
        endOverlay.style.display = 'none';
    }
    
    isGameStarted = true;      // 變更遊戲狀態為已開始
    requestAnimationFrame(update); // 開啟遊戲主迴圈
}

/**
 * 更新並顯示 HTML 版本的結算畫面（配合網頁 DOM UI）
 * @param {boolean} success - 遊戲結果
 */
function showEndOverlay(success) {
    const endOverlay = document.getElementById('end-overlay');
    const endTitle = document.getElementById('end-title');
    const endDesc = document.getElementById('end-desc');
    const endScore = document.getElementById('end-score');

    if (endOverlay) {
        endOverlay.classList.remove('hidden');
        endOverlay.style.display = 'flex';
    }
    if (endTitle) {
        endTitle.innerText = success ? '挑戰成功！' : '挑戰失敗...';
        endTitle.style.color = success ? '#7dff7d' : '#ff7979';
    }
    if (endDesc) {
        endDesc.innerText = success
            ? '恭喜你成功完成 50 公尺跨欄挑戰！'
            : '你不小心被障礙物絆倒，下一次再試試看。';
    }
    if (endScore) {
        endScore.innerHTML = `最終距離：${score} m<br>跨越次數：${hurdleCount} 次`;
    }
}

// 綁定開始按鈕的點擊事件
const startButton = document.getElementById('start-button');
if (startButton) startButton.addEventListener('click', startTrackGame);

// --- 圖片預載入檢查機制 ---
let loaded = 0;
function onLoaded() {
    loaded++;
    // 確保背景圖與人物圖兩張都載入完成後，才觸發第一次 update() 繪製初始畫面
    if (loaded === 2) update();
}
bgImg.onload = onLoaded;
runnerImg.onload = onLoaded;