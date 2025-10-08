const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  Events,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize
} = require('discord.js');

const FIXED_LOG_CHANNEL_ID = '1424515588700639393';

const createMessageLogPayloadV2 = (message, type, oldContent = null) => {
  const content = message.content?.length > 1800 ? message.content.slice(0, 1797) + '...' : message.content;
  const oldContentTruncated = oldContent?.length > 1800 ? oldContent.slice(0, 1797) + '...' : oldContent;

  const container = new ContainerBuilder();

  // Título
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(type === 'edit' ? '✏️ **Mensagem Editada**' : '🗑️ **Mensagem Excluída**')
  );
  // Metadados
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`**👤 Autor:** <@${message.author.id}>`),
    new TextDisplayBuilder().setContent(`**📍 Canal:** <#${message.channel.id}>`)
  );

  // Separador
  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
  );

  if (type === 'edit') {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('**💭 Antes:**'),
      new TextDisplayBuilder().setContent(oldContentTruncated ? `\`\`\`diff\n- ${oldContentTruncated}\n\`\`\`` : '*(Sem texto)*')
    );
    container.addSeparatorComponents(
      new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small)
    );
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('**💭 Depois:**'),
      new TextDisplayBuilder().setContent(content ? `\`\`\`diff\n+ ${content}\n\`\`\`` : '*(Sem texto)*')
    );
  } else {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('**💭 Conteúdo:**'),
      new TextDisplayBuilder().setContent(content ? `\`\`\`\n${content}\n\`\`\`` : '*(Mensagem sem texto — possivelmente apenas anexos)*')
    );
  }

  // Anexos
  if (message.attachments?.size > 0) {
    const attachments = message.attachments.map(a => `[📎 Anexo](${a.url})`).join('\n');
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small));
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`**🖼️ Anexos:**\n${attachments}`)
    );
  }

  // Rodapé
  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small)
  );
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`*Sistema de Logs • ${type === 'edit' ? 'Edição' : 'Exclusão'}*`)
  );

  const linkRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('🔗 Ver no Canal')
      .setStyle(ButtonStyle.Link)
      .setURL(`https://discord.com/channels/${message.guild.id}/${message.channel.id}`)
  );
  container.addActionRowComponents(linkRow);

  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  };
};

const createMessageLogContainer = (message, type, oldContent = null) => {
  const content = message.content?.length > 1024 ? message.content.slice(0, 1021) + '...' : message.content;
  const oldContentTruncated = oldContent?.length > 1024 ? oldContent.slice(0, 1021) + '...' : oldContent;

  const container = new ContainerBuilder();

  const linkButton = new ButtonBuilder()
    .setLabel('🔗 Ver no Canal')
    .setStyle(ButtonStyle.Link)
    .setURL(`https://discord.com/channels/${message.guild.id}/${message.channel.id}`);

  switch (type) {
    case 'edit':
      container
        .setTitle('✏️ Mensagem Editada')
        .addTextDisplayComponents(t => t.setContent(''))
        .addTextDisplayComponents(t => t.setContent(`**👤 Autor:** <@${message.author.id}>`))
        .addTextDisplayComponents(t => t.setContent(`**📍 Canal:** <#${message.channel.id}>`))
        .addTextDisplayComponents(t => t.setContent('────────────────────────────────────'))
        .addTextDisplayComponents(t => t.setContent(`**💭 Antes:**`))
        .addTextDisplayComponents(t => t.setContent(`${oldContentTruncated ? `\`\`\`diff\n- ${oldContentTruncated}\n\`\`\`` : '*(Sem texto)*'}`))
        .addTextDisplayComponents(t => t.setContent(''))
        .addTextDisplayComponents(t => t.setContent(`**💭 Depois:**`))
        .addTextDisplayComponents(t => t.setContent(`${content ? `\`\`\`diff\n+ ${content}\n\`\`\`` : '*(Sem texto)*'}`))
        .addTextDisplayComponents(t => t.setContent(''))
        .addTextDisplayComponents(t => t.setContent('*Sistema de Logs • Edição*'));
      break;

    case 'delete':
      container
        .setTitle('🗑️ Mensagem Excluída')
        .addTextDisplayComponents(t => t.setContent(''))
        .addTextDisplayComponents(t => t.setContent(`**👤 Autor:** <@${message.author.id}>`))
        .addTextDisplayComponents(t => t.setContent(`**📍 Canal:** <#${message.channel.id}>`))
        .addTextDisplayComponents(t => t.setContent('────────────────────────────────────'))
        .addTextDisplayComponents(t => t.setContent(`**💭 Conteúdo:**`))
        .addTextDisplayComponents(t => t.setContent(`${content ? `\`\`\`\n${content}\n\`\`\`` : '*(Mensagem sem texto — possivelmente apenas anexos)*'}`))
        .addTextDisplayComponents(t => t.setContent(''))
        .addTextDisplayComponents(t => t.setContent('*Sistema de Logs • Exclusão*'));
      linkButton.setLabel('🔗 Ver Canal');
      break;
  }

  if (message.attachments.size > 0) {
    const attachments = message.attachments.map(a => `[📎 Anexo](${a.url})`).join('\n');
    container
      .addSeparatorComponents(s => s)
      .addTextDisplayComponents(t => t.setContent(`**🖼️ Anexos:**\n${attachments}`));
  }

  container.setFooter(type === 'edit' ? 'Sistema de Logs • Edição' : 'Sistema de Logs • Exclusão');

  const actionRow = new ActionRowBuilder().addComponents(linkButton);
  container.addComponent(actionRow);
  return container;
};

const createStatusPayload = (logChannel) => {
  const text = [
    '# 📊 Status do Sistema de Logs',
    '',
    logChannel
      ? `✅ O sistema de logs está **ativo** no canal ${logChannel}.`
      : '⚠️ O sistema de logs **não está configurado**.',
    '',
    `*Sistema de Logs • Status*\n*${new Date().toLocaleString('pt-BR')}*`
  ].join('\n');
  return { content: text };
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('msglogs')
    .setDescription('Mostra o status do sistema de logs')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('Verifica o status do sistema de logs')),

  async execute(interaction) {
    const logChannel = interaction.guild.channels.cache.get(FIXED_LOG_CHANNEL_ID) ||
      interaction.guild.channels.cache.find(ch => ch.name === 'logs' || ch.name === 'registro');
    const payload = createStatusPayload(logChannel);
    await interaction.reply({ content: payload.content, ephemeral: true });
  },

  init: (client) => {
    const getLogChannel = (guild) => {
      return guild.channels.cache.get(FIXED_LOG_CHANNEL_ID) ||
        guild.channels.cache.find(ch => ch.name === 'logs' || ch.name === 'registro');
    };


    // ✏️ MENSAGEM EDITADA
    client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
      if (oldMessage.author?.bot) return;
      if (!oldMessage.content || !newMessage.content) return;
      if (oldMessage.content === newMessage.content) return;

      const logChannel = getLogChannel(newMessage.guild);
      if (!logChannel) return;

      try {
        const payload = createMessageLogPayloadV2(newMessage, 'edit', oldMessage.content);
        await logChannel.send(payload);
      } catch (err) {
        console.error('Falha ao construir/enviar log de edição:', err);
      }
    });

    // 🗑️ MENSAGEM EXCLUÍDA
    client.on(Events.MessageDelete, async (message) => {
      if (message.author?.bot) return;
      if (!message.content && message.attachments.size === 0) return;

      const logChannel = getLogChannel(message.guild);
      if (!logChannel) return;

      try {
        const payload = createMessageLogPayloadV2(message, 'delete');
        await logChannel.send(payload);
      } catch (err) {
        console.error('Falha ao construir/enviar log de exclusão:', err);
      }
    });
  }
};
