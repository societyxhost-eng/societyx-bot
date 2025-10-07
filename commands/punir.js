const { 
    SlashCommandBuilder, 
    PermissionFlagsBits, 
    ContainerBuilder, 
    MessageFlags 
} = require('discord.js');
const { logAction } = require('../utils/logger');

function parseDuration(input) {
    const regex = /^(\d+)\s*(s|sec|seg|m|min|h|hr|d|mes)$/i;
    const match = input.match(regex);
    if (!match) return null;

    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();

    switch(unit) {
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
        .setName('timeout')
        .setDescription('Aplica timeout em um usuário')
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('ID do usuário que você deseja punir')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('tempo')
                .setDescription('Tempo da punição (ex: 30s, 10min, 1h, 1d, 1mes)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('motivo')
                .setDescription('Motivo da punição')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction, client, targetUser = null, durationInput = null, reasonInput = null) {
        const user = targetUser || interaction.options.getUser('usuario');
        const timeString = durationInput || interaction.options.getString('tempo');
        const reason = reasonInput || interaction.options?.getString('motivo') || 'Não informado';

        const durationMs = parseDuration(timeString);
        if (!durationMs || durationMs > 28 * 24 * 60 * 60 * 1000) {
            const msg = '❌ Tempo inválido! Use algo como `30s`, `10min`, `1h`, `1d` ou `1mes` (máx 28 dias).';
            if (interaction.deferred || interaction.replied) await interaction.editReply({ content: msg });
            else await interaction.reply({ content: msg, ephemeral: true });
            return;
        }

        try {
            const member = await interaction.guild.members.fetch(user.id);
            if (!member.moderatable) {
                const msg = `❌ Não consigo punir **${user.tag}**.`;
                if (interaction.deferred || interaction.replied) await interaction.editReply({ content: msg });
                else await interaction.reply({ content: msg, ephemeral: true });
                return;
            }

            const container = new ContainerBuilder()
                .addTextDisplayComponents(td => td.setContent('# ⏳ Punição Temporária'))
                .addSeparatorComponents(separator => separator)
                .addTextDisplayComponents(td => td.setContent(
                    `Você recebeu **timeout** no servidor **${interaction.guild.name}**.\n` +
                    `🕐 Duração: ${timeString}\n📝 Motivo: ${reason}`
                ));

            await user.send({ components: [container], flags: [MessageFlags.IsComponentsV2] }).catch(() => {});

            await member.timeout(durationMs, reason);

            const successMsg = `✅ **${user.tag}** foi punido por ${timeString}.`;
            if (interaction.deferred || interaction.replied) await interaction.editReply({ content: successMsg });
            else await interaction.reply({ content: successMsg, ephemeral: true });

            await logAction(client, {
                action: "Timeout",
                moderator: interaction.user,
                target: user,
                reason,
                extra: `Duração: ${timeString}`
            });

        } catch (err) {
            console.error(err);
            const errorMsg = '❌ Ocorreu um erro ao tentar punir esse usuário.';
            if (interaction.deferred || interaction.replied) await interaction.editReply({ content: errorMsg });
            else await interaction.reply({ content: errorMsg, ephemeral: true });
        }
    }
};
