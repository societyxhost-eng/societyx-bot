require('dotenv/config');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

async function deployCommands() {
    const commands = [];
    const commandFiles = fs.readdirSync(path.join(__dirname, 'commands')).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
        const commandModule = require(`./commands/${file}`);
        // Se estiver exportando { data, execute } como CommonJS
        if (commandModule.data?.toJSON) {
            commands.push(commandModule.data.toJSON());
        } else {
            console.error(`O comando ${file} não possui data.toJSON()`);
        }
    }

    try {
        console.log('Atualizando comandos slash...');
        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commands }
        );
        console.log('Comandos atualizados!');
    } catch (error) {
        console.error(error);
    }
}

deployCommands();
