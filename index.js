import 'dotenv/config';
import express from 'express';
import {
    Client,
    GatewayIntentBits,
    SlashCommandBuilder,
    REST,
    Routes,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ChannelType,
} from 'discord.js';

// ==========================================
// 1. Webサーバーの設定（RenderのPing受け取り用）
// ==========================================
const app = express();
const PORT = process.env.PORT || 10000;

// GASやUptimeRobotなどの外部からアクセスが来たときの処理
app.get('/', (req, res) => {
    console.log('🏓 Pingを受信しました！サーバーは稼働中です。');
    res.status(200).send('I am alive!');
});

// ポートを開いてサーバーを起動
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Web server is running on port ${PORT}`);
});

// ==========================================
// 2. TOKENのデバッグ・環境変数確認
// ==========================================
console.log("=== TOKEN デバッグ開始 ===");
console.log("型:", typeof process.env.TOKEN);
console.log("中身が存在するか:", process.env.TOKEN ? "存在する（長さ: " + process.env.TOKEN.length + "文字）" : "❌ 存在しない（undefined または 空）");
console.log("=== TOKEN デバッグ終了 ===");

const TOKEN = process.env.TOKEN || process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

// ==========================================
// 3. Discord Botの初期化
// ==========================================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
    ]
});

const {
    Client,
    GatewayIntentBits,
    Partials,
    EmbedBuilder
} = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
    ],
    partials: [Partials.Channel, Partials.Message],
});

const userNotes = {};
const userDashboards = {};

function createDashboardEmbed(userId, panelName) {
    const notes = userNotes[userId]?.[panelName] || [];

    let description = '';
    if (notes.length === 0) {
        description = '現在メモはありません。\n`!add ' + panelName + ' [内容]` でメモを追加してね！\n（ヘルプ: `/memo help`）';
    } else {
        notes.forEach((note, index) => {
            description += `**[${index + 1}]** ${note}\n`;
        });
    }

    return new EmbedBuilder()
        .setTitle(`📌 あなたのメモボード [ ${panelName} ]`)
        .setColor(0x00AE86)
        .setDescription(description)
        .setFooter({ text: `最終更新: ${new Date().toLocaleString('ja-JP')}` });
}

async function updateDashboardMessage(client, userId, panelName) {
    const dashboardInfo = userDashboards[userId]?.[panelName];
    if (!dashboardInfo) return;

    try {
        const channel = await client.channels.fetch(dashboardInfo.channelId);
        const message = await channel.messages.fetch(dashboardInfo.messageId);

        const embed = createDashboardEmbed(userId, panelName);
        await message.edit({ embeds: [embed] });
    } catch (error) {
        console.log('ダッシュボードの更新に失敗しました:', error);
    }
}

client.once('ready', () => {
    console.log(`[メモ帳Bot] ${client.user.tag} としてログインしました！`);
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    const userId = message.author.id;
    const args = message.content.trim().split(' ');
    const command = args[0];

    if (command === '!panel' || command === '!memo') {
        const panelName = args[1] || 'メイン';

        if (!userNotes[userId]) userNotes[userId] = {};
        if (!userNotes[userId][panelName]) userNotes[userId][panelName] = [];

        const embed = createDashboardEmbed(userId, panelName);
        const sentMessage = await message.channel.send({ embeds: [embed] });

        if (!userDashboards[userId]) userDashboards[userId] = {};
        userDashboards[userId][panelName] = {
            channelId: message.channel.id,
            messageId: sentMessage.id
        };

        await message.reply(`あなた専用のパネル「${panelName}」を表示しました！`);
    }
    else if (command === '!add') {
        const panelName = args[1];
        const content = args.slice(2).join(' ');

        if (!panelName || !content) {
            return message.reply('書き方が違うよ！ 例: `!add 仕事 企画書を作る`');
        }

        if (!userNotes[userId]) userNotes[userId] = {};
        if (!userNotes[userId][panelName]) userNotes[userId][panelName] = [];

        userNotes[userId][panelName].push(content);

        await message.reply(`パネル「${panelName}」にメモを追加しました！`);
        await updateDashboardMessage(client, userId, panelName);
    }
    else if (command === '!edit') {
        const panelName = args[1];
        const indexNum = parseInt(args[2]) - 1;
        const newContent = args.slice(3).join(' ');

        if (!panelName || isNaN(indexNum) || !newContent) {
            return message.reply('書き方が違うよ！ 例: `!edit 仕事 1 新しい内容`');
        }

        const notes = userNotes[userId]?.[panelName];
        if (!notes || notes.length === 0 || indexNum < 0 || indexNum >= notes.length) {
            return message.reply('指定したパネルや番号のメモが見つからないよ。');
        }

        const oldContent = notes[indexNum];
        notes[indexNum] = newContent;

        await message.reply(`パネル「${panelName}」のメモを編集しました！\n(旧: ${oldContent} ➔ 新: ${newContent})`);
        await updateDashboardMessage(client, userId, panelName);
    }
    else if (command === '!del') {
        const panelName = args[1];
        const indexNum = parseInt(args[2]) - 1;

        if (!panelName || isNaN(indexNum)) {
            return message.reply('書き方が違うよ！ 例: `!del 仕事 1`');
        }

        const notes = userNotes[userId]?.[panelName];
        if (!notes || notes.length === 0 || indexNum < 0 || index >= notes.length) {
            return message.reply('指定したパネルや番号のメモが見つからないよ。');
        }

        const deleted = notes.splice(indexNum, 1);
        await message.reply(`パネル「${panelName}」のメモ「${deleted}」を削除しました！`);
        await updateDashboardMessage(client, userId, panelName);
    }
    else if (command === '!list') {
        const panels = userNotes[userId];
        if (!panels || Object.keys(panels).length === 0) {
            return message.reply('作成されているパネルはありません。`!panel [名前]` で作ってみてね！');
        }

        let response = '**📁 あなたのパネル一覧:**\n';
        for (const [name, notes] of Object.entries(panels)) {
            response += `・**${name}** （メモ数: ${notes.length}件）\n`;
        }
        message.reply(response);
    }
    // メモ帳Botのヘルプ: /memo help
    else if (message.content.trim() === '/memo help') {
        await message.reply(
            '**🤖 個人用メモ帳Botの使い方**\n' +
            '・`!panel [パネル名]` : あなた専用のパネルを表示する（例: `!panel 仕事`）\n' +
            '・`!add [パネル名] [内容]` : あなたのパネルにメモを追加する\n' +
            '・`!edit [パネル名] [番号] [内容]` : 指定したメモを編集する\n' +
            '・`!del [パネル名] [番号]` : 指定したメモを削除する\n' +
            '・`!list` : あなたのパネル一覧を確認する\n' +
            '・`/memo help` : このヘルプを表示する'
        );
    }
});

// 直接トークンを書かず、環境変数から読み込む
client.login(process.env.DISCORD_TOKEN);