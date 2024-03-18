// Self contained steam bot

import SteamUser from 'steam-user';
import { addUser, updateUser, getUser, NotificationType } from './db';
import prompts from 'prompts';

type SteamBotLogging = {
    error: (message: string) => void;
    warn: (message: string) => void;
    info: (message: string) => void;
    debug: (message: string) => void;
};

type SteamCredentials =
    | {
          accountName: string;
          password: string;
      }
    | {
          refreshToken: string;
      };

type ctxResponse = {
    message: string;
    status: number;
};

const CommandPrefix = '!';
const CommandPattern = new RegExp(`^${CommandPrefix}(.*)`);

class SteamBot {
    private client: SteamUser;
    private l: SteamBotLogging;
    private limitations: { [key: string]: number } = {};

    constructor(credentials: SteamCredentials, logger: SteamBotLogging = console) {
        let client = new SteamUser();
        try {
            client.logOn(credentials);
        } catch (err) {
            logger.error(`Error logging into Steam: ${err}`);
            process.exit(1);
        }

        this.l = logger;

        // Logon success
        client.on('loggedOn', () => {
            this.l.info(`Logged into Steam as ${client?.steamID?.getSteam3RenderedID()}`);
            client.setPersona(SteamUser.EPersonaState.Online);
        });

        client.on('steamGuard', async (domain, callback, lastCodeWrong) => {
            // TODO: Implement Proper OTP handling

            if (lastCodeWrong) {
                this.l.warn('Last OTP was wrong');
            }

            let message = domain
                ? `Steam Guard code needed from your email at ${domain}`
                : 'Steam Guard code needed to continue';
            message += lastCodeWrong ? ' (last code was wrong)' : '';

            const code = await prompts({
                type: 'text',
                name: 'otp',
                message: message,
                validate: (value) => (value.length === 5 ? true : 'OTP must be 5 characters')
            });

            this.l.debug(`Steam Guard code entered: ${code.otp}`);

            callback(code.otp);
        });

        // Error handling
        client.on('error', (err) => {
            this.l.error(`Steam error: ${err.message}`);
        });

        // Account limitations
        client.on('accountLimitations', (limited, communityBanned, locked, canInviteFriends) => {
            let limitations = [];

            if (limited) {
                limitations.push('LIMITED');
            }

            if (communityBanned) {
                limitations.push('COMMUNITY BANNED');
            }

            if (locked) {
                limitations.push('LOCKED');
            }

            if (limitations.length === 0) {
                this.l.debug('Account has no limitations.');
            } else {
                this.l.warn('Account is ' + limitations.join(', ') + '.');
            }

            if (canInviteFriends) {
                this.l.debug('Account can invite friends.');
            }
        });

        // Disconnected
        client.on('disconnected', (eresult, msg) => {
            this.l.warn(`Disconnected from Steam. Reason: ${msg}`);
        });

        // Auto accept friend requests
        client.on('friendRelationship', (steamID, relationship) => {
            if (relationship === 2) {
                client.addFriend(steamID);
                this.l.info(`Accepted friend request from: ${steamID}`);
            }
        });

        // All Chat Events
        // TODO: refactor to be less spaghetti
        client.chat.on('friendMessage', (message) => {
            // Message is chat message
            if (message.chat_entry_type === 1) {
                const steamID = message.steamid_friend.getSteamID64();
                this.l.info(`Chat message from: ${steamID}\n${message.message}`);
                // Check that message is a command
                const messageText = message.message.toLowerCase().match(CommandPattern);
                if (messageText) {
                    const command = messageText[1]; // Command
                    this.l.info(`Command: ${command}`);

                    // Handle command
                    return this.handleCommand(command, steamID);
                }
            }
        });

        this.client = client;
    }

    async handleCommand(command: string, steamId: string): Promise<void> {
        try {
            const user = getUser(steamId);
            if (!user) {
                addUser(steamId);
            }
            switch (command) {
                case 'ping':
                    this.client.chat.sendFriendMessage(steamId, 'pong');
                    break;
                case 'help':
                    this.client.chat.sendFriendMessage(
                        steamId,
                        `[h1]Avalible Commands[/h1]
                        [list]
                        [*] [b]!ping[/b] - pong
                        [*] [b]!help[/b] - this message
                        [*] [b]!lmk[/b] - Get messaged next time you join
                        [*] [b]!always[/b] - Get messaged every time you join
                        [*] [b]!cancel[/b] - Cancel !lmk or !always
                        [/list]
                        `
                    );
                    break;
                case 'lmk':
                    await updateUser(steamId, NotificationType.lmk);
                    this.client.chat.sendFriendMessage(steamId, 'You will be messaged next time you join');
                    break;
                case 'always':
                    await updateUser(steamId, NotificationType.always);
                    this.client.chat.sendFriendMessage(steamId, 'You will be messaged every time you join');
                    break;
                case 'cancel':
                    await updateUser(steamId, NotificationType.cancel);
                    this.client.chat.sendFriendMessage(steamId, 'You will no longer be messaged when you join');
                    break;
                default:
                    this.client.chat.sendFriendMessage(steamId, 'Invalid command use !help for a list of commands');
                    break;
            }
        } catch (err) {
            this.l.error(`An error occured: ${err}`);
            this.client.chat.sendFriendMessage(steamId, 'An error occured');
        }
    }

    async sendAlert(steamId: string): Promise<ctxResponse> {
        try {
            const user = await getUser(steamId);
            if (!user) {
                return { message: 'User not found', status: 404 };
            }

            if (user.notifications === NotificationType.cancel) {
                return { message: 'User has notifications disabled', status: 200 };
            }

            this.client.chat.sendFriendMessage(steamId, 'You have been alerted');

            if (user.notifications === NotificationType.lmk) {
                await updateUser(steamId, NotificationType.cancel);
            }

            return { message: 'Alert sent', status: 200 };
        } catch (err) {
            this.l.error(`An error occured: ${err}`);
            return { message: 'An error occured', status: 500 };
        }
    }
}

export { SteamBot, SteamCredentials, SteamBotLogging };
