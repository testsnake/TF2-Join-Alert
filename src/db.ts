import sqlite3 from 'better-sqlite3';
import logger from './logger';

const db = sqlite3('db.sqlite3');

enum NotificationType {
    cancel = 0,
    lmk = 1,
    always = 2
}

interface User {
    id: string;
    notifications: number;
}

const createTable = () => {
    try {
        db.exec(`
        CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        notifications INTEGER DEFAULT 0
        );
    `);
    } catch (e) {
        logger.error('FATAL ERROR: Could not create table.');
        logger.error(e);
        process.exit(1);
    }
};

const tableReady = createTable();

const statements = {
    addUser: db.prepare('INSERT INTO users (id) VALUES (?)'),
    removeUser: db.prepare('DELETE FROM users WHERE id = ?'),
    updateUser: db.prepare('UPDATE users SET notifications = ? WHERE id = ?'),
    getUser: db.prepare('SELECT * FROM users WHERE id = ?')
};

async function addUser(id: string) {
    const result = statements.addUser.run(id);
    if (result.changes === 0) {
        logger.error('Failed to add user');
    }
    return result;
}

async function removeUser(id: string) {
    const result = statements.removeUser.run(id);
    if (result.changes === 0) {
        logger.error('Failed to remove user');
    }
    return result;
}

async function updateUser(id: string, type: NotificationType) {
    const result = statements.updateUser.run(type, id);
    if (result.changes === 0) {
        logger.error('Failed to update user');
    }
    return result;
}

async function getUser(id: string): Promise<User | null> {
    const result = await statements.getUser.get(id);
    if (!result) {
        logger.error('User not found');
        return null;
    }

    const user: User | undefined = result as User;
    return user;
}

export { addUser, removeUser, updateUser, getUser, NotificationType, tableReady };
