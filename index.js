import 'dotenv/config';
import express from 'express';
import {
    Client,
    GatewayIntentBits,
    SlashCommandBuilder,
    REST,
    Routes,
} from 'discord.js';

const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => {
    res.status(200).send('Memo Bot is alive!');
});
app.listen(PORT, '0.0.0.0');

const TOKEN = process.env.DISCORD_TOKEN || process.env.TOKEN;
const userMemos = {};

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const commands = [
    new SlashCommandBuilder()
        .setName('memo')
        .setDescription('メモ帳Botの管理およびヘルプを表示します')
        .addSubcommand(sub => sub.setName('help').setDescription('メモ帳Botの使い方を表示します'))
        .addSubcommand(sub => sub.setName('add').setDescription('新しいメモを作成します')
            .addStringOption(opt => opt.setName('title').setDescription('タイトル').setRequired(true))
            .addStringOption(opt => opt.setName('content').setDescription('本文').setRequired(true)))
        .addSubcommand(sub => sub.setName('list').setDescription('メモのタイトル一覧を表示します'))
        .addSubcommand(sub => sub.setName('all').setDescription('すべてのメモの内容をまとめて表示します'))
        .addSubcommand(sub => sub.setName('view').setDescription('指定したメモを表示します')
            .addStringOption(opt => opt.setName('title').setDescription('タイトル').setRequired(true)))
        .addSubcommand(sub => sub.setName('edit').setDescription('メモを編集します')
            .addStringOption(opt => opt.setName('title').setDescription('タイトル').setRequired(true))
            .addStringOption(opt => opt.setName('new_content').setDescription('新しい本文').setRequired(true)))
        .addSubcommand(sub => sub.setName('delete').setDescription('メモを削除します')
            .addStringOption(opt => opt.setName('title').setDescription('タイトル').setRequired(true)))
];

async function registerCommands() {
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
}

client.once('clientReady', async (c) => {
    console.log(`✅ メモ帳Bot ログイン: ${c.user.tag}`);
    await registerCommands();
});

function getHelpContent() {
    return `📖 **メモ帳Botの使い方** 📖
• \`/memo help\`: この使い方を表示
• \`/memo add [タイトル] [本文]\`: メモ追加
• \`/memo list\`: タイトル一覧
• \`/memo all\`: すべてのメモを表示
• \`/memo view [タイトル]\`: メモを読む
• \`/memo edit [タイトル] [新しい本文]\`: 編集
• \`/memo delete [タイトル]\`: 削除`;
}

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand() || interaction.commandName !== 'memo') return;
    const userId = interaction.user.id;
    if (!userMemos[userId]) userMemos[userId] = {};

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'help') {
        await interaction.reply({ content: getHelpContent(), ephemeral: true });
    } else if (subcommand === 'add') {
        const title = interaction.options.getString('title');
        const content = interaction.options.getString('content');
        userMemos[userId][title] = content;
        await interaction.reply({ content: `✅ メモ「**${title}**」を保存しました！`, ephemeral: true });
    } else if (subcommand === 'list') {
        const titles = Object.keys(userMemos[userId]);
        if (titles.length === 0) return interaction.reply({ content: '📭 メモはありません。', ephemeral: true });
        await interaction.reply({ content: `📋 **メモ一覧**\n` + titles.map((t, i) => `${i + 1}. **${t}**`).join('\n'), ephemeral: true });
    } else if (subcommand === 'all') {
        const memos = userMemos[userId];
        const titles = Object.keys(memos);
        if (titles.length === 0) return interaction.reply({ content: '📭 メモはありません。', ephemeral: true });
        let text = `📚 **すべてのメモ**\n\n`;
        titles.forEach(t => text += `🔹 **【 ${t} 】**\n\`\`\`text\n${memos[t]}\n\`\`\`\n`);
        await interaction.reply({ content: text, ephemeral: true });
    } else if (subcommand === 'view') {
        const title = interaction.options.getString('title');
        const content = userMemos[userId][title];
        if (!content) return interaction.reply({ content: `⚠️ 見つかりませんでした。`, ephemeral: true });
        await interaction.reply({ content: `📖 **【 ${title} 】**\n\`\`\`text\n${content}\n\`\`\``, ephemeral: true });
    } else if (subcommand === 'edit') {
        const title = interaction.options.getString('title');
        const newContent = interaction.options.getString('new_content');
        if (!userMemos[userId][title]) return interaction.reply({ content: `⚠️ 見つかりませんでした。`, ephemeral: true });
        userMemos[userId][title] = newContent;
        await interaction.reply({ content: `✨ メモ「**${title}**」を更新しました！`, ephemeral: true });
    } else if (subcommand === 'delete') {
        const title = interaction.options.getString('title');
        if (!userMemos[userId][title]) return interaction.reply({ content: `⚠️ 見つかりませんでした。`, ephemeral: true });
        delete userMemos[userId][title];
        await interaction.reply({ content: `🗑️ メモ「**${title}**」を削除しました。`, ephemeral: true });
    }
});

client.login(TOKEN);