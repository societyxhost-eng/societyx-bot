const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { logAction } = require('../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clearuser')
        .setDescription('Limpa mensagens de um usuário específico')
        .addUserOption(option =>
            option.setName('usuário')
                .setDescription('Usuário cujas mensagens serão deletadas')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('quantidade')
                .setDescription('Quantidade de mensagens para verificar (1-100)')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(100))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('usuário');
        const fetchAmount = interaction.options.getInteger('quantidade') || 50;

        try {
            await interaction.deferReply({ ephemeral: true });
            
            // Busca as mensagens
            const messages = await interaction.channel.messages.fetch({ limit: fetchAmount });
            
            // Filtra mensagens do usuário específico
            const userMessages = messages.filter(msg => msg.author.id === targetUser.id);
            
            if (userMessages.size === 0) {
                return await interaction.editReply({
                    content: `❌ Nenhuma mensagem de **${targetUser.tag}** foi encontrada nas últimas ${fetchAmount} mensagens.`
                });
            }
            
            // Deleta as mensagens
            await interaction.channel.bulkDelete(userMessages, true);
            
            await interaction.editReply({
                content: `✅ ${userMessages.size} mensagens de **${targetUser.tag}** foram deletadas.`
            });

            logAction(interaction.client, {
                action: "Clear",
                moderator: interaction.user,
                target: targetUser,
                reason: `${userMessages.size} mensagens deletadas no canal #${interaction.channel.name}`
            });

        } catch (err) {
            console.error(err);
            await interaction.editReply({
                content: '❌ Ocorreu um erro ao tentar deletar as mensagens do usuário.'
            });
        }
    }
};