const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { logAction } = require('../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('punir')
        .setDescription('Aplica timeout em um usuário')
        .addUserOption(option =>
            option.setName('usuário')
                .setDescription('Usuário que você deseja punir')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('tempo')
                .setDescription('Tempo da punição (ex: 30M para 30 minutos, 1D para 1 dia, máximo 28D)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('motivo')
                .setDescription('Motivo da punição')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        const user = interaction.options.getUser('usuário');
        const timeString = interaction.options.getString('tempo').toUpperCase();
        const reason = interaction.options.getString('motivo') || 'Não informado';

        // Converte tempo para milissegundos
        let timeoutDuration;
        try {
            const timeMatch = timeString.match(/^(\d+)([DM])$/);
            if (!timeMatch) throw new Error('Formato inválido');

            const value = parseInt(timeMatch[1]);
            const unit = timeMatch[2];

            if (unit === 'M') timeoutDuration = value * 60 * 1000; // minutos
            else if (unit === 'D') timeoutDuration = value * 24 * 60 * 60 * 1000; // dias
            else throw new Error('Unidade inválida');

            // Limita a 28 dias
            if (timeoutDuration > 28 * 24 * 60 * 60 * 1000) throw new Error('Tempo máximo: 28D');
        } catch (err) {
            return await interaction.reply({
                content: '❌ Tempo inválido! Use, por exemplo, `30M` para minutos ou `1D` para dias.',
                ephemeral: true
            });
        }

        try {
            const member = await interaction.guild.members.fetch(user.id);

            if (!member.moderatable) {
                return await interaction.reply({
                    content: `❌ Não consigo punir **${user.tag}**.`,
                    ephemeral: true
                });
            }

            await member.timeout(timeoutDuration, reason);
            await interaction.reply(`✅ **${user.tag}** foi punido por ${timeString}. Motivo: ${reason}`);

            logAction(interaction.client, {
    action: "Timeout",
    moderator: interaction.user,
    target: user,
    reason: `Punido por ${timeString}. Motivo: ${reason}`
});
        } catch (err) {
            console.error(err);
            await interaction.reply({
                content: '❌ Ocorreu um erro ao tentar punir esse usuário.',
                ephemeral: true
            });
        }
    }
};
