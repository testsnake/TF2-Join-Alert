import 'source-map-support/register';
import logger from './logger';
import Koa from 'koa';
import dotenv from 'dotenv';
import { SteamBot } from './steamBot';
dotenv.config();

const PORT = process.env.PORT || 3000;
const app = new Koa();

const steamAuth = () => {
    if (process.env.REFRESH_TOKEN && process.env.REFRESH_TOKEN !== 'your_steam_refresh_token') {
        return {
            refreshToken: process.env.REFRESH_TOKEN
        };
    } else if (
        process.env.STEAM_ACCOUNT &&
        process.env.STEAM_PASSWORD &&
        process.env.STEAM_ACCOUNT !== 'your_steam_username' &&
        process.env.STEAM_PASSWORD !== 'your_steam_password'
    ) {
        return {
            accountName: process.env.STEAM_ACCOUNT,
            password: process.env.STEAM_PASSWORD
        };
    } else {
        logger.error('No Steam credentials provided');
        process.exit(1);
    }
};
const bot = new SteamBot(steamAuth(), logger);

app.use(async (ctx) => {
    const steamId = ctx.query.SteamID;
    if (steamId && typeof steamId === 'string' && steamId.match(/^\d{17}$/)) {
        ctx.body = await bot.sendAlert(steamId);
    } else {
        if (steamId) {
            ctx.status = 400;
            ctx.body = 'Invalid SteamID';
        } else {
            ctx.status = 400;
            ctx.body = 'No SteamID provided';
        }
    }
});

app.listen(PORT, () => {
    logger.info(`Server listening on port: ${PORT}`);
});
