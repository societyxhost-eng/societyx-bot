const { Client, GatewayIntentBits, Collection, Events, ActivityType } = require('discord.js');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ] 
});


client.commands = new Collection();


const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));
    if (command.data && command.execute) {
        client.commands.set(command.data.name, command);
    }
}


const modalHandler = require('./commands/modal-handler');
modalHandler(client);


client.once(Events.ClientReady, c => {
    console.log(`🤖 Logado como ${c.user.tag}`);
    client.user.setPresence({
        activities: [{ name: 'discord.gg/societyx 💜', type: ActivityType.Playing }],
        status: 'dnd'
    });
});


client.on(Events.InteractionCreate, async interaction => {
    try {
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) return;

            await command.execute(interaction, client);
        }
    } catch (err) {
        console.error('Erro na interactionCreate:', err);

        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ Ocorreu um erro.', ephemeral: true });
        }
    }
});

client.login(process.env.TOKEN);
