const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  ContainerBuilder,
  TextDisplayBuilder,
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nuke')
    .setDescription('Apaga todas as mensagens do canal recriando-o (nuke).')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addStringOption(opt =>
      opt.setName('motivo')
        .setDescription('Motivo do nuke (opcional)')
        .setRequired(false)
    ),

  async execute(interaction) {
    // Verificações
    if (!interaction.inGuild()) {
      return interaction.reply({ content: 'Este comando só pode ser usado em servidores.', ephemeral: true });
    }
    const member = interaction.member;
    if (!member.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return interaction.reply({ content: 'Você precisa da permissão de Gerenciar Canais.', ephemeral: true });
    }

    const motivo = interaction.options.getString('motivo') || 'Nuke do canal via comando';
    const canal = interaction.channel;

    // Defer para evitar timeout
    await interaction.deferReply({ ephemeral: true });

    try {
      const canal = interaction.channel;
      const motivo = interaction.options.getString('motivo') || 'Nuke do canal via comando';

      // Clona o canal
      const novoCanal = await canal.clone({ reason: motivo });

      // Envia o Container v2 imediatamente no canal novo
      const container = new ContainerBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent('# Canal Nukado!')
        );

      await novoCanal.send({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
      });

      // Ajusta categoria/posição depois de enviar a mensagem
      if (canal.parent) {
        await novoCanal.setParent(canal.parent, { lockPermissions: true });
      }
      await novoCanal.setPosition(canal.position);

      // Remove o canal antigo
      await canal.delete(motivo);

      // Confirmação ao executor
      await interaction.editReply({ content: `Canal nukado com sucesso: ${novoCanal.toString()}` });
    } catch (err) {
      console.error('Erro ao executar nuke:', err);
      await interaction.editReply({ content: 'Falha ao nukar o canal. Verifique permissões e tente novamente.' });
    }
  },
};