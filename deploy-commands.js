require('dotenv/config');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

async function deployCommands() {
    const commands = [];
    const commandsDir = path.join(__dirname, 'commands');
    const commandFiles = fs.readdirSync(commandsDir)
        .filter(file => file.endsWith('.js') && file !== 'modal-handler.js' && file !== 'messagelogs.js');

    for (const file of commandFiles) {
        const mod = require(path.join(commandsDir, file));
        if (mod.data?.toJSON) {
            commands.push(mod.data.toJSON());
            console.log(`✅ Comando carregado: ${file}`);
        } else {
            console.warn(`⚠️ ${file} não possui data.toJSON(), pulando.`);
        }
    }

    try {
        console.log('Atualizando comandos slash (guild)...');
        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commands }
        );
        console.log('Comandos atualizados!');
    } catch (error) {
        console.error('Erro ao atualizar comandos:', error);
    }
}

deployCommands();
