const { SlashCommandBuilder, PermissionFlagsBits, Events, ContainerBuilder } = require('discord.js');

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
     
      await interaction.reply({ content: `Canal de logs configurado para ${channel}`, ephemeral: true });
    } else if (interaction.options.getSubcommand() === 'status') {
      const logChannel = interaction.guild.channels.cache.get('1410325110488956989') || 
                         interaction.guild.channels.cache.find(ch => ch.name === 'logs' || ch.name === 'registro');
      if (logChannel) {
        await interaction.reply({ content: `Sistema de logs ativo no canal ${logChannel}`, ephemeral: true });
      } else {
        await interaction.reply({ content: 'Sistema de logs não configurado', ephemeral: true });
      }
    }
  },


  init: (client) => {

    const getLogChannel = (guild) => {
      return guild.channels.cache.get('1410325110488956989') || 
             guild.channels.cache.find(ch => ch.name === 'logs' || ch.name === 'registro');
    };

    // Mensagem criada
    client.on(Events.MessageCreate, async (message) => {
    if (message.author?.bot) return;

    const logChannel = getLogChannel(message.guild);
    if (!logChannel) return;

    const content = message.content.length > 1024 ? message.content.slice(0, 1021) + '...' : message.content;

    const container = new ContainerBuilder()
      .setTitle('📩 Nova Mensagem')
      .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
      .addFields([
        { name: 'Canal', value: `<#${message.channel.id}>`, inline: true },
        { name: 'ID do Usuário', value: message.author.id, inline: true },
        { name: 'Mensagem', value: `\`\`\`\n${content}\n\`\`\`` }
      ])
      .setFooter({ text: `Enviada em: ${new Date().toLocaleString('pt-BR')}` })
      .setColor('#00FF00')
      .addButton({
        label: 'Ver Canal',
        style: 'link',
        url: `https://discord.com/channels/${message.guild.id}/${message.channel.id}`,
        emoji: '🔍'
      });

    // Adicionar anexos se existirem
    if (message.attachments.size > 0) {
      const attachments = message.attachments.map(a => a.url).join('\n');
      container.addFields([{ name: 'Anexos', value: attachments.length > 1024 ? attachments.slice(0, 1021) + '...' : attachments }]);
    }

    await logChannel.send({ components: [container] });
  });

  // Mensagem editada
  client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
    if (oldMessage.author?.bot) return;
    if (!oldMessage.content || !newMessage.content) return;
    if (oldMessage.content === newMessage.content) return;

    const logChannel = getLogChannel(newMessage.guild);
    if (!logChannel) return;

    const original = oldMessage.content.length > 1024 ? oldMessage.content.slice(0, 1021) + '...' : oldMessage.content;
    const edited = newMessage.content.length > 1024 ? newMessage.content.slice(0, 1021) + '...' : newMessage.content;

    const container = new ContainerBuilder()
      .setTitle('🔄 Mensagem Editada')
      .setAuthor({ name: oldMessage.author.tag, iconURL: oldMessage.author.displayAvatarURL() })
      .addFields([
        { name: 'Canal', value: `<#${oldMessage.channel.id}>`, inline: true },
        { name: 'ID do Usuário', value: oldMessage.author.id, inline: true },
        { name: 'Mensagem Original', value: `\`\`\`\n${original}\n\`\`\`` },
        { name: 'Mensagem Editada', value: `\`\`\`\n${edited}\n\`\`\`` }
      ])
      .setFooter({ text: `Editada em: ${new Date().toLocaleString('pt-BR')}` })
      .setColor('#FFA500')
      .addButton({
        label: 'Ver Canal',
        style: 'link',
        url: `https://discord.com/channels/${oldMessage.guild.id}/${oldMessage.channel.id}`,
        emoji: '🔍'
      });

    await logChannel.send({ components: [container] });
  });

  // Mensagem deletada
  client.on(Events.MessageDelete, async (message) => {
    if (message.author?.bot) return;
    if (!message.content) return;

    const logChannel = getLogChannel(message.guild);
    if (!logChannel) return;

    const deletedContent = message.content.length > 1024 ? message.content.slice(0, 1021) + '...' : message.content;

    const container = new ContainerBuilder()
      .setTitle('🗑️ Mensagem Excluída')
      .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
      .addFields([
        { name: 'Canal', value: `<#${message.channel.id}>`, inline: true },
        { name: 'ID do Usuário', value: message.author.id, inline: true },
        { name: 'Conteúdo', value: `\`\`\`\n${deletedContent}\n\`\`\`` }
      ])
      .setFooter({ text: `Excluída em: ${new Date().toLocaleString('pt-BR')}` })
      .setColor('#FF0000')
      .addButton({
        label: 'Ver Canal',
        style: 'link',
        url: `https://discord.com/channels/${message.guild.id}/${message.channel.id}`,
        emoji: '🔍'
      });

    if (message.attachments.size > 0) {
      const attachments = message.attachments.map(a => a.url).join('\n');
      container.addFields([{ name: 'Anexos', value: attachments.length > 1024 ? attachments.slice(0, 1021) + '...' : attachments }]);
    }

    await logChannel.send({ components: [container] });
    });
  }
};
