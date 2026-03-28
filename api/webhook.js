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
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
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

function getVoiceFile(fileId, botToken) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.telegram.org',
      path: `/bot${botToken}/getFile?file_id=${fileId}`,
      method: 'GET'
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
    req.end();
  });
}

function transcribeVoice(filePath, botToken) {
  return new Promise((resolve, reject) => {
    const fileUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
    const body = JSON.stringify({
      model: 'whisper-1',
      file_url: fileUrl,
      language: 'zh'
    });

    // 用 OpenAI Whisper 转写，这里先返回提示让用户发文字
    resolve('[语音消息，请发送文字]');
  });
}

const conversations = {};

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    return res.status(200).send('灵虾在线 🦐');
  }

  const { message } = req.body || {};
  if (!message?.chat?.id) {
    return res.status(200).json({ ok: true });
  }

  const chatId = message.chat.id;
  const convId = conversations[chatId] || '';
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  let text = '';

  if (message.text) {
    text = message.text;
  } else if (message.voice || message.audio) {
    await sendTelegram(chatId, '🦐 收到语音啦！我正在转文字，稍等一秒...', botToken);
    try {
      const fileId = (message.voice || message.audio).file_id;
      const fileInfo = await getVoiceFile(fileId, botToken);
      const filePath = fileInfo.result.file_path;
      const fileUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
      
      // 调用 OpenAI Whisper 转写
      text = await whisperTranscribe(fileUrl);
      await sendTelegram(chatId, `📝 我听到你说：「${text}」`, botToken);
    } catch (e) {
      await sendTelegram(chatId, '语音转文字失败了，能打字告诉我吗？🦐', botToken);
      return res.status(200).json({ ok: true });
    }
  } else {
    return res.status(200).json({ ok: true });
  }

  try {
    const result = await difyChat(text, convId, process.env.DIFY_API_KEY);
    conversations[chatId] = result.conversation_id || convId;
    await sendTelegram(chatId, result.answer, botToken);
  } catch (e) {
    await sendTelegram(chatId, '灵虾开小差了，请重试 🦐', botToken);
  }

  res.status(200).json({ ok: true });
};

async function whisperTranscribe(fileUrl) {
  // 下载语音文件
  const audioBuffer = await downloadFile(fileUrl);
  
  return new Promise((resolve, reject) => {
    const boundary = '----FormBoundary' + Math.random().toString(36);
    const header = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="voice.ogg"\r\nContent-Type: audio/ogg\r\n\r\n`
    );
    const modelPart = Buffer.from(
      `\r\n--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nwhisper-1\r\n--${boundary}\r\nContent-Disposition: form-data; name="language"\r\n\r\nzh\r\n--${boundary}--\r\n`
    );
    const body = Buffer.concat([header, audioBuffer, modelPart]);

    const options = {
      hostname: 'api.openai.com',
      path: '/v1/audio/transcriptions',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data).text); }
        catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function downloadFile(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
  });
}
