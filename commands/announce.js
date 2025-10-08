const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  MessageFlags,
  ContainerBuilder,
  TextDisplayBuilder,
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Envia um anúncio em um canal utilizando Container v2.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addChannelOption(opt =>
      opt.setName('canal')
        .setDescription('Canal de destino')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('mensagem')
        .setDescription('Conteúdo do anúncio')
        .setRequired(true)
    )
    .addBooleanOption(opt =>
      opt.setName('ping')
        .setDescription('Mencionar @everyone?')
        .setRequired(false)
    ),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: 'Use este comando em um servidor.', ephemeral: true });
    }
    const membro = interaction.member;
    if (!membro.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return interaction.reply({ content: 'Permissão necessária: Gerenciar Mensagens.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const canal = interaction.options.getChannel('canal');
    const mensagem = interaction.options.getString('mensagem');
    const ping = interaction.options.getBoolean('ping') || false;

    try {
      const container = new ContainerBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## 📢 Aviso\n${mensagem}`));

      await canal.send({
        content: ping ? '@everyone' : undefined,
        allowedMentions: ping ? { parse: ['everyone'] } : undefined,
        components: [container],
        flags: MessageFlags.IsComponentsV2,
      });

      await interaction.editReply({ content: `Anúncio enviado em ${canal.toString()}.` });
    } catch (err) {
      console.error('Erro em /announce:', err);
      await interaction.editReply({ content: 'Falha ao enviar anúncio. Verifique permissões.' });
    }
  },
};