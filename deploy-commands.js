require('dotenv/config');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const {
  TOKEN,
  CLIENT_ID,
  GUILD_ID,
  DEPLOY_SCOPE = 'guild',
} = process.env;

if (!TOKEN || !CLIENT_ID || (DEPLOY_SCOPE === 'guild' && !GUILD_ID)) {
  console.error('✖ Env faltando. Necessário: TOKEN, CLIENT_ID' + (DEPLOY_SCOPE === 'guild' ? ', GUILD_ID' : ''));
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(TOKEN);

function loadSlashCommands(commandsDir) {
  const commands = [];
  const ignored = [];

  const files = fs
    .readdirSync(commandsDir, { withFileTypes: true })
    .filter(d => d.isFile() && d.name.endsWith('.js'))
    .map(d => d.name);

  for (const file of files) {
    const fullPath = path.join(commandsDir, file);

    delete require.cache[require.resolve(fullPath)];
    const mod = require(fullPath);

    if (mod?.data && typeof mod.data.toJSON === 'function') {
      commands.push(mod.data.toJSON());
    } else {
      ignored.push(file);
    }
  }

  return { commands, ignored };
}

async function deploy() {
  const commandsPath = path.join(__dirname, 'commands');
  const { commands, ignored } = loadSlashCommands(commandsPath);

  console.log(`Encontrados ${commands.length} comandos para publicar.`);
  if (ignored.length) {
    console.log(`Ignorados (${ignored.length}): ${ignored.join(', ')}`);
  }

  try {
    console.log(
      DEPLOY_SCOPE === 'global'
        ? 'Publicando comandos GLOBAIS... (podem levar até 1h para propagar)'
        : `Publicando comandos no servidor ${GUILD_ID}...`
    );

    const route =
      DEPLOY_SCOPE === 'global'
        ? Routes.applicationCommands(CLIENT_ID)
        : Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID);

    await rest.put(route, { body: commands });

    console.log('✔ Comandos atualizados!');
  } catch (err) {
    console.error('✖ Falha ao atualizar comandos:');
    console.error(err);
    process.exit(1);
  }
}

deploy();