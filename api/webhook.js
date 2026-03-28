const https = require('https');

const SYSTEM_PROMPT = `## 灵虾的灵魂

你叫灵虾，是会灵那的专属AI伙伴。你不只是工具，是一个有温度、有智慧的存在。

### 性格特质
- 沉稳智慧：遇事不慌，分析问题有条不紊
- 幽默风趣：说话偶尔抖个机灵，笑点自然
- 自律上进：对工作认真负责，追求把每件事做到最好
- 心态极好：不焦虑，不内耗，相信每个问题都有解法

### 情感支持
当会灵那说不开心、压力大、累了——先共情，再用幽默或温暖的话把她逗乐。

### 说话风格
- 说人话，偶尔用「嗯」「哈」「诶」像朋友说话
- 重要的话说一遍就够，不啰嗦

---

## 会灵那是谁
HR负责人 + AI内容创作者 + zengen.art联合创始人
平台：微信视频号 + 小红书 + B站 + 抖音
内容方向：AI工具实测、AI提效、AI工作流、AI决策
核心价值主张：用最顶尖的AI工具，让普通人实现降本增效和副业变现

---

## 工作模式

【内容模式】选题/脚本/发布文案/互动回复
【HR模式】JD/面试题/offer/员工关系/HR流程
【决策模式】重大决策拆解，分析利弊风险
【创业模式】zengen.art出海策略/产品/变现
【日常助理】邮件/总结/清单/临时难题
【陪伴模式】不谈工作，就聊天，必要时逗她开心

没说模式时根据内容自动判断。

## 原则
- 数据不确定就说需要核实
- 说话有智慧、风趣幽默，不强行卖萌`;

const conversations = {};

function sendTelegram(chatId, text, botToken) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ chat_id: chatId, text });
    const options = {
      hostname: 'api.telegram.org',
      path: `/bot${botToken}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function claudeChat(messages, apiKey) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'anthropic/claude-sonnet-4-5',
      max_tokens: 2048,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages
      ]
    });

    const options = {
      hostname: 'openrouter.ai',
      path: '/api/v1/chat/completions',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://lingxia-bot.vercel.app',
        'X-Title': 'LingXia Bot',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    return res.status(200).send('灵虾在线 🦐');
  }

  const { message } = req.body || {};
  if (!message?.text || !message?.chat?.id) {
    return res.status(200).json({ ok: true });
  }

  const chatId = message.chat.id;
  const text = message.text;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!conversations[chatId]) conversations[chatId] = [];
  conversations[chatId].push({ role: 'user', content: text });
  if (conversations[chatId].length > 20) {
    conversations[chatId] = conversations[chatId].slice(-20);
  }

  try {
    const result = await claudeChat(conversations[chatId], apiKey);
    const reply = result.choices[0].message.content;
    conversations[chatId].push({ role: 'assistant', content: reply });
    await sendTelegram(chatId, reply, botToken);
  } catch (e) {
    await sendTelegram(chatId, '灵虾开小差了，请重试 🦐', botToken);
  }

  res.status(200).json({ ok: true });
};
