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
    console.log('🏓 メモ帳Bot: Pingを受信しました！');
    res.status(200).send('Memo Bot is alive!');
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Web server is running on port ${PORT}`);
});

// ==========================================
// 2. トークンと環境変数の確認
// ==========================================
const TOKEN = process.env.DISCORD_TOKEN || process.env.TOKEN;

if (!TOKEN) {
    console.error("⚠️ エラー: Discordのトークンが設定されていません。");
}

// ==========================================
// 3. メモデータ保存用ストレージ（メモリ上）
// ==========================================
// 構造: { [userId]: { [title]: content } }
const userMemos = {};

// ==========================================
// 4. Discord Botの初期化とコマンド登録
// ==========================================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages, // ★DMの受信を許可
    ]
});

// スラッシュコマンドの定義
const commands = [
    new SlashCommandBuilder()
        .setName('memo')
        .setDescription('メモ帳Botの管理およびヘルプを表示します')
        .addSubcommand(sub =>
            sub.setName('help')
                .setDescription('メモ帳Botの使い方を表示します')
        )
        .addSubcommand(sub =>
            sub.setName('add')
                .setDescription('新しいメモを作成します')
                .addStringOption(opt => opt.setName('title').setDescription('タイトル').setRequired(true))
                .addStringOption(opt => opt.setName('content').setDescription('本文').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('保存されているメモのタイトル一覧を表示します')
        )
        .addSubcommand(sub =>
            sub.setName('all')
                .setDescription('保存されているすべてのメモの内容をまとめて表示します')
        )
        .addSubcommand(sub =>
            sub.setName('view')
                .setDescription('指定したタイトルのメモを表示します')
                .addStringOption(opt => opt.setName('title').setDescription('タイトル').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('edit')
                .setDescription('既存のメモの内容を書き換えます')
                .addStringOption(opt => opt.setName('title').setDescription('タイトル').setRequired(true))
                .addStringOption(opt => opt.setName('new_content').setDescription('新しい本文').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('delete')
                .setDescription('指定したメモを削除します')
                .addStringOption(opt => opt.setName('title').setDescription('タイトル').setRequired(true))
        ),
];

// ★DM（ユーザーインストール）でもコマンドが使えるように設定を追加
const commandsJSON = commands.map(cmd => {
    const json = cmd.toJSON();
    json.integration_types = [0, 1]; // 0: Guild (サーバー), 1: User (ユーザー個別)
    json.contexts = [0, 1, 2];       // Guild, Bot DM, Private Channels
    return json;
});

async function registerCommands() {
    try {
        const rest = new REST({ version: '10' }).setToken(TOKEN);
        console.log('メモ帳Bot: スラッシュコマンドを登録中...');

        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commandsJSON },
        );

        console.log('メモ帳Bot: スラッシュコマンドの登録完了！');
    } catch (error) {
        console.error('コマンド登録エラー:', error);
    }
}

client.once('clientReady', async (c) => {
    console.log(`✅ メモ帳Bot ログイン成功: ${c.user.tag}`);
    await registerCommands();
});

// ==========================================
// 5. ヘルプ内容を表示する関数
// ==========================================
function getHelpContent() {
    return `📖 **メモ帳Botの使い方ガイド** 📖

サーバーのチャンネルでも、Botとの**DM（ダイレクトメッセージ）**でも使えます！

• **\`/memo help\`**：この使い方を表示します。
• **\`/memo add [タイトル] [本文]\`**：新しいメモを作成します。
• **\`/memo list\`**：保存されているメモのタイトル一覧を表示します。
• **\`/memo all\`**：すべてのメモ（タイトルと本文）をまとめて表示します。
• **\`/memo view [タイトル]\`**：指定したメモの本文を個別に表示します。
• **\`/memo edit [タイトル] [新しい本文]\`**：メモの内容を書き換えます。
• **\`/memo delete [タイトル]\`**：メモを削除します。`;
}

// ==========================================
// 6. インタラクションの処理
// ==========================================
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand() || interaction.commandName !== 'memo') return;

    const userId = interaction.user.id;
    if (!userMemos[userId]) userMemos[userId] = {};

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'help') {
        await interaction.reply({ content: getHelpContent(), ephemeral: true });
        return;
    }

    if (subcommand === 'add') {
        const title = interaction.options.getString('title');
        const content = interaction.options.getString('content');
        userMemos[userId][title] = content;
        await interaction.reply({ content: `✅ メモ「**${title}**」を保存しました！`, ephemeral: true });
        return;
    }

    if (subcommand === 'list') {
        const titles = Object.keys(userMemos[userId]);
        if (titles.length === 0) {
            return interaction.reply({ content: '📭 保存されているメモはありません。', ephemeral: true });
        }
        const listText = titles.map((t, index) => `${index + 1}. **${t}**`).join('\n');
        await interaction.reply({ content: `📋 **あなたの保存済みメモ一覧**\n${listText}`, ephemeral: true });
        return;
    }

    if (subcommand === 'all') {
        const memos = userMemos[userId];
        const titles = Object.keys(memos);
        if (titles.length === 0) {
            return interaction.reply({ content: '📭 保存されているメモはありません。', ephemeral: true });
        }
        let allText = `📚 **あなたのすべてのメモ一覧**\n\n`;
        titles.forEach(title => {
            allText += `🔹 **【 ${title} 】**\n\`\`\`text\n${memos[title]}\n\`\`\`\n`;
        });
        if (allText.length > 2000) {
            allText = allText.substring(0, 1950) + '\n\n...(省略されました)';
        }
        await interaction.reply({ content: allText, ephemeral: true });
        return;
    }

    if (subcommand === 'view') {
        const title = interaction.options.getString('title');
        const content = userMemos[userId][title];
        if (content === undefined) {
            return interaction.reply({ content: `⚠️ 「**${title}**」というメモは見つかりませんでした。`, ephemeral: true });
        }
        await interaction.reply({ content: `📖 **【 ${title} 】**\n\`\`\`text\n${content}\n\`\`\``, ephemeral: true });
        return;
    }

    if (subcommand === 'edit') {
        const title = interaction.options.getString('title');
        const newContent = interaction.options.getString('new_content');
        if (userMemos[userId][title] === undefined) {
            return interaction.reply({ content: `⚠️ 編集対象のメモ「**${title}**」が見つかりませんでした。`, ephemeral: true });
        }
        userMemos[userId][title] = newContent;
        await interaction.reply({ content: `✨ メモ「**${title}**」の内容を更新しました！`, ephemeral: true });
        return;
    }

    if (subcommand === 'delete') {
        const title = interaction.options.getString('title');
        if (userMemos[userId][title] === undefined) {
            return interaction.reply({ content: `⚠️ 削除対象のメモ「**${title}**」が見つかりませんでした。`, ephemeral: true });
        }
        delete userMemos[userId][title];
        await interaction.reply({ content: `🗑️ メモ「**${title}**」を削除しました。`, ephemeral: true });
        return;
    }
});

// ==========================================
// 7. Botのログイン
// ==========================================
client.login(TOKEN);