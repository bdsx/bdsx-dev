import { packetMap } from './packetmap';

export const PacketIdToType = packetMap;

export type PacketIdToType = {[key in keyof typeof PacketIdToType]:InstanceType<typeof PacketIdToType[key]>};

(PacketIdToType as any).__proto__ = null;
