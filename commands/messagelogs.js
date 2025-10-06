const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  Events,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('msglogs')
    .setDescription('Configura o sistema de logs de mensagens')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(subcommand =>
      subcommand
        .setName('configurar')
        .setDescription('Configura o canal de logs')
        .addChannelOption(option =>
          option.setName('canal')
            .setDescription('Canal onde os logs serão enviados')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('Verifica o status do sistema de logs')),

  async execute(interaction, client) {
    if (interaction.options.getSubcommand() === 'configurar') {
      const channel = interaction.options.getChannel('canal');
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('✅ Canal de Logs Configurado')
            .setDescription(`Os logs serão enviados em ${channel}.`)
            .setColor('#00BFFF')
            .setFooter({ text: 'Sistema de Logs • Configuração' })
            .setTimestamp()
        ],
        ephemeral: true
      });
    } else if (interaction.options.getSubcommand() === 'status') {
      const logChannel = interaction.guild.channels.cache.get('1424515588700639393') ||
        interaction.guild.channels.cache.find(ch => ch.name === 'logs' || ch.name === 'registro');

      const embed = new EmbedBuilder()
        .setTitle('📊 Status do Sistema de Logs')
        .setColor(logChannel ? '#00FF7F' : '#FF6347')
        .setDescription(
          logChannel
            ? `✅ O sistema de logs está **ativo** no canal ${logChannel}.`
            : '⚠️ O sistema de logs **não está configurado**.'
        )
        .setFooter({ text: 'Sistema de Logs • Status' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },

  init: (client) => {
    const getLogChannel = (guild) => {
      return guild.channels.cache.get('1424515588700639393') ||
        guild.channels.cache.find(ch => ch.name === 'logs' || ch.name === 'registro');
    };

    // 📩 NOVA MENSAGEM
    client.on(Events.MessageCreate, async (message) => {
      if (message.author?.bot) return;
      const logChannel = getLogChannel(message.guild);
      if (!logChannel) return;

      const content = message.content?.length > 1024 ? message.content.slice(0, 1021) + '...' : message.content;

      const embed = new EmbedBuilder()
        .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
        .setTitle('💬 Nova Mensagem Enviada')
        .setColor('#00FF7F')
        .addFields(
          { name: '👤 Autor', value: `<@${message.author.id}>`, inline: true },
          { name: '📍 Canal', value: `<#${message.channel.id}>`, inline: true },
          { name: '🆔 ID do Usuário', value: message.author.id, inline: false },
          { name: '💭 Conteúdo', value: content ? `\`\`\`\n${content}\n\`\`\`` : '*(Sem texto — apenas anexos)*' }
        )
        .setFooter({ text: `Enviada em ${new Date().toLocaleString('pt-BR')}` })
        .setTimestamp();

      if (message.attachments.size > 0) {
        const attachments = message.attachments.map(a => `[📎 Anexo](${a.url})`).join('\n');
        embed.addFields({ name: '🖼️ Anexos', value: attachments });
      }

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel('🔗 Ver no Canal')
          .setStyle(ButtonStyle.Link)
          .setURL(`https://discord.com/channels/${message.guild.id}/${message.channel.id}`)
      );

      await logChannel.send({ embeds: [embed], components: [row] });
    });

    // ✏️ MENSAGEM EDITADA
    client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
      if (oldMessage.author?.bot) return;
      if (!oldMessage.content || !newMessage.content) return;
      if (oldMessage.content === newMessage.content) return;

      const logChannel = getLogChannel(newMessage.guild);
      if (!logChannel) return;

      const original = oldMessage.content.length > 1024 ? oldMessage.content.slice(0, 1021) + '...' : oldMessage.content;
      const edited = newMessage.content.length > 1024 ? newMessage.content.slice(0, 1021) + '...' : newMessage.content;

      const embed = new EmbedBuilder()
        .setAuthor({ name: oldMessage.author.tag, iconURL: oldMessage.author.displayAvatarURL() })
        .setTitle('✏️ Mensagem Editada')
        .setColor('#FFA500')
        .addFields(
          { name: '👤 Autor', value: `<@${oldMessage.author.id}>`, inline: true },
          { name: '📍 Canal', value: `<#${oldMessage.channel.id}>`, inline: true },
          { name: '💭 Antes', value: `\`\`\`diff\n- ${original}\n\`\`\`` },
          { name: '💭 Depois', value: `\`\`\`diff\n+ ${edited}\n\`\`\`` }
        )
        .setFooter({ text: `Editada em ${new Date().toLocaleString('pt-BR')}` })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel('🔗 Ver no Canal')
          .setStyle(ButtonStyle.Link)
          .setURL(`https://discord.com/channels/${oldMessage.guild.id}/${oldMessage.channel.id}`)
      );

      await logChannel.send({ embeds: [embed], components: [row] });
    });

    // 🗑️ MENSAGEM EXCLUÍDA
    client.on(Events.MessageDelete, async (message) => {
      if (message.author?.bot) return;
      if (!message.content && message.attachments.size === 0) return;

      const logChannel = getLogChannel(message.guild);
      if (!logChannel) return;

      const content = message.content?.length > 1024 ? message.content.slice(0, 1021) + '...' : message.content;

      const embed = new EmbedBuilder()
        .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
        .setTitle('🗑️ Mensagem Excluída')
        .setColor('#FF4040')
        .addFields(
          { name: '👤 Autor', value: `<@${message.author.id}>`, inline: true },
          { name: '📍 Canal', value: `<#${message.channel.id}>`, inline: true },
          { name: '💭 Conteúdo', value: content ? `\`\`\`\n${content}\n\`\`\`` : '*(Mensagem sem texto — possivelmente apenas anexos)*' }
        )
        .setFooter({ text: `Excluída em ${new Date().toLocaleString('pt-BR')}` })
        .setTimestamp();

      if (message.attachments.size > 0) {
        const attachments = message.attachments.map(a => `[📎 Anexo](${a.url})`).join('\n');
        embed.addFields({ name: '🖼️ Anexos', value: attachments });
      }

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel('🔗 Ver Canal')
          .setStyle(ButtonStyle.Link)
          .setURL(`https://discord.com/channels/${message.guild.id}/${message.channel.id}`)
      );

      await logChannel.send({ embeds: [embed], components: [row] });
    });
  }
};
