const { 
  SlashCommandBuilder, 
  PermissionFlagsBits, 
  EmbedBuilder 
} = require('discord.js');
const { logAction } = require('../utils/logger');
const { toast, EPHEMERAL_FLAG } = require('../utils/toast');

function parseDuration(input) {
  const regex = /^(\d+)\s*(s|sec|seg|m|min|h|hr|d|mes)$/i;
  const match = input?.match(regex);
  if (!match) return null;

  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  switch (unit) {
    case 's':
    case 'sec':
    case 'seg':
      return value * 1000;
    case 'm':
    case 'min':
      return value * 60 * 1000;
    case 'h':
    case 'hr':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    case 'mes':
      return value * 30 * 24 * 60 * 60 * 1000;
    default:
      return null;
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('punir')
    .setDescription('Aplica timeout em um usuário')
    .addUserOption(option =>
      option.setName('usuario')
        .setDescription('ID do usuário que você deseja punir')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('tempo')
        .setDescription('Tempo da punição (ex: 30s, 10min, 1h, 1d, 1mes)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('motivo')
        .setDescription('Motivo da punição')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction, client, targetUser = null, durationInput = null, reasonInput = null) {
    // Garante contexto efêmero
    try {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ flags: EPHEMERAL_FLAG });
      }
    } catch {}

    const user = targetUser || (interaction.options ? interaction.options.getUser('usuario') : null);
    const timeString = durationInput ?? (interaction.options ? interaction.options.getString('tempo') : null);
    const reason = (reasonInput ?? (interaction.options ? interaction.options.getString('motivo') : null) ?? '').trim() || 'Sem motivo';

    if (!user) {
      await toast(interaction, '❌ Usuário não encontrado.');
      return;
    }

    const durationMs = parseDuration(timeString);
    const MAX_TIMEOUT_MS = 28 * 24 * 60 * 60 * 1000;
    if (!durationMs || durationMs > MAX_TIMEOUT_MS) {
      await toast(interaction, '❌ Tempo inválido! Use algo como `30s`, `10min`, `1h` ou `1d` (máx 28 dias).');
      return;
    }

    try {
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);
      if (!member) {
        await toast(interaction, '❌ Usuário não está mais no servidor.');
        return;
      }

      if (!member.moderatable) {
        await toast(interaction, `❌ Não consigo punir ${user.tag}. Verifique hierarquia/permissões.`);
        return;
      }

      try {
        const dmEmbed = new EmbedBuilder()
          .setTitle('⏳ Punição Temporária')
          .setDescription(`Você recebeu **timeout** no servidor **${interaction.guild.name}**.`)
          .setColor('#9B59B6')
          .addFields(
            { name: '🕐 Duração', value: String(timeString) },
            { name: '📝 Motivo', value: String(reason) },
            { name: '👮‍♂️ Moderador', value: interaction.user.tag }
          )
          .setTimestamp();

        await user.send({ embeds: [dmEmbed] }).catch(() => {});
      } catch {}

      await member.timeout(durationMs, `${reason} • por ${interaction.user.tag}`);

      await logAction(client, {
        action: 'Timeout',
        moderator: interaction.user,
        target: user,
        reason,
        extra: `Duração: ${timeString}`,
      });

      await toast(interaction, `✅ ${user.tag} foi silenciado por ${timeString}.\n📝 Motivo: ${reason}`);

    } catch (err) {
      console.error('[PUNIR] Erro ao aplicar timeout:', err);
      await toast(interaction, '❌ Ocorreu um erro ao tentar punir esse usuário.');
    }
  }
};