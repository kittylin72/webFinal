const canvas = document.getElementById('minigameCanvas');
const ctx = canvas.getContext('2d');

const assets = {
    bg: new Image(),
    tugOfWar: new Image()
};

let gameActive = false;
let timeLeft = 10.0;
let positionX = 400; // 角色中心點

// --- 遊戲平衡參數 ---
const winBound = 220;   // 往左拉過這條線就贏
const loseBound = 580;  // 往右拉過這條線就輸
const pullPower = 20;   // 玩家按一下空白鍵的拉力
const driftSpeed = 1; // 室友自動往右拉的速度

// --- 資源載入邏輯 ---
let loadedCount = 0;
function checkLoad() {
    loadedCount++;
    if (loadedCount === 2) draw();
}

assets.bg.onload = checkLoad;
assets.bg.src = 'images/dorm.jpg';

// --- 在程式內直接去背的邏輯 ---
const rawRoommates = new Image();
rawRoommates.src = 'images/roommates.png'; 

rawRoommates.onload = () => {
    // 建立臨時畫布進行像素處理
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = rawRoommates.width;
    tempCanvas.height = rawRoommates.height;
    tempCtx.drawImage(rawRoommates, 0, 0);

    const imgData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    const data = imgData.data;

    // 掃描並移除白色背景 (r, g, b > 240 視為白色)
    for (let i = 0; i < data.length; i += 4) {
        if (data[i] > 240 && data[i + 1] > 240 && data[i + 2] > 240) {
            data[i + 3] = 0; // 透明度設為 0
        }
    }

    tempCtx.putImageData(imgData, 0, 0);
    assets.tugOfWar.src = tempCanvas.toDataURL();
    assets.tugOfWar.onload = checkLoad;
};

// --- 主繪製循環 ---
function draw() {
    ctx.clearRect(0, 0, 800, 600);

    // 1. 畫背景
    if (assets.bg.complete) {
        ctx.drawImage(assets.bg, 0, 0, 800, 600);
    }

    // 2. 畫基準線
    drawGuidelines();

    // 3. 畫去背後的角色
    if (assets.tugOfWar.complete) {
        const imgW = 450;
        const imgH = 250;
        // 調整 y 座標為 320 讓他們看起來在房間中間
        ctx.drawImage(assets.tugOfWar, positionX - imgW/2, 320, imgW, imgH);
    }

    // 4. 遊戲運行邏輯
    if (gameActive) {
        updateGame();
        drawUI();
    }

    requestAnimationFrame(draw);
}

function drawGuidelines() {
    ctx.save();
    ctx.lineWidth = 4;
    ctx.setLineDash([10, 5]);

    // 玩家勝利基準線 (綠)
    ctx.strokeStyle = "#2ecc71";
    ctx.beginPath();
    ctx.moveTo(winBound, 280); ctx.lineTo(winBound, 550);
    ctx.stroke();

    // 室友勝利基準線 (紅)
    ctx.strokeStyle = "#e74c3c";
    ctx.beginPath();
    ctx.moveTo(loseBound, 280); ctx.lineTo(loseBound, 550);
    ctx.stroke();

    ctx.restore();

    ctx.font = "bold 18px 微軟正黑體";
    ctx.fillStyle = "#2ecc71";
    ctx.fillText("妳的床位", winBound - 85, 275);
    ctx.fillStyle = "#e74c3c";
    ctx.fillText("室友領地", loseBound + 10, 275);
}

function updateGame() {
    timeLeft -= 0.016; 
    positionX += driftSpeed; 

    // 依照規範，將狀態字串改為 "fail" 與 "success"
    if (timeLeft <= 0) endGame("fail");
    if (positionX <= winBound) endGame("success");
    if (positionX >= loseBound) endGame("fail");
}

function drawUI() {
    // 倒數計時 UI
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.beginPath();
    ctx.roundRect(335, 20, 130, 60, 10);
    ctx.fill();

    ctx.fillStyle = timeLeft < 3 ? "#ff4d4d" : "#f1c40f";
    ctx.font = "bold 40px Arial";
    ctx.textAlign = "center";
    ctx.fillText(Math.max(0, timeLeft).toFixed(1), 400, 65);
    ctx.restore();

    // 底部提示
    ctx.fillStyle = "white";
    ctx.font = "bold 22px 微軟正黑體";
    ctx.textAlign = "center";
    ctx.shadowColor = "black";
    ctx.shadowBlur = 4;
    ctx.fillText("快連按 [空白鍵] 把棉被拉回來！", 400, 575);
}

// --- 遊戲控制 ---
function startGame() {
    const overlay = document.getElementById('ui-overlay');
    if (overlay) overlay.style.display = 'none';
    positionX = 400; 
    timeLeft = 10.0;
    gameActive = true;
}

window.addEventListener('keydown', (e) => {
    if (gameActive && e.code === 'Space') {
        e.preventDefault();
        positionX -= pullPower; 
    }
});

function endGame(status) {
    gameActive = false;
    const overlay = document.getElementById('ui-overlay');
    const title = document.getElementById('msg-title');
    const text = document.getElementById('msg-text');
    
    if (overlay) {
        overlay.style.display = 'flex';
        // 這裡配合新的 status 參數做文字判斷
        title.innerText = status === "success" ? "妳贏了！" : "被凍死啦！";
        text.innerText = status === "success" ? "妳成功保住了溫暖的夜晚。" : "室友力氣太大，妳只能縮在床角發抖...";
    }
    const startButton = document.getElementById('start-button');
    if (startButton) startButton.style.display = 'none';

    // 新增：延遲 1.5 秒讓玩家看清輸贏畫面後，透過 postMessage 傳給父視窗 (main.js)
    setTimeout(() => {
        window.parent.postMessage({
            type: 'GAME_RESULT', // 規範要求的固定型態
            status: status,      // 傳回 "success" 或 "fail"
            score: status === "success" ? 100 : 0, // 選填的分數
            detail: status === "success" ? "成功完成宿舍搶棉被爭奪戰" : "搶棉被大戰失敗" // 選填的詳細說明
        }, '*');
    }, 1500);
}