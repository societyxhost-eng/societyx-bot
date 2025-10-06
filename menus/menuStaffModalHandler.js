const { ActionRowBuilder, TextInputStyle } = require('discord.js');

module.exports = async (interaction, client) => {
    try {
        const customIdParts = interaction.customId.split('_'); 
        const type = customIdParts[2];
        const reason = interaction.fields.getTextInputValue('reason');
        const time = type === 'timeout' ? interaction.fields.getTextInputValue('time').toUpperCase() : null;


        const user = interaction.user; 

        const commandName = type === 'timeout' ? 'punir' : type; 
        const command = client.commands.get(commandName);
        if (!command) return interaction.reply({ content: `❌ Comando ${commandName} não encontrado.`, ephemeral: true });

        const fakeInteraction = {
            ...interaction,
            options: {
                getUser: () => user,
                getString: key => key === 'motivo' ? reason : time
            },
            guild: interaction.guild
        };

        await command.execute(fakeInteraction, client);
        await interaction.reply({ content: '✅ Punição aplicada!', ephemeral: true });

    } catch (err) {
        console.error(err);
        await interaction.reply({ content: '❌ Erro ao aplicar punição.', ephemeral: true });
    }
};
