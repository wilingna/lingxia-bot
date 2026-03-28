const https = require('https');

function difyChat(message, conversationId, apiKey) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      inputs: {},
      query: message,
      response_mode: 'blocking',
      conversation_id: conversationId || '',
      user: 'telegram-user'
    });

    const options = {
      hostname: 'api.dify.ai',
      path: '/v1/chat-messages',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

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

const conversations = {};

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
  const convId = conversations[chatId] || '';

  try {
    const result = await difyChat(
      text, convId,
      process.env.DIFY_API_KEY
    );
    conversations[chatId] = result.conversation_id || convId;
    await sendTelegram(chatId, result.answer, process.env.TELEGRAM_BOT_TOKEN);
  } catch (e) {
    await sendTelegram(chatId, '灵虾开小差了，请重试 🦐', process.env.TELEGRAM_BOT_TOKEN);
  }

  res.status(200).json({ ok: true });
};
