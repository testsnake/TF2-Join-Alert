import { CommandInteraction, Interaction } from 'discord.js';
import wol, { WakeOptions } from 'wake_on_lan';
import ping from 'ping';

let devices: Devices;

type typePermission = 'wol' | 'ping';

type devicePermission = {
    [Key in typePermission]?: boolean;
};

type Device =
    | {
          id: string;
          name: string;
          network?: {
              macAddress?: string;
              ipAddress?: string;
          };
          permittedUsers: {
              id: string;
              permissions: devicePermission;
          }[];
      }
    | undefined;

type Devices = {
    list: Device[];
};

async function getDevices(): Promise<void> {
    // Load devices from json
}

enum ActionResult {
    Success = 'success',
    DeviceNotFound = 'devicenotfound',
    PermissionDenied = 'permissiondenied',
    ActionFailed = 'actionfailed'
}

function searchDevices(
    searchText: string,
    userId: string,
    requiredPermissions: devicePermission
): { name: string; value: string }[] {
    const search = searchText.toLowerCase();
    return devices.list
        .filter((device: any) => {
            // Check device name
            const isMatch = device.name.toLowerCase().includes(search);

            // Permission check
            const userHasPermission = permissionCheck(device, userId, requiredPermissions);

            return isMatch && userHasPermission;
        })
        .map((device: any) => ({
            name: device.name,
            value: device.id
        }));
}

async function wake(
    deviceId: string,
    interaction: Interaction | CommandInteraction,
    requiredPermissions: devicePermission
): Promise<{ result: ActionResult; device?: string; mac?: string }> {
    const device: Device = getDevices().list.find((device: any) => device.id === deviceId);
    if (!device) {
        return { result: ActionResult.DeviceNotFound };
    }
    // permission check
    const userHasPermission = permissionCheck(device, interaction.user.id, requiredPermissions);

    // Fake device not found to avoid leaking device information
    if (!userHasPermission) {
        return { result: ActionResult.DeviceNotFound };
    }
    try {
        const options: WakeOptions = {
            address: device.network.ipAddress
        };

        wol.wake(device.network.macAddress, options, (error: any) => {
            if (error) {
                throw new Error('Failed to wake device');
            } else {
                return;
            }
        });
        return {
            result: ActionResult.Success,
            device: device.name,
            mac: device.network.macAddress
        };
    } catch (error) {
        return {
            result: ActionResult.ActionFailed,
            device: device.name,
            mac: device.network.macAddress
        };
    }
}

async function sendPing(
    deviceId: string,
    interaction: Interaction | CommandInteraction,
    requiredPermissions: devicePermission
): Promise<ping.PingResponse | ActionResult> {
    const device: Device = devices.list.find((device: any) => device.id === deviceId);
    if (!device) {
        return ActionResult.DeviceNotFound;
    }

    // permission check
    const userHasPermission = permissionCheck(device, interaction.user.id, requiredPermissions);

    // Fake device not found to avoid leaking device information
    if (!userHasPermission) {
        return ActionResult.DeviceNotFound;
    }

    // Ping the device
    const result = await ping.promise.probe(device.network.ipAddress);
    return result;
}

function permissionCheck(device: Device, userId: string, requiredPermissions: devicePermission): boolean {
    if (!device) {
        return false;
    }
    const userHasPermission = device.permittedUsers.some((user: any) => {
        const isUser = user.id === userId;
        let hasPermissions = isUser;
        if (isUser) {
            for (const [permission, isRequired] of Object.entries(requiredPermissions)) {
                // Permission is required but user does not have it
                if (isRequired && !user.permissions[permission]) {
                    hasPermissions = false;
                    break; // Exit loop early
                }
            }
        }
        return hasPermissions;
    });
    return userHasPermission;
}

export { getDevices, searchDevices, wake, sendPing, devicePermission, ActionResult };
