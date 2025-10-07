const { Client, GatewayIntentBits, Collection, Events, ActivityType } = require('discord.js');
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord.js');

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
        console.log(`✅ Comando carregado: ${file}`);
    } else {
        console.log(`ℹ️ Ignorando ${file} (não exporta { data, execute })`);
    }
    if (typeof command.init === 'function') {
        try {
            command.init(client);
            console.log(`🔧 Init aplicado para: ${file}`);
        } catch (err) {
            console.error(`Erro ao inicializar ${file}:`, err);
        }
    }
}


// Registrar comandos para a guild no startup
async function deployGuildCommands() {
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    const payload = [];

    const files = fs.readdirSync(commandsPath)
        .filter(f => f.endsWith('.js') && f !== 'modal-handler.js' && f !== 'messagelogs.js');

    for (const file of files) {
        const mod = require(path.join(commandsPath, file));
        if (mod.data?.toJSON) {
            payload.push(mod.data.toJSON());
        } else {
            console.warn(`⚠️ ${file} não possui data.toJSON(), pulando.`);
        }
    }

    console.log('Atualizando comandos slash (guild)...');
    await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
        { body: payload }
    );
    console.log('Comandos atualizados!');
}

// Handlers auxiliares
const modalHandler = require('./commands/modal-handler');
modalHandler(client);

// Eventos simples de logs com Container v2
const messageLogs = require('./events/messageLogs');
messageLogs(client);


client.once(Events.ClientReady, c => {
    console.log(`🤖 Logado como ${c.user.tag}`);
    client.user.setPresence({
        activities: [{ name: 'discord.gg/societyx 💜', type: ActivityType.Playing }],
        status: 'dnd',
    });

    // Auto-deploy no startup (SquareCloud-friendly)
    deployGuildCommands().catch(err => {
        console.error('Erro ao atualizar comandos:', err);
    });
});


client.on(Events.InteractionCreate, async interaction => {
    try {
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) return;
            await command.execute(interaction, client);
        }

        // Botões do menu VIP
        if (interaction.isButton()) {
            const vips = client.commands.get('vips');
            if (vips?.handleButton) {
                await vips.handleButton(interaction, client);
            }
        }
    } catch (err) {
        console.error('Erro na interactionCreate:', err);

        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ Ocorreu um erro.', ephemeral: true });
        }
    }
});

client.login(process.env.TOKEN);
