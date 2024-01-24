///<reference path="../node_modules/@types/screeps/index.d.ts"/>
// example declaration file - remove these and add your own custom typings

// memory extension samples
interface CreepMemory {
    role: string;
    room: string;
    working?: boolean;
    sourceId?: string; // Add this line
    building?: boolean; // Add this line
    repairing?: boolean; // Add this line
    unloading?: boolean; // Add this line
    unload_target?: string|null; // Add this line
    needsRenewal?: boolean; // Add this line
}

interface Memory {
      uuid: number;
      log: any;
}

// `global` extension samples
declare namespace NodeJS {
    interface Global {
        log: any;
    }
}

interface Promise<T> {
    configureQuota(predicate: ((index: number) => boolean) | number): Promise<T>
}
