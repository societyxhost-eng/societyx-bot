const {
  SlashCommandBuilder,
  MessageFlags,
  ContainerBuilder,
  TextDisplayBuilder,
} = require('discord.js');
const fs = require('fs');
const path = require('path');

const STORE_PATH = path.join(__dirname, '..', 'chatStats.json');

function readStore() {
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('topchat')
    .setDescription('Mostra os membros que mais enviaram mensagens.')
    .addIntegerOption(opt =>
      opt.setName('limite')
        .setDescription('Quantidade de posições (3–25)')
        .setMinValue(3)
        .setMaxValue(25)
        .setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false });

    const limite = interaction.options.getInteger('limite') || 10;
    const store = readStore();

    const entries = Object.entries(store) // [userId, count]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limite);

    if (entries.length === 0) {
      const emptyContainer = new ContainerBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent('## 📊 Top Chat\nAinda não há dados coletados.')
        );

      return interaction.editReply({
        components: [emptyContainer],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    const linhas = entries.map(([id, count], idx) => `${idx + 1}. <@${id}> — ${count} mensagens`);
    const conteudo = `## 📊 Top Chat\n${linhas.join('\n')}`;

    const container = new ContainerBuilder()
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(conteudo));

    await interaction.editReply({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });
  },
};