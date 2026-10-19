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
    ]
});

// すべてのスラッシュコマンド定義
const commands = [
    new SlashCommandBuilder()
        .setName('memo')
        .setDescription('メモを管理します')
        // /memo add <title> <content>
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('新しいメモを作成します')
                .addStringOption(option =>
                    option.setName('title').setDescription('メモのタイトル').setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('content').setDescription('メモの本文').setRequired(true)
                )
        )
        // /memo list (タイトル一覧)
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('保存されているメモのタイトル一覧を表示します')
        )
        // /memo all (すべてのメモをまとめて表示)
        .addSubcommand(subcommand =>
            subcommand
                .setName('all')
                .setDescription('保存されているすべてのメモの内容をまとめて表示します')
        )
        // /memo view <title> (特定のメモを読む)
        .addSubcommand(subcommand =>
            subcommand
                .setName('view')
                .setDescription('指定したタイトルのメモを表示します')
                .addStringOption(option =>
                    option.setName('title').setDescription('確認したいメモのタイトル').setRequired(true)
                )
        )
        // /memo edit <title> <new_content> (編集)
        .addSubcommand(subcommand =>
            subcommand
                .setName('edit')
                .setDescription('既存のメモの内容を書き換えます')
                .addStringOption(option =>
                    option.setName('title').setDescription('編集するメモのタイトル').setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('new_content').setDescription('新しい本文').setRequired(true)
                )
        )
        // /memo delete <title> (削除)
        .addSubcommand(subcommand =>
            subcommand
                .setName('delete')
                .setDescription('指定したメモを削除します')
                .addStringOption(option =>
                    option.setName('title').setDescription('削除するメモのタイトル').setRequired(true)
                )
        ),

    // /help
    new SlashCommandBuilder()
        .setName('help')
        .setDescription('メモ帳Botの使い方を表示します'),
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
// 5. 使い方（ヘルプ）を表示する関数
// ==========================================
function getHelpContent() {
    return `📖 **メモ帳Botの使い方ガイド** 📖

• **\`/memo add [タイトル] [本文]\`**：新しいメモを作成します。
• **\`/memo list\`**：保存されているメモの「タイトル一覧」を表示します。
• **\`/memo all\`**：保存されている**すべてのメモ（タイトルと本文）をまとめて表示**します。
• **\`/memo view [タイトル]\`**：指定したメモの本文を個別に表示します。
• **\`/memo edit [タイトル] [新しい本文]\`**：メモの内容を書き換えます。
• **\`/memo delete [タイトル]\`**：メモを削除します。
• **\`/help\`**：この使い方ガイドを表示します。`;
}

// ==========================================
// 6. インタラクションの処理
// ==========================================
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const userId = interaction.user.id;
    if (!userMemos[userId]) userMemos[userId] = {};

    const { commandName } = interaction;

    if (commandName === 'help') {
        await interaction.reply({
            content: getHelpContent(),
            ephemeral: true,
        });
        return;
    }

    if (commandName === 'memo') {
        const subcommand = interaction.options.getSubcommand();

        // 1. 追加 (add)
        if (subcommand === 'add') {
            const title = interaction.options.getString('title');
            const content = interaction.options.getString('content');

            userMemos[userId][title] = content;

            await interaction.reply({
                content: `✅ メモ「**${title}**」を新しく保存しました！`,
                ephemeral: true,
            });
            return;
        }

        // 2. タイトル一覧 (list)
        if (subcommand === 'list') {
            const titles = Object.keys(userMemos[userId]);

            if (titles.length === 0) {
                await interaction.reply({
                    content: '📭 保存されているメモはまだありません。`/memo add` で追加してください。',
                    ephemeral: true,
                });
                return;
            }

            const listText = titles.map((t, index) => `${index + 1}. **${t}**`).join('\n');
            await interaction.reply({
                content: `📋 **あなたの保存済みメモ一覧（タイトル）**\n${listText}`,
                ephemeral: true,
            });
            return;
        }

        // 3. すべてまとめて表示 (all) ★新機能
        if (subcommand === 'all') {
            const memos = userMemos[userId];
            const titles = Object.keys(memos);

            if (titles.length === 0) {
                await interaction.reply({
                    content: '📭 保存されているメモはまだありません。`/memo add` で追加してください。',
                    ephemeral: true,
                });
                return;
            }

            // すべてのメモのタイトルと本文を連結してテキストを作成
            let allText = `📚 **あなたのすべてのメモ一覧**\n\n`;
            for (const title of titles) {
                allText += `🔹 **【 ${title} 】**\n\`\`\`text\n${memos[title]}\n\`\`\`\n`;
            }

            // 文字数がDiscordの制限（2000文字）を超えないように簡易チェック
            if (allText.length > 2000) {
                allText = allText.substring(0, 1950) + '\n\n...(長すぎるため省略されました)';
            }

            await interaction.reply({
                content: allText,
                ephemeral: true,
            });
            return;
        }

        // 4. 個別閲覧 (view)
        if (subcommand === 'view') {
            const title = interaction.options.getString('title');
            const content = userMemos[userId][title];

            if (content === undefined) {
                await interaction.reply({
                    content: `⚠️ 「**${title}**」というタイトルのメモは見つかりませんでした。`,
                    ephemeral: true,
                });
                return;
            }

            await interaction.reply({
                content: `📖 **【 ${title} 】**\n\`\`\`text\n${content}\n\`\`\``,
                ephemeral: true,
            });
            return;
        }

        // 5. 編集 (edit)
        if (subcommand === 'edit') {
            const title = interaction.options.getString('title');
            const newContent = interaction.options.getString('new_content');

            if (userMemos[userId][title] === undefined) {
                await interaction.reply({
                    content: `⚠️ 編集対象のメモ「**${title}**」が見つかりませんでした。`,
                    ephemeral: true,
                });
                return;
            }

            userMemos[userId][title] = newContent;

            await interaction.reply({
                content: `✨ メモ「**${title}**」の内容を新しく更新しました！`,
                ephemeral: true,
            });
            return;
        }

        // 6. 削除 (delete)
        if (subcommand === 'delete') {
            const title = interaction.options.getString('title');

            if (userMemos[userId][title] === undefined) {
                await interaction.reply({
                    content: `⚠️ 削除対象のメモ「**${title}**」が見つかりませんでした。`,
                    ephemeral: true,
                });
                return;
            }

            delete userMemos[userId][title];

            await interaction.reply({
                content: `🗑️ メモ「**${title}**」を削除しました。`,
                ephemeral: true,
            });
            return;
        }
    }
});

// ==========================================
// 7. Botのログイン
// ==========================================
client.login(TOKEN);