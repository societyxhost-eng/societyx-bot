const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  ContainerBuilder,
  TextDisplayBuilder,
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unlock')
    .setDescription('Destranca o canal atual (remove bloqueio de envio para @everyone).')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addStringOption(opt =>
      opt.setName('motivo').setDescription('Motivo (opcional)').setRequired(false)
    ),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: 'Use este comando em um servidor.', ephemeral: true });
    }
    const membro = interaction.member;
    if (!membro.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return interaction.reply({ content: 'Permissão necessária: Gerenciar Canais.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const motivo = interaction.options.getString('motivo') || 'Canal destrancado por /unlock';
    const canal = interaction.channel;

    try {
      // Remover overwrite explícito de SendMessages (volta a herdar da categoria)
      await canal.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: null }, { reason: motivo });

      const container = new ContainerBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent('## 🔓 Canal destrancado'));

      await canal.send({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
      });

      await interaction.editReply({ content: 'Canal destrancado com sucesso.' });
    } catch (err) {
      console.error('Erro em /unlock:', err);
      await interaction.editReply({ content: 'Falha ao destrancar o canal. Verifique permissões.' });
    }
  },
};