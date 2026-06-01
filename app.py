from flask import Flask, request, jsonify, render_template
import os
from google import genai
from datetime import datetime

app = Flask(__name__)

# 初始化 Gemini 客戶端（請記得把你的 API KEY 貼在這裡）
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "AIzaSyCciUTddY3OyRJwYGmbPPiTvg5ZBnuMmN8")
client = genai.Client(api_key=GEMINI_API_KEY)

# 傳入參數：character_name(角色名稱), stats(五大分數字典), outcome_title(結局標題)
def generate_llm_commentary(character_name, stats, outcome_title):
    try:
        model_id = "gemini-2.5-flash"
        
        prompt = f"""
        你是一位在元智大學（YZU）執教多年、說話有點幽默、犀利但內心很關心學生的資深教授。
        現在學期結束了，請針對以下學生的期末狀態，寫一段 100 字以內、一針見血的客製化導師評語。
        
        學生背景：
        - 選擇角色：{character_name}
        - 最終結局：{outcome_title}
        
        期末各項數值（滿分 100）：
        - ⚡ 體力：{stats.get('stamina', 0)}
        - 🧠 知識：{stats.get('knowledge', 0)}
        - 💪 體能：{stats.get('fitness', 0)}
        - ❤️ 魅力：{stats.get('romance', 0)}
        - 🎮 娛樂：{stats.get('fun', 0)}
        
        寫作要求：
        1. 開頭要符合「元智大學教授」的口吻（可以幽默提及元智的校園生活、麵包節、遠東大樓、或爆肝生態）。
        2. 內容要酸甜適中，精準吐嘈或讚美他為什麼會拿到這個數值和特定的結局。
        3. 字數絕對不要超過 120 字，直接輸出一段通順的評語，不要條列式。
        """
        # 正式呼叫 Gemini API，傳入指定的模型名稱與剛剛寫好的 Prompt 全文
        response = client.models.generate_content(
            model=model_id,
            contents=prompt,
        )
        return response.text
        
    except Exception as e:
        print("Gemini API 呼召失敗:", str(e))
        # 回傳一段我們預設好的幽默文字給前端，確保網頁不會因為 AI 掛掉而整頁崩潰（高可用性容錯）
        return f"【導師辦公室通知】教授開會去了（API失效）。看你身為{character_name}拿到{outcome_title}，下學期再加油吧！"

@app.route('/')
def index():
    # 讓 Flask 去 templates 資料夾尋找 index.html 並渲染回傳給瀏覽器
    return render_template('index.html')

@app.route('/result')
def result_page():
    # 讓 Flask 去 templates 資料夾尋找 result.html 並渲染回傳給瀏覽器
    return render_template('result.html')

@app.route('/api/game_over', methods=['POST'])
def game_over():
    try:
        data = request.get_json() or {}
        stats = data.get('stats', {})
        char_type = data.get('character', 'nerd')
        
        char_names = { 'nerd': "書呆子", 'athlete': "運動健將", 'player': "玩咖" }
        character_name = char_names.get(char_type, "冒險者")
        
        # 抓取當前的遊玩日期與時間
        now = datetime.now()
        current_date = now.strftime("%Y年%m月%d日")
        current_time = now.strftime("%H時%M分%S秒")
        
        outcome_title = ""
        outcome_desc = ""

        # ==========================================================
        # 🌟 精準修正：結局數值判定邏輯 🌟
        # ==========================================================
        
        # 💡 這裡設定各項屬性要「卓越/達標」的門檻分數（先暫定為 80 分，你可以隨時改這個數字）
        TARGET_SCORE = 80

        # 【第一順位】檢查體力：如果體力歸零，直接強制送醫
        if stats.get('stamina', 0) <= 0:
            outcome_title = "「倒地不起的爆肝研究生」"
            outcome_desc = "你的體力徹底歸零！這學期還沒結束，你就因為過度操勞在二館大樓前倒下，被路過的同學抬進了醫院。命只有一條，課業再重也要睡覺啊！"
        
        # 【第二順位】檢查是否為「都沒達標的平庸之人」
        # 只要 知識、體能、魅力、娛樂「每一項都低於門檻(80分)」，就是平庸之人！
        elif (stats.get('knowledge', 0) < TARGET_SCORE and 
              stats.get('fitness', 0) < TARGET_SCORE and 
              stats.get('romance', 0) < TARGET_SCORE and 
              stats.get('fun', 0) < TARGET_SCORE):
            
            outcome_title = "「平凡過路人！無風無雨的大學生」"
            outcome_desc = "這學期你過得非常中規中矩。沒有哪一項特別出彩，但也沒有哪一項特別糟糕，完美演繹了什麼叫『沒消息就是好消息』。平庸地混完了這學期，平凡就是福！"
        
        # 【第三順位】既然不是送醫，也不是平庸之人，代表「至少有一項破了80分」！這時我們取最高的那一項
        else:
            # 建立一個過濾過的字典，只放入要用來比大小的四個主屬性分數
            comparison_stats = {
                'knowledge': stats.get('knowledge', 0),
                'fitness': stats.get('fitness', 0),
                'romance': stats.get('romance', 0),
                'fun': stats.get('fun', 0)
            }
            
            # 抓出最高分的屬性名稱
            # key=comparison_stats.get 代表「不要比 key 的英文字母大小，而是去比它們對應的數值（Value）大小」
            highest_stat = max(comparison_stats, key=comparison_stats.get)
            
            if highest_stat == 'knowledge':
                outcome_title = "「榮獲書卷獎的學霸神人」"
                outcome_desc = "你的知識量在期末達到顛峰！當大家還在求歐過的時候，你已經以第一名的姿態拿下了書卷獎，教授看你的眼神都在發光！"
                
            elif highest_stat == 'fitness':
                outcome_title = "「全大運奪冠的校園運動明星」"
                outcome_desc = "你的體能強悍到不可思議！代表學校出戰全大運直接勇奪冠軍，全校的體育館牆上都貼著你的奪冠海報，帥慘了！"
                
            elif highest_stat == 'romance':
                outcome_title = "「《單身即地獄》節目組瘋狂邀請的萬人迷」"
                outcome_desc = "你的魅力值徹底爆表！走在元智校園裡回頭率 200%，連知名戀愛實境節目《單身即地獄》的製作人都親自發私訊邀請你上節目！"
                
            elif highest_stat == 'fun':
                outcome_title = "「學分不夠、慘遭延畢的社團大玩咖」"
                outcome_desc = "這學期你玩得太瘋、夜唱太多，雖然成了朋友眼中的氣氛大師，但打開成績單一看——完蛋，學分不夠，你只能留下來含淚延畢了。"

        # ==========================================================

        # 呼叫真實 AI 撰寫評語
        llm_comment = generate_llm_commentary(character_name, stats, outcome_title)
        

        # 使用 jsonify() 將後端所有的變數與計算結果，打包序列化成一個標準的 JSON 格式包裹
        # 這包輕量級的 JSON 會回傳給前端的 main.js，供前端讀取並渲染成 Plotly 輻射圖
        return jsonify({
            'stats': stats,
            'character_name': character_name,
            'title': outcome_title,
            'description': outcome_desc,
            'commentary': llm_comment,
            'play_date': current_date,
            'play_time': current_time
        })
    except Exception as e:
        print("後端崩潰:", str(e))
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host="0.0.0.0", port=10000)