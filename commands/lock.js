const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  ContainerBuilder,
  TextDisplayBuilder,
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lock')
    .setDescription('Tranca o canal atual para @everyone.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: 'Use este comando em um servidor.', ephemeral: true });
    }
    const membro = interaction.member;
    if (!membro.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return interaction.reply({ content: 'Permissão necessária: Gerenciar Canais.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const motivo = interaction.options.getString('motivo') || 'Canal trancado por /lock';
    const canal = interaction.channel;

    try {
      await canal.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false }, { reason: motivo });

      const container = new ContainerBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent('## 🔒 Canal trancado'));

      await canal.send({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
      });

      await interaction.editReply({ content: 'Canal trancado com sucesso.' });
    } catch (err) {
      console.error('Erro em /lock:', err);
      await interaction.editReply({ content: 'Falha ao trancar o canal. Verifique permissões.' });
    }
  },
};