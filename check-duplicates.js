const fs = require('fs');
const path = require('path');

const commandFiles = fs.readdirSync(path.join(__dirname, 'commands')).filter(f => f.endsWith('.js'));

const names = [];
const duplicates = [];

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    if (command.data?.name) {
        if (names.includes(command.data.name)) {
            duplicates.push(command.data.name);
        } else {
            names.push(command.data.name);
        }
    }
}

if (duplicates.length > 0) {
    console.log('❌ Comandos duplicados encontrados:', duplicates);
} else {
    console.log('✅ Nenhum comando duplicado encontrado!');
}
