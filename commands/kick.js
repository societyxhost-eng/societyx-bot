const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Expulsa um usuário do servidor')
        .addUserOption(option =>
            option.setName('usuário')
                .setDescription('Usuário que você deseja expulsar')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('motivo')
                .setDescription('Motivo da expulsão')
                .setRequired(false))
        // Apenas quem tem permissão de kick pode usar o comando
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

    async execute(interaction) {
        const user = interaction.options.getUser('usuário');
        const reason = interaction.options.getString('motivo') || 'Não informado';

        try {
            const member = await interaction.guild.members.fetch(user.id);

            // Verifica se o bot tem permissão
            if (!member.kickable) {
                return await interaction.reply({
                    content: `❌ Não consigo expulsar **${user.tag}**.`,
                    ephemeral: true
                });
            }

            await member.kick(reason);
            await interaction.reply(`✅ **${user.tag}** foi expulso. Motivo: ${reason}`);
        } catch (err) {
            console.error(err);
            await interaction.reply({
                content: '❌ Ocorreu um erro ao tentar expulsar esse usuário.',
                ephemeral: true
            });
        }
    }
};