import 'dotenv/config';
import express from 'express';
import {
    Client,
    GatewayIntentBits,
    SlashCommandBuilder,
    REST,
    Routes,
} from 'discord.js';

// ==========================================
// 1. Webサーバーの設定（RenderのPing受け取り用）
// ==========================================
const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => {
    console.log('🏓 メモ帳Bot: Pingを受信しました！サーバーは稼働中です。');
    res.status(200).send('Memo Bot is alive!');
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Web server is running on port ${PORT}`);
});

// ==========================================
// 2. トークンと環境変数の確認
// ==========================================
const TOKEN = process.env.DISCORD_TOKEN || process.env.TOKEN;

console.log("=== MEMO BOT TOKEN デバッグ ===");
console.log("中身が存在するか:", TOKEN ? `存在する（長さ: ${TOKEN.length}文字）` : "❌ 存在しない（undefined または 空）");

if (!TOKEN) {
    console.error("⚠️ エラー: Discordのトークンが設定されていません。Renderの環境変数を確認してください。");
}

// ==========================================
// 3. Discord Botの初期化とコマンド登録
// ==========================================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ]
});

// 登録するスラッシュコマンド
const commands = [
    new SlashCommandBuilder()
        .setName('memo')
        .setDescription('メモを保存・確認します')
        .addStringOption(option =>
            option.setName('content')
                .setDescription('保存するメモの内容')
                .setRequired(false)
        ),
];

async function registerCommands() {
    try {
        const rest = new REST({ version: '10' }).setToken(TOKEN);
        console.log('メモ帳Bot: スラッシュコマンドの登録を開始します...');

        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands },
        );

        console.log('メモ帳Bot: スラッシュコマンドの登録が完了しました！');
    } catch (error) {
        console.error('コマンド登録エラー:', error);
    }
}

client.once('clientReady', async (c) => {
    console.log(`✅ メモ帳Bot ログイン成功: ${c.user.tag}`);
    await registerCommands();
});

// ==========================================
// 4. コマンドの処理
// ==========================================
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'memo') {
        const content = interaction.options.getString('content');

        if (!content) {
            await interaction.reply({
                content: '📝 現在保存されているメモはありません。（機能拡張用）',
                ephemeral: true,
            });
            return;
        }

        await interaction.reply({
            content: `💾 メモを保存しました: 「${content}」`,
            ephemeral: true,
        });
    }
});

// ==========================================
// 5. Botのログイン
// ==========================================
client.login(TOKEN);