const express = require('express');
const line = require('@line/bot-sdk');
const axios = require('axios');

// ==========================================
// 🔴 設定區：部署時請將環境變數設定在 Vercel 後台
// ==========================================
const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN || '您的_LINE_ACCESS_TOKEN',
  channelSecret: process.env.CHANNEL_SECRET || '您的_LINE_CHANNEL_SECRET'
};

const client = new line.Client(config);
const app = express();

// ==========================================
// 🧠 核心處理邏輯 (Nexus Valuation Engine)
// ==========================================
app.post('/webhook', line.middleware(config), (req, res) => {
  Promise
    .all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error(err);
      res.status(500).end();
    });
});

async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null);
  }

  const userText = event.message.text.trim();
  
  // 攔截關鍵字：例如「查價 台南市安南區國安街」
  const match = userText.match(/^(?:查價|估價|行情)\s+(.+)$/);
  
  if (match) {
    const address = match[1]; // 提取出地址
    
    // 💡 第一階段：呼叫內政部 API 獲取真實數據
    // 注意：以下為概念性呼叫，實際需依內政部最新 API 文件調整參數與 Header
    let averagePrice = 0;
    let filteredCount = 0;
    let totalCount = 0;
    
    try {
        // 假設的內政部 API 端點 (需替換為真實端點並加入您的 API Key)
        // const apiUrl = `https://openapi.moi.gov.tw/lvr/v1/search?address=${encodeURIComponent(address)}&key=${process.env.MOI_API_KEY}`;
        // const response = await axios.get(apiUrl);
        // const data = response.data;
        
        // --- 模擬 API 回傳與演算過程 ---
        // 實務上您會在這裡撰寫迴圈，剔除 "親友交易" 等特殊註記，並算出平均單價
        // 這裡我們暫時用模擬數據來展示架構
        averagePrice = Math.floor(Math.random() * (40 - 20 + 1)) + 20; // 模擬 20~40 萬/坪
        filteredCount = 2; // 模擬剔除 2 筆
        totalCount = 15;   // 模擬共找到 15 筆
        // ---------------------------------
        
    } catch (error) {
        console.error("內政部 API 呼叫失敗:", error);
        return client.replyMessage(event.replyToken, { type: 'text', text: '抱歉，目前無法連線至內政部實價登錄系統，請稍後再試。' });
    }

    // 💡 第二階段：套用銀行鑑價公式 (使用標準 35 坪 3 房為例)
    const assumedPing = 35;
    const estimatedTotalPrice = averagePrice * assumedPing; // 萬
    const ltv = 0.8; // 預設 8 成
    const estimatedLoan = Math.round(estimatedTotalPrice * ltv);
    const downPayment = estimatedTotalPrice - estimatedLoan;
    
    // 計算所需月收 (假設利率 2.2%，30年期，要求收支比 60%)
    // 簡化 PMT 粗估：貸款 100 萬 30 年約需月繳 3800 元
    const pmtPerMillion = 0.38; // 萬
    const estimatedMonthlyPayment = (estimatedLoan / 100) * pmtPerMillion;
    const requiredIncome = (estimatedMonthlyPayment / 0.6).toFixed(1);

    // 💡 第三階段：產出高階互動卡片 (Flex Message)
    const flexMessage = {
      type: 'flex',
      altText: `【智能鑑價報告】${address}`,
      contents: {
        type: "bubble",
        size: "mega",
        header: {
          type: "box", layout: "vertical", backgroundColor: "#1E293B", paddingAll: "20px",
          contents: [
            { type: "text", text: "宏國地政 | 易丞地政", color: "#ffffff", weight: "bold", size: "sm" },
            { type: "text", text: "Open Data 鑑價引擎 v2.0", color: "#fACC15", size: "xs", margin: "sm" }
          ]
        },
        body: {
          type: "box", layout: "vertical",
          contents: [
            { type: "text", text: "📍 查詢標的", size: "xs", color: "#64748b", weight: "bold" },
            { type: "text", text: address, weight: "bold", size: "xl", margin: "sm", wrap: true },
            { type: "separator", margin: "lg" },
            
            // 內政部數據區塊
            { type: "text", text: "📊 官方實價數據 (內政部連線)", size: "sm", color: "#0F172A", weight: "bold", margin: "lg" },
            {
              type: "box", layout: "horizontal", margin: "md",
              contents: [
                { type: "text", text: "近半年單價", size: "sm", color: "#64748b" },
                { type: "text", text: `約 ${averagePrice} 萬/坪`, size: "sm", color: "#0F172A", weight: "bold", align: "end" }
              ]
            },
            {
              type: "box", layout: "horizontal", margin: "sm",
              contents: [
                { type: "text", text: "排雷演算", size: "sm", color: "#64748b" },
                { type: "text", text: `已過濾 ${filteredCount} 筆特殊交易`, size: "xs", color: "#EF4444", weight: "bold", align: "end" }
              ]
            },
            { type: "separator", margin: "lg" },

            // 銀行授信試算區塊
            { type: "text", text: "🏦 地政士專業試算 (標準 35 坪)", size: "sm", color: "#0F172A", weight: "bold", margin: "lg" },
            {
              type: "box", layout: "horizontal", margin: "md",
              contents: [
                { type: "text", text: "預估總價", size: "sm", color: "#64748b" },
                { type: "text", text: `${estimatedTotalPrice} 萬`, size: "sm", color: "#0F172A", weight: "bold", align: "end" }
              ]
            },
            {
              type: "box", layout: "horizontal", margin: "sm",
              contents: [
                { type: "text", text: "銀行可貸 (8成)", size: "sm", color: "#64748b" },
                { type: "text", text: `${estimatedLoan} 萬`, size: "sm", color: "#2563EB", weight: "bold", align: "end" }
              ]
            },
            {
              type: "box", layout: "horizontal", margin: "sm",
              contents: [
                { type: "text", text: "準備自備款", size: "sm", color: "#64748b" },
                { type: "text", text: `${downPayment} 萬`, size: "sm", color: "#EA580C", weight: "bold", align: "end" }
              ]
            },
            {
              type: "box", layout: "horizontal", margin: "sm", backgroundColor: "#F1F5F9", paddingAll: "8px", cornerRadius: "8px",
              contents: [
                { type: "text", text: "💡 建議月收入達", size: "xs", color: "#475569", weight: "bold" },
                { type: "text", text: `${requiredIncome} 萬以上`, size: "xs", color: "#0F172A", weight: "bold", align: "end" }
              ]
            }
          ]
        },
        footer: {
          type: "box", layout: "vertical", spacing: "sm",
          contents: [
            {
              type: "button", style: "primary", color: "#4F46E5",
              action: { type: "uri", label: "💬 專人為我對接低利專案", uri: "https://line.me/ti/p/您的官方帳號ID" }
            },
            { type: "text", text: "※ 試算結果僅供參考，實際核貸成數與利率需依銀行最終審核為準。", size: "xxs", color: "#94a3b8", wrap: true, margin: "md" }
          ]
        }
      }
    };

    return client.replyMessage(event.replyToken, flexMessage);
  }

  return Promise.resolve(null);
}

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Nexus Valuation Engine running on port ${port}`);
});

module.exports = app;