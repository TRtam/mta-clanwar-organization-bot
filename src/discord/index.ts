import { Client, Events, GatewayIntentBits } from "discord.js";
import clanwar_management from "./clanwar-management";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.on(Events.ClientReady, (client) => {
  console.log(`Logged in as ${client.user?.tag}`);
  clanwar_management(client);
});

export default function init() {
  client.login(process.env.MITICO_TOKEN);
}

export { client };
