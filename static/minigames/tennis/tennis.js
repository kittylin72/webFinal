// ==========================================
// 1. 初始化 Canvas 畫布與繪圖環境 (Context)
// ==========================================
// 取得 HTML 中的 <canvas> 元素，用來繪製遊戲畫面
const canvas = document.getElementById('gameCanvas');
// 取得 2D 繪圖上下文 (Context)，之後所有畫線、畫圖、寫字都靠這個 ctx 物件
const ctx = canvas.getContext('2d');

// ==========================================
// 2. 載入遊戲所需圖片資源 (非同步載入)
// ==========================================
const bgImage = new Image(); bgImage.src = '/static/minigames/tennis/tennisCourt.png';
const playerImage = new Image(); playerImage.src = '/static/minigames/tennis/player.png';
const computerImage = new Image(); computerImage.src = '/static/minigames/tennis/computer.png';
const winImage = new Image(); winImage.src = '/static/minigames/tennis/win.png';
const loseImage = new Image(); loseImage.src = '/static/minigames/tennis/lose.png';

// ==========================================
// 3. 遊戲物件與物理參數設定
// ==========================================
// 儲存玩家與電腦的初始座標常數 (p = Player, c = Computer)
const POS = { pX: 160, pY: 300, cX: 760, cY: 300 };

// 玩家物件：x, y 為左上角座標，w, h 為球拍/角色的寬度與高度
let player = { x: POS.pX, y: POS.pY, w: 80, h: 100 };
// 電腦物件：規格與玩家相同
let computer = { x: POS.cX, y: POS.cY, w: 80, h: 100 };

// 球的水平移動速度常數（每幀移動 5 個像素）
const CONST_SPEED_X = 5;
const AI_DIFFICULTY = {
    ySpeed: 2.0,          // 電腦垂直追球速度
    xSpeedApproach: 2.0,  // 電腦靠球時的橫向移動速度
    xSpeedRetreat: 1.5, // 電腦回防時的橫向移動速度
    reactionMargin: 38, // 電腦對 Y 軸位置的容差
    //mistakeChance: 0.8 // 電腦出錯(不用心追球)機率
};
// 球物件：x, y 為球心座標，dx, dy 為 X 與 Y 軸的移動速度，size 為球的直徑
let ball = { x: 0, y: 0, dx: CONST_SPEED_X, dy: 0, size: 16 };

// ==========================================
// 4. 遊戲狀態與規則變數
// ==========================================
let isServing = true;       // 狀態鎖：目前是否處於「發球狀態」
let server = "player";      // 字串：紀錄當前由誰發球 ("player" 或 "computer")
let gameOver = false;       // 布林值：遊戲是否結束
let winner = "";            // 字串：紀錄贏家是誰
let scorePlayer = 0;        // 數字：玩家目前得分
let scoreComputer = 0;      // 數字：電腦目前得分
const WINNING_SCORE = 3;   // 常數：先得到 3 分的人獲勝
let isGameStarted = false; // 是否已按開始鍵進入遊戲

// 鍵盤監聽狀態字典：用來紀錄哪些按鍵正在被按下 (例如 keys['ArrowUp'] = true)
const keys = {};

// 遊戲邊界範圍限制 (根據網球場背景圖的線條範圍設定)
const BOUNDS = { 
    top: 170,        // 球場上邊界 Y 軸
    bottom: 500,     // 球場下邊界 Y 軸
    left: 120,       // 球場左邊界 X 軸 (出界線)
    right: 880,      // 球場右邊界 X 軸 (出界線)
    netCenter: 500   // 球場球網中心 X 軸 (限制雙方球員不能跨網)
};

// ==========================================
// 5. 遊戲邏輯核心函式
// ==========================================

/**
 * 結束發球狀態，正式讓球飛出去
 */
function startService() {
    isServing = false; // 關閉發球狀態，啟動球的物理更新
    // 讓球的 Y 軸速度隨機產生：Math.random() 產生 0~1 之間的小數
    // (Math.random() - 0.5) 會變成 -0.5 ~ 0.5 之間的小數
    // 乘以 10 之後，dy 速度會落在 -5 到 5 之間，創造發球角度的隨機性
    ball.dy = (Math.random() - 0.5) * 10;
}

/**
 * 重設整場遊戲 (玩家按重新開始或首頁初始化時使用)
 */
function resetGame() {
    scorePlayer = 0; 
    scoreComputer = 0;
    gameOver = false; 
    winner = "";
    resetPositions("player"); // 預設由玩家先發球
}

function startGame() {
    if (isGameStarted) return;
    isGameStarted = true;
    const overlay = document.getElementById('ui-overlay');
    if (overlay) overlay.style.display = 'none';
    resetPositions('player');
}

/**
 * 當有人得分時，重設角色位置與發球狀態
 * @param {string} newServer - 下一球由誰發球 ("player" 或 "computer")
 */
function resetPositions(newServer) {
    // 將玩家與電腦拉回各自的初始據點
    player.x = POS.pX; 
    player.y = POS.pY;
    computer.x = POS.cX; 
    computer.y = POS.cY;

    server = newServer;  // 設定新的發球者
    isServing = true;    // 恢復發球鎖定狀態
    ball.dy = 0;         // 清空 Y 軸速度，讓球乖乖黏在發球者手上

    // 如果輪到電腦發球，且遊戲還沒結束
    if (server === "computer" && !gameOver) {
        // 設定定時器：延遲 1.5 秒 (1500毫秒) 後自動發球，給玩家反應時間
        setTimeout(() => {
            // 雙重檢查：確保 1.5 秒後狀態沒被其他意外改變
            if (isServing && server === "computer") {
                startService();
            }
        }, 1500);
    }
}

/**
 * 處理比賽結束（當有人達到 3 分時）
 * @param {string} finalWinner - 最終獲勝者 ("player" 或 "computer")
 */
function handleMatchEnd(finalWinner) {
    gameOver = true;       // 標記遊戲結束，停止運算
    winner = finalWinner;  // 寫入贏家

    // 判斷傳回給外層網頁 (main.js) 的狀態字串
    const resultStatus = (finalWinner === "player") ? "success" : "fail";

    // 留個 2 秒 (2000毫秒) 的緩衝時間
    // 目的：讓玩家畫面更新，看清楚最後的得分，再把資料傳出去
    setTimeout(() => {
        // 使用 HTML5 postMessage API，將遊戲結果安全地傳送給父層視窗 (Iframe 外層)
        window.parent.postMessage({
            type: 'GAME_RESULT',
            status: resultStatus,
            score: scorePlayer * 10, // 將得分乘以 10 作為最終遊戲積分
            detail: `網球場挑戰結束！玩家得分：${scorePlayer}`
        }, '*'); // '*' 表示不限制接收來源網域
    }, 2000);
}

// ==========================================
// 6. 遊戲物理與位置更新 (每一幀執行一次)
// ==========================================
function update() {
    if (!isGameStarted || gameOver) return; // 還沒按開始或已結束時不更新數據

    const moveSpeed = 7; // 玩家球拍的移動速度 (每幀移動 7 像素)

    // --- A. 非發球狀態下的「人物移動」控制 ---
    if (!isServing) {
        // 玩家鍵盤操作 (檢查 keys 字典中對應的 Code 是否為 true)
        if (keys['ArrowUp'] && player.y > BOUNDS.top)
            player.y -= moveSpeed; // 往上移 (Y軸減少)

        if (keys['ArrowDown'] && player.y < BOUNDS.bottom - player.h)
            player.y += moveSpeed; // 往下移 (Y軸增加，需扣除自身高度避免屁股出界)

        if (keys['ArrowLeft'] && player.x > BOUNDS.left)
            player.x -= moveSpeed; // 往左移 (X軸減少)

        if (keys['ArrowRight'] && player.x < BOUNDS.netCenter - player.w)
            player.x += moveSpeed; // 往右移 (X軸增加，限制不能超越中央球網)

        // --- B. 電腦 AI 智慧移動演算法 ---
        // 計算電腦球拍的 Y 軸中心點
        const compCenterY = computer.y + computer.h / 2;

        // Y 軸追蹤：如果電腦中心比球高，就往下移；反之往上移
        // 使用較大的容差與較慢速度，讓電腦反應比較慢
        if (compCenterY < ball.y - AI_DIFFICULTY.reactionMargin)
            computer.y += AI_DIFFICULTY.ySpeed;
        else if (compCenterY > ball.y + AI_DIFFICULTY.reactionMargin)
            computer.y -= AI_DIFFICULTY.ySpeed;

        // 增加隨機失誤機率：有時候電腦不會更積極追球
        //if (ball.dx > 0 && Math.random() < AI_DIFFICULTY.mistakeChance) {
            // 偶爾不移動或者只做非常小幅度修正
            //if (computer.x > BOUNDS.netCenter + 10 && Math.random() < 0.5)
                //computer.x -= 1;
        //}

        // X 軸防守/回位策略：
        if (ball.dx > 0) {
            // 如果球正在往右飛（朝向電腦）
            let targetX = ball.x + ball.size + 10; // 預測攔截點為球的前方

            // 限制電腦最左隻能跑到球網邊
            if (targetX < BOUNDS.netCenter)
                targetX = BOUNDS.netCenter;

            // 根據預測點調整電腦 X 軸，往球的方向靠攏
            if (computer.x > targetX + 10)
                computer.x -= AI_DIFFICULTY.xSpeedApproach;
            else if (computer.x < targetX - 10)
                computer.x += AI_DIFFICULTY.xSpeedApproach;
        } else {
            // 如果球是往左飛（離電腦越來越遠），電腦啟動「回防中央機制」
            const readyX = 700; // 理想的防守待命 X 座標
            if (computer.x > readyX)
                computer.x -= AI_DIFFICULTY.xSpeedRetreat;
            else if (computer.x < readyX - 20)
                computer.x += AI_DIFFICULTY.xSpeedRetreat;
        }
    }

    // 強制硬性限制：防止電腦因為物理計算誤差超越球網或邊界
    if (computer.x < BOUNDS.netCenter) computer.x = BOUNDS.netCenter;
    if (computer.x > BOUNDS.right - computer.w) computer.x = BOUNDS.right - computer.w;

    // --- C. 發球狀態下的「球體黏滯」控制 ---
    if (isServing) {
        if (server === "player") {
            // 球黏在玩家球拍的前端偏上方
            ball.x = player.x + player.w - 5;
            ball.y = player.y + player.h / 3;
            ball.dx = CONST_SPEED_X; // 預設發球方向朝右
        } else {
            // 球黏在電腦球拍的前端偏上方
            ball.x = computer.x - 5;
            ball.y = computer.y + computer.h / 3;
            ball.dx = -CONST_SPEED_X; // 預設發球方向朝左
        }
    } else {
        // --- D. 正常比賽中的「球體物理運動與碰撞偵測」 ---
        ball.x += ball.dx; // 球水平移動
        ball.y += ball.dy; // 球垂直移動

        // 牆壁碰撞：當球撞到球場的上邊界或下邊界時
        if (ball.y <= BOUNDS.top || ball.y >= BOUNDS.bottom)
            ball.dy *= -1; // Y 軸速度反轉 (正變負、負變正)，形成彈跳效果

        // 玩家球拍碰撞偵測 (標準 AABB 矩形碰撞演算法)
        if (
            ball.dx < 0 && // 球必須是往左飛，才會撞到玩家
            ball.x < player.x + player.w &&
            ball.x + ball.size > player.x &&
            ball.y < player.y + player.h &&
            ball.y + ball.size > player.y
        ) {
            ball.dx = CONST_SPEED_X; // X 軸反彈往右
            // 【核心公式】：根據球打中球拍的相對位置，決定反彈的 Y 軸角度
            // (球的Y軸 - 球拍中心點Y軸) * 0.25 = 越打到邊緣，噴得越斜
            ball.dy = (ball.y - (player.y + player.h / 2)) * 0.25;
            ball.x = player.x + player.w + 1; // 修正位置，防止連續碰撞卡住
        }

        // 電腦球拍碰撞偵測
        if (
            ball.dx > 0 && // 球必須是往右飛，才會撞到電腦
            ball.x + ball.size > computer.x &&
            ball.x < computer.x + computer.w &&
            ball.y < computer.y + computer.h &&
            ball.y + ball.size > computer.y
        ) {
            ball.dx = -CONST_SPEED_X; // X 軸反彈往左
            // 相同的擊球角度切向公式
            ball.dy = (ball.y - (computer.y + computer.h / 2)) * 0.25;
            ball.x = computer.x - ball.size - 1; // 修正位置
        }

        // --- E. 得分與出界判斷 ---
        // 球飛過左出界線 (電腦得分)
        if (ball.x < BOUNDS.left - 50) {
            scoreComputer++;
            if (scoreComputer >= WINNING_SCORE) {
                handleMatchEnd("computer"); // 達到 3 分，觸發結束
            } else {
                resetPositions("computer"); // 沒到 3 分，下一球由電腦發球
            }
        // 球飛過右出界線 (玩家得分)
        } else if (ball.x > BOUNDS.right + 50) {
            scorePlayer++;
            if (scorePlayer >= WINNING_SCORE) {
                handleMatchEnd("player");   // 達到 3 分，觸發結束
            } else {
                resetPositions("player");   // 沒到 3 分，下一球由玩家發球
            }
        }
    }
}

// ==========================================
// 7. 畫面繪製渲染 (每一幀執行一次)
// ==========================================
function draw() {
    // 繪製球場背景圖，鋪滿整個畫布大小
    ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);

    // --- A. 繪製計分板區塊 ---
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)"; // 設定黑透半透明背景色
    ctx.fillRect(230, 90, 240, 60);       // 畫出一個矩形黑框

    ctx.fillStyle = "#d4ff00";            // 設定文字顏色 (螢光黃)
    ctx.font = "bold 24px Arial";          // 設定字體大小與樣式
    ctx.textAlign = "left";               // 文字對齊方式：靠左
    ctx.fillText(`玩家: ${scorePlayer}  |  電腦: ${scoreComputer}`, 250, 128); // 渲染文字

    // --- B. 繪製角色與球拍 ---
    ctx.drawImage(playerImage, player.x, player.y, player.w, player.h);
    ctx.drawImage(computerImage, computer.x, computer.y, computer.w, computer.h);

    // --- C. 繪製網球 (使用 Canvas 原生路徑繪製圓形) ---
    ctx.fillStyle = '#d4ff00';  // 網球螢光綠
    ctx.beginPath();            // 開始一條新的繪圖路徑
    // arc(圓心X, 圓心Y, 半徑, 起始弧度, 結束弧度(Math.PI*2 代表 360 度))
    ctx.arc(ball.x, ball.y, ball.size / 2, 0, Math.PI * 2);
    ctx.fill();                 // 將圓形內部填滿顏色

    ctx.textAlign = "center";   // 修改文字對齊：改為置中，方便公告提示顯示

    // --- D. 遊戲結束畫面覆蓋 ---
    if (gameOver) {
        if (winner === "player") {
            ctx.drawImage(winImage, 0, 0, canvas.width, canvas.height); // 畫玩家贏的圖
        } else {
            ctx.drawImage(loseImage, 0, 0, canvas.width, canvas.height); // 畫電腦贏的圖
        }
    // --- E. 發球狀態提示框 ---
    } else if (isServing) {
        ctx.fillStyle = "rgba(0,0,0,0.7)"; // 更黑一點的半透明背景
        ctx.fillRect(400 - 180, 25, 360, 45); // 置中繪製提示底框

        ctx.fillStyle = "#fff"; // 白色字
        ctx.font = "bold 18px Arial";

        // 根據是誰發球切換不同的提示文字
        let msg = server === "player"
            ? "準備發球 - 按空白鍵"
            : "電腦發球中... 準備接球";

        ctx.fillText(msg, 400, 55); // 在畫布中央 (X=400) 寫出提示
    }
}

// ==========================================
// 8. 遊戲主要控制迴圈 (Game Loop)
// ==========================================
function loop() {
    update(); // 先計算所有物體的新位置與碰撞
    draw();   // 再把最新結果畫到螢幕上
    // 關鍵：請求瀏覽器在下一次螢幕重新整理時，再次呼叫 loop 函式，形成無限循環
    requestAnimationFrame(loop);
}

// ==========================================
// 9. 非同步資源防錯機制 (確保圖片全載入才開局)
// ==========================================
let loadCount = 0;       // 已經載入完成的圖片計數器
const totalImages = 5;   // 總共有 5 張圖

/**
 * 每張圖片載入成功(onload)時都會呼叫這個 function
 */
const checkAllLoaded = () => {
    // 先把計數器 +1，再檢查有沒有等於總數 5
    if (++loadCount === totalImages)
        loop(); // 當 5 張圖都齊了，正式啟動遊戲迴圈！
};

// 綁定所有圖片的 onload 載入完成監聽事件
bgImage.onload = checkAllLoaded;
playerImage.onload = checkAllLoaded;
computerImage.onload = checkAllLoaded;
winImage.onload = checkAllLoaded;
loseImage.onload = checkAllLoaded;

// ==========================================
// 10. 鍵盤事件監聽器 (阻止瀏覽器預設行為)
// ==========================================
window.addEventListener('keydown', e => {
    // 老師重點：阻擋空白鍵與方向鍵的網頁預設滾動行為
    // 如果不加這段，玩家在玩遊戲按上下鍵時，整個網頁的捲軸會跟著上下晃動
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault(); // 攔截並取消瀏覽器的預設反應
    }

    keys[e.code] = true; // 在字典中把該按鍵標記為 true (代表正被按下)
    
    // 如果按下的是空白鍵
    if (e.code === 'Space') {
        // 如果遊戲還沒開始則不允許發球
        if (isGameStarted && !gameOver && isServing && server === "player") {
            startService();
        }
    }
});

window.addEventListener('keyup', e => {
    // 釋放按鍵時同樣阻擋預設滾動
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
    }
    keys[e.code] = false; // 在字典中把該按鍵還原為 false (代表手指放開了)
});

bgImage.onerror = () => console.error('載入失敗:', bgImage.src);
playerImage.onerror = () => console.error('載入失敗:', playerImage.src);
computerImage.onerror = () => console.error('載入失敗:', computerImage.src);
winImage.onerror = () => console.error('載入失敗:', winImage.src);
loseImage.onerror = () => console.error('載入失敗:', loseImage.src);