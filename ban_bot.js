const TelegramBot = require('node-telegram-bot-api');
const { exec } = require('child_process');
const fs = require('fs');

const BOT_TOKEN = process.env.BOT_TOKEN || '8920423322:AAHhKb0jktz4SrYi9ZbNwaTC-maRnt8RiNo';
const ALLOWED_USERS = (process.env.ALLOWED_USERS || '8910730508').split(',');

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

function isAuthorized(msg) {
    return ALLOWED_USERS.includes(String(msg.from.id));
}

bot.onText(/\/start/, (msg) => {
    if (!isAuthorized(msg)) return bot.sendMessage(msg.chat.id, '⛔ Unauthorized.');
    const help = `
💀 *WhatsApp Ban Bot*

Commands:
/ban <number> — Start ban attack on a number
/status — Check running attacks
/stop — Stop all attacks
/help — Show this message

*Example:*
/ban 2348269946429
`;
    bot.sendMessage(msg.chat.id, help, { parse_mode: 'Markdown' });
});

bot.onText(/\/ban (.+)/, async (msg, match) => {
    if (!isAuthorized(msg)) return;
    const number = match[1];
    const chatId = msg.chat.id;

    await bot.sendMessage(chatId, `🚀 Starting ban attack on *${number}*...`, { parse_mode: 'Markdown' });

    // Run the Python script
    exec(`python whatsapp_ban.py --target ${number} --threads 10`, (error, stdout, stderr) => {
        if (error) {
            bot.sendMessage(chatId, `❌ Error: ${error.message}`);
            return;
        }
        bot.sendMessage(chatId, `✅ Attack completed\n\n\`\`\`${stdout.slice(0, 4000)}\`\`\``, { parse_mode: 'Markdown' });
    });
});

bot.onText(/\/status/, (msg) => {
    if (!isAuthorized(msg)) return;
    bot.sendMessage(msg.chat.id, '📡 Bot is running. Use /ban to start an attack.');
});

bot.onText(/\/help/, (msg) => {
    if (!isAuthorized(msg)) return;
    bot.sendMessage(msg.chat.id, 'Use /start to see commands.');
});

console.log('✅ WhatsApp Ban Bot is running!');
