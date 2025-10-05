const { Events } = require('discord.js');
const { ContainerBuilder } = require('discord.js');

module.exports = (client) => {
  // Evento para mensagens criadas
  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;
    
    // Lógica para mensagens criadas, se necessário
  });

  // Evento para mensagens editadas
  client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
    if (oldMessage.author?.bot) return;
    if (oldMessage.content === newMessage.content) return;
    
    const guild = oldMessage.guild;
    if (!guild) return;
    
    const logChannel = getLogChannel(guild);
    if (!logChannel) return;
    
    // Usando EmbedBuilder em vez de ContainerBuilder para mensagens editadas
    const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
    
    const embed = new EmbedBuilder()
      .setTitle('Mensagem Editada')
      .setColor(0xFFA500) // Laranja
      .setAuthor({
        name: oldMessage.author?.tag || 'Usuário desconhecido',
        iconURL: oldMessage.author?.displayAvatarURL() || null
      })
      .addFields(
        { name: 'Canal', value: `<#${oldMessage.channel.id}>`, inline: true },
        { name: 'ID do Usuário', value: oldMessage.author?.id || 'Desconhecido', inline: true },
        { name: 'Mensagem Original', value: oldMessage.content || 'Sem conteúdo' },
        { name: 'Mensagem Editada', value: newMessage.content || 'Sem conteúdo' }
      )
      .setFooter({ text: `ID da Mensagem: ${oldMessage.id} • ${new Date().toLocaleString()}` });
    
    const button = new ButtonBuilder()
      .setLabel('Ver Canal')
      .setStyle(ButtonStyle.Link)
      .setURL(`https://discord.com/channels/${guild.id}/${oldMessage.channel.id}/${oldMessage.id}`);
    
    const row = new ActionRowBuilder().addComponents(button);
    
    await logChannel.send({ embeds: [embed], components: [row] });
  });

  // Evento para mensagens excluídas
  client.on(Events.MessageDelete, async (message) => {
    if (message.author?.bot) return;
    
    const guild = message.guild;
    if (!guild) return;
    
    const logChannel = getLogChannel(guild);
    if (!logChannel) return;
    
    const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
    
    const embed = new EmbedBuilder()
      .setTitle('Mensagem Excluída')
      .setColor(0xFF0000) // Vermelho
      .setAuthor({
        name: message.author?.tag || 'Usuário desconhecido',
        iconURL: message.author?.displayAvatarURL() || null
      })
      .addFields(
        { name: 'Canal', value: `<#${message.channel.id}>`, inline: true },
        { name: 'ID do Usuário', value: message.author?.id || 'Desconhecido', inline: true },
        { name: 'Conteúdo', value: message.content || 'Sem conteúdo' }
      )
      .setFooter({ text: `ID da Mensagem: ${message.id} • ${new Date().toLocaleString()}` });
    
    // Adicionar anexos, se houver
    if (message.attachments.size > 0) {
      const attachmentLinks = message.attachments.map(a => `[${a.name}](${a.url})`).join('\n');
      embed.addFields({ name: 'Anexos', value: attachmentLinks });
    }
    
    const button = new ButtonBuilder()
      .setLabel('Ver Canal')
      .setStyle(ButtonStyle.Link)
      .setURL(`https://discord.com/channels/${guild.id}/${message.channel.id}`);
    
    const row = new ActionRowBuilder().addComponents(button);
    
    await logChannel.send({ embeds: [embed], components: [row] });
  });
  
  // Canal de logs com ID específico
  const getLogChannel = (guild) => {
    return guild.channels.cache.get('1410325110488956989') || 
           guild.channels.cache.find(ch => ch.name === 'logs' || ch.name === 'registro');
  };
};