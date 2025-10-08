const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  MessageFlags,
  ContainerBuilder,
  TextDisplayBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Publica um painel para abrir tickets')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    const container = new ContainerBuilder();
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent('## 🎫 Suporte'));
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent('Clique em "Abrir Ticket" para falar com a equipe.'));
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket:open').setLabel('Abrir Ticket').setStyle(ButtonStyle.Success)
    );
    container.addActionRowComponents(row);

    await interaction.reply({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });
  },

  async handleButton(interaction, client) {
    if (!interaction.isButton()) return;
    if (interaction.customId !== 'ticket:open') return;

    const parentChannel = interaction.channel;
    const thread = await parentChannel.threads.create({
      name: `ticket-${interaction.user.username}`,
      autoArchiveDuration: 1440,
      type: ChannelType.PublicThread,
      reason: 'Ticket de suporte',
    });

    const welcome = new ContainerBuilder();
    welcome.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## 🎫 Ticket aberto por <@${interaction.user.id}>`));
    welcome.addTextDisplayComponents(new TextDisplayBuilder().setContent('Descreva seu problema. A equipe responderá em breve.'));

    await thread.send({ components: [welcome], flags: MessageFlags.IsComponentsV2 });
    await interaction.reply({ content: `Ticket criado: <#${thread.id}>`, ephemeral: true });
  },
};