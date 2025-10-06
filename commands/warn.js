const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const warningSystem = require('../utils/warningSystem');
const { logAction } = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Aplica um warning a um usuário')
    .addUserOption(option =>
      option.setName('usuario')
        .setDescription('Usuário que receberá o warning')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('motivo')
        .setDescription('Motivo do warning')
        .setRequired(true)
    ),

  async execute(interaction, client, targetUserParam = null) {
    const user = targetUserParam || interaction.options.getUser('usuario');
    const motivo = targetUserParam 
        ? interaction.fields.getTextInputValue('reason') 
        : interaction.options.getString('motivo') || 'Sem motivo';

    if (!user)
      return interaction.deferred || interaction.replied
        ? interaction.editReply({ content: '❌ Usuário não encontrado.' })
        : interaction.reply({ content: '❌ Usuário não encontrado.', ephemeral: true });

    const guildId = interaction.guild.id;
    const totalWarnings = warningSystem.addWarning(guildId, user.id, motivo);

    const dmEmbed = new EmbedBuilder()
      .setTitle('⚠ Aviso de Moderação')
      .setDescription(`Você recebeu um **warning** no servidor **${interaction.guild.name}**.`)
      .setColor('#C0392B')
      .addFields(
        { name: '👤 Usuário', value: `${user.tag}`, inline: true },
        { name: '🆔 ID do Usuário', value: `${user.id}`, inline: true },
        { name: '📝 Motivo', value: motivo, inline: false },
        { name: '📊 Total de Warnings', value: `${totalWarnings}`, inline: true },
        { name: '👮 Moderador', value: interaction.user.tag, inline: true }
      )
      .setFooter({ text: 'Sistema de Moderação', iconURL: client.user.displayAvatarURL() })
      .setTimestamp();

    await user.send({ embeds: [dmEmbed] }).catch(() => {});

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: `✅ Warning aplicado para ${user.tag} com sucesso!` });
    } else {
      await interaction.reply({ content: `✅ Warning aplicado para ${user.tag} com sucesso!`, ephemeral: true });
    }

    const logEmbed = new EmbedBuilder()
      .setTitle('⚠ Aviso Emitido')
      .setDescription(`Um warning foi registrado para **${user.tag}** no servidor **${interaction.guild.name}**.`)
      .setColor('#C0392B')
      .addFields(
        { name: '👤 Usuário', value: user.tag, inline: true },
        { name: '🆔 ID do Usuário', value: `${user.id}`, inline: true },
        { name: '📝 Motivo', value: motivo, inline: false },
        { name: '📊 Total de Warnings', value: `${totalWarnings}`, inline: true },
        { name: '👮 Moderador', value: interaction.user.tag, inline: true },
        { name: '🕒 Data/Hora', value: new Date().toLocaleString('pt-BR'), inline: false }
      )
      .setFooter({ text: 'Sistema de Moderação', iconURL: client.user.displayAvatarURL() })
      .setTimestamp();

    await logAction(client, {
      action: 'Warn',
      moderator: interaction.user,
      target: user,
      reason: motivo,
      extra: `Total de Warnings: ${totalWarnings}`,
      embed: logEmbed 
    });
  }
};
