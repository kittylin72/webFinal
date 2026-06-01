let correctCount = 0; // 記錄答對題數
let currentQuestion = 0; // 記錄目前題目編號
let timer = null;// 儲存計時器
let timeLeft = 3;// 每題倒數秒數

// 題庫設定
const allQuestions = [
    { q: "1+1=?", options: ["1","2","3","4"], answer: 1 },
    { q: "2+3=?", options: ["4","5","6","7"], answer: 1 },
    { q: "5-2=?", options: ["2","3","4","5"], answer: 1 },
    { q: "14x13=？", options: ["132","182","152","192"], answer: 1 },
    { q: "CSS用途？", options: ["運算","排版","邏輯","資料"], answer: 1 },
    { q: "JS是？", options: ["Java","JavaScript","Python","C"], answer: 1 },
    { q: "3x3=?", options: ["6","7","8","9"], answer: 3 },
    { q: "10/2=?", options: ["2","3","4","5"], answer: 3 },
    { q: "電腦大腦是？", options: ["滑鼠","CPU","螢幕","鍵盤"], answer: 1 },
    { q: "RAM是？", options: ["記憶體","硬碟","顯卡","電源"], answer: 0 }
];

let questions = [];// 存放本次遊戲抽出的題目

function startQuizGame() {
    const intro = document.getElementById('intro-overlay');// 取得開始遮罩畫面
    const overlayBox = document.getElementById('overlay-box');// 取得訊息框
    const overlayButton = document.getElementById('overlay-button');// 取得開始按鈕
    if (intro) intro.style.display = 'none';// 隱藏開始畫面
    if (overlayBox) { // 如果訊息框存在
        overlayBox.classList.remove('success', 'failure'); // 清除成功失敗樣式
    }
    if (overlayButton) { // 如果按鈕存在
        overlayButton.style.display = 'inline-block'; // 顯示按鈕
    }

    // 每次隨機抽 5 題
    const shuffled = [...allQuestions].sort(() => Math.random() - 0.5); // 打亂題庫順序
    questions = shuffled.slice(0, 5);// 抽出前5題
    currentQuestion = 0; // 題目重設
    correctCount = 0;// 分數重設
    nextQuestion();// 顯示下一題
}

function nextQuestion() {
    if (currentQuestion >= 5) {// 如果題目超過5題
        endQuiz();// 結束遊戲
        return;// 停止函式
    }

    const q = questions[currentQuestion];// 取得目前題目
    document.getElementById("question").innerText = q.q;// 顯示題目文字
    const choicesDiv = document.getElementById("choices");// 取得選項區塊
    choicesDiv.innerHTML = "";// 清空舊選項

    q.options.forEach((opt, index) => {// 依序建立每個選項按鈕
        const btn = document.createElement("button");// 建立 button 元素
        btn.innerText = opt; //設定按鈕文字
        btn.onclick = () => answerQuestion(index);// 點擊後送出答案
        choicesDiv.appendChild(btn);// 將按鈕加入畫面
    });

    startTimer();// 開始倒數
}

function startTimer() {// 倒數計時函式
    clearInterval(timer);// 清除舊計時器
    timeLeft = 3; // 秒數重設為3秒
    document.getElementById("timer").innerText = "⏳ " + timeLeft;// 更新畫面秒數

    timer = setInterval(() => { // 每1秒執行一次
        timeLeft--;// 秒數減1
        document.getElementById("timer").innerText = "⏳ " + timeLeft; // 更新倒數顯示
        if (timeLeft <= 0) { // 如果時間到
            clearInterval(timer);// 停止計時器
            currentQuestion++;// 題目加1
            nextQuestion(); // 顯示下一題
        }
    }, 1000);// 1000毫秒 = 1秒
}

function answerQuestion(index) {// 玩家回答函式
    clearInterval(timer); // 點擊時立刻清除計時器，防止倒數計時與下一題重疊

    const buttons = document.querySelectorAll("#choices button");// 取得所有選項按鈕
    const correct = questions[currentQuestion].answer;// 取得正確答案編號
    const selectedButton = buttons[index];// 取得玩家點擊的按鈕

    // 顯示回答結果
    if (index === correct) {
        selectedButton.classList.add('correct');// 如果答案正確，加入正確樣式
        correctCount++; // 答對一題
    } else {
        selectedButton.classList.add('wrong');// 加入錯誤樣式
    }

    buttons.forEach(btn => btn.disabled = true); // 鎖定全部按鈕避免重複點擊

    currentQuestion++;// 題號加1
    setTimeout(() => {// 延遲執行
        buttons.forEach(btn => {// 依序處理每個按鈕
            btn.classList.remove('correct', 'wrong');// 清除按鈕樣式
        });
        nextQuestion();// 進入下一題
    }, 400); // 稍微延遲 0.4 秒後進下一題，體驗較流暢
}

function endQuiz() {
    clearInterval(timer);// 停止計時器
    
    // 遵循規範判定：答對 3 題(含)以上視為成功，其餘失敗
    const isSuccess = (correctCount >= 3);//判斷是否為成功

    const overlay = document.getElementById('intro-overlay');// 取得遮罩畫面
    const title = document.getElementById('overlay-title');// 取得標題
    const desc = document.getElementById('overlay-desc');// 取得描述文字
    const button = document.getElementById('overlay-button');// 取得按鈕
    const overlayBox = document.getElementById('overlay-box');// 取得訊息框


    if (overlay) overlay.style.display = 'flex';//顯示結算畫面
    if (title) {// 如果標題存在
        title.innerText = isSuccess ? '成功！你是圖書館大學霸！' : '失敗...再接再厲！';
        title.className = isSuccess ? 'success' : 'failure';// 切換顏色樣式
    }
    if (desc) {// 如果描述存在
        desc.innerText = isSuccess
            ? `答對 ${correctCount} 題，恭喜你通過挑戰！`
            : `只答對 ${correctCount} 題，答案要再加緊練習。`;// 顯示結果描述
    }
    if (button) button.style.display = 'none';// 隱藏開始按鈕
    if (overlayBox) {// 如果訊息框存在
        overlayBox.classList.toggle('success', isSuccess);// 切換成功樣式
        overlayBox.classList.toggle('failure', !isSuccess);// 切換失敗樣式
    }

    setTimeout(() => {// 延遲2秒傳送結果
        window.parent.postMessage({// 傳送資料給主畫面
            type: 'GAME_RESULT',// 訊息類型
            status: isSuccess ? 'success' : 'fail',// 成功或失敗
            score: correctCount * 20, // 換算成百分制分數
            detail: `圖書館問答結束，答對 ${correctCount} 題`  // 詳細資訊
        }, '*');
    }, 2000);// 延遲2秒
}