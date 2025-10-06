const { resolveUser } = require('../utils/resolveUser'); 
const warnCommand = require('../commands/warn');
const kickCommand = require('../commands/kick');
const banCommand = require('../commands/ban');
const punirCommand = require('../commands/punir');
const { MessageFlags } = require('discord.js');

module.exports = (client) => {
    client.on('interactionCreate', async interaction => {
        if (!interaction.isModalSubmit()) return;
        if (!interaction.customId.startsWith('staff_modal_')) return;

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const action = interaction.customId.replace('staff_modal_', '');
        const userInput = interaction.fields.getTextInputValue('target_user');
        let durationInput;
        try { durationInput = interaction.fields.getTextInputValue('duration'); } catch {}

        const targetUser = await resolveUser(interaction.guild, userInput);
        if (!targetUser) {
            return interaction.editReply('❌ Usuário não encontrado. Verifique se o ID está correto e se o usuário está no servidor.');
        }

        try {
            switch (action) {
                case 'warn':
                    await warnCommand.execute(interaction, client, targetUser);
                    break;
                case 'kick':
                    await kickCommand.execute(interaction, client, targetUser);
                    break;
                case 'ban':
                    await banCommand.execute(interaction, client, targetUser);
                    break;
                case 'punir':
                    await punirCommand.execute(interaction, client, targetUser, durationInput);
                    break;
                default:
                    await interaction.editReply('❌ Ação inválida.');
                    return;
            }
        } catch (err) {
            console.error(err);
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content: '❌ Ocorreu um erro ao executar a ação.' });
            } else {
                await interaction.reply({ content: '❌ Ocorreu um erro ao executar a ação.', ephemeral: true });
            }
        }
    });
};