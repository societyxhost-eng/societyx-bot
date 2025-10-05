const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { logAction } = require("../utils/logger");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unban')
        .setDescription('Desbane um usuário do servidor')
        .addStringOption(option =>
            option.setName('id')
                .setDescription('ID do usuário que você deseja desbanir')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    async execute(interaction) {
        const userId = interaction.options.getString('id');

        try {
            // Busca o usuário banido
            const bannedUser = await interaction.guild.bans.fetch(userId);

            if (!bannedUser) {
                return await interaction.reply({
                    content: '❌ Usuário não encontrado na lista de banidos.',
                    ephemeral: true
                });
            }

            await interaction.guild.members.unban(userId);
            await interaction.reply(`✅ **${bannedUser.user.tag}** foi desbanido.`);
            logAction(interaction.client, {
                action: "Unban",
                moderator: interaction.user,
                target: bannedUser.user,
                reason: "Desbanimento manual via comando"
            });
        } catch (err) {
            console.error(err);
            await interaction.reply({
                content: '❌ Ocorreu um erro ao tentar desbanir esse usuário. Verifique se o ID está correto.',
                ephemeral: true
            });
        }
    }
};

