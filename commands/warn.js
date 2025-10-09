const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const warningSystem = require('../utils/warningSystem');
const { logAction } = require('../utils/logger');
const { toast, EPHEMERAL_FLAG } = require('../utils/toast');

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

  async execute(interaction, client, targetUser = null, duration = null, reason = null) {
    try {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ flags: EPHEMERAL_FLAG });
      }
    } catch {}

    const user = targetUser || (interaction.options ? interaction.options.getUser('usuario') : null);
    const motivo = (reason ?? (interaction.options ? interaction.options.getString('motivo') : null) ?? '').trim() || 'Motivo não informado.';

    if (!user) {
      await toast(interaction, '❌ Usuário não encontrado.');
      return;
    }

    const guildId = interaction.guild.id;
    const { warning, totalWarnings } = warningSystem.addWarning(guildId, user.id, motivo);

    const dmEmbed = new EmbedBuilder()
      .setTitle('⚠️ Aviso de Moderação')
      .setDescription(`Você recebeu um **warning** no servidor **${interaction.guild.name}**.`)
      .setColor('#E67E22')
      .addFields(
        { name: '📝 Motivo', value: motivo },
        { name: '📊 Total de Warnings', value: `Agora você possui **${totalWarnings}** warning(s).` },
        { name: '👮‍♂️ Moderador', value: interaction.user.tag }
      )
      .setFooter({ text: `ID do Aviso: ${warning.id}` })
      .setTimestamp();

    await user.send({ embeds: [dmEmbed] }).catch(() => {
      console.log(`Não foi possível enviar DM para o usuário ${user.tag}.`);
    });

    await toast(interaction, `✅ Warning aplicado para ${user.tag} com sucesso! Ele(a) agora tem ${totalWarnings} warning(s).`);

    await logAction(client, {
      action: 'Warn',
      moderator: interaction.user,
      target: user,
      reason: motivo,
      extra: `Total de Warnings: ${totalWarnings}\nID do Warning: ${warning.id}`
    });
  }
};