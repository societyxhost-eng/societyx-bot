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

// Carrega os comandos
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'));

for (const file of eventFiles) {
  const eventModule = require(`./events/${file}`);
  if (typeof eventModule === 'function') {
    eventModule(client);
  }
}

for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));
    if (command.data && command.execute) client.commands.set(command.data.name, command);
}

// Evento pronto
client.once(Events.ClientReady, c => {
    console.log(`🤖 Logado como ${c.user.tag}`);
    client.user.setPresence({
        activities: [{ name: 'discord.gg/yvs 💜', type: ActivityType.Playing }],
        status: 'dnd'
    });
});

// Evento de interação (collect)
// Evento de interação
client.on(Events.InteractionCreate, async interaction => {
    // 🔹 Slash Commands
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;
        try { 
            await command.execute(interaction, client); 
        }
        catch (err) { 
            console.error(err); 
            await interaction.reply({ content: '❌ Erro ao executar comando.', ephemeral: true }); 
        }
    }

    // 🔹 Botões
});

client.login(process.env.TOKEN);