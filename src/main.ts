import PromisePoly from "./polyfills/promisepolyfill";
import { ErrorMapper } from "utils/ErrorMapper";
import { AsyncLoop } from "utils/AsyncLoop";

let bool = false;

// promise resolves in three ticks
async function delayFn() {
    // occurs synchronous
    console.log("Resolving promise.");
    await PromisePoly.delay(1);
    await PromisePoly.delay(1);
    await PromisePoly.delay(1);
    return "Resolved promise";
}

let p:any = null;

const asl = new AsyncLoop();

async function mainAsync() {
    // yield to make async immediately
    await PromisePoly.yield();
    // let the promise run in the background
    p = delayFn().configureQuota(5);
    // initiate an interval to print every four ticks
    setInterval(() => { console.log("Scheduled task"); }, 4);

    // wait for the promise to finish
    console.log(`${await p}`);
    console.log(`after three ticks.`);
};



asl.usedCpuFn = (index) => index;
asl.quotaFn = () => 100;

const wrappedLoop = asl.wrapAsyncLoop(async (time) => {
    // Game.time might increment within an async function if a the function's continuation happens on the next tick.
    // As help, time is passed internally at the start of the tick and remains the same throughout the async function's runtime.
    console.log(`Current asynchronous game tick is ${time}`);

    if (bool) return;
    bool = true;

    let mainPromise = mainAsync();
    mainPromise.configureQuota(20);
    await mainPromise;
});

for (let index = 0; index < 20; index++) {
    wrappedLoop();
}

// When compiling TS to JS and bundling with rollup, the line numbers and file names in error messages change
// This utility uses source maps to get the line numbers and file names of the original, TS source code
export const loop = ErrorMapper.wrapLoop(() => {
    console.log(`Current game tick is ${Game.time}`);

    manageRooms();

    // run asynchronous loop
    wrappedLoop();
});

function manageRooms() {
    for (const roomName in Game.rooms) {
        const room: Room = Game.rooms[roomName];
        if (!room.controller || !room.controller.my) {
            continue; // Skip rooms you don't control
        }

        // Resource Management
        console.log(`Managing Energy Resources: ${Game.time}`);
        manageEnergySources(room);

        // Manage Upgrades

        // Spawning Creeps
        manageCreepSpawning(room);

        manageCreepDecay(room);



        // Construction and Repair
        manageConstructionAndRepair(room);
        manageUpgraderScreeps(room);

        // Room Defense
        manageRoomDefense(room);

        // Other Room-specific logic...
    }
}

function manageCreepDecay(room: Room): void {
    room.find(FIND_MY_CREEPS).forEach(creep => {
        if (creep.ticksToLive && creep.ticksToLive < 100) { // threshold can be adjusted
            const spawns = room.find(FIND_MY_SPAWNS);
            if (spawns.length > 0) {
                const nearestSpawn = creep.pos.findClosestByPath(spawns);
                if (nearestSpawn) {
                    if (nearestSpawn.renewCreep(creep) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(nearestSpawn);
                    }
                }
            }
        }
    });

    // Additional logic to handle creep spawning if needed
    // ...
}

function handleConstructionSites(room: Room) {
    const constructionSites = room.find(FIND_CONSTRUCTION_SITES);

    if (constructionSites.length) {
        // Logic to assign creeps to construction sites
        // For example: Find idle builder creeps and assign them to the nearest construction site
        const builders = room.find(FIND_MY_CREEPS, {
            filter: (creep) => creep.memory.role === 'builder' && creep.store[RESOURCE_ENERGY] > 0
        });

        if (builders.length) {
            builders.forEach(builder => {
                if (builder.pos.getRangeTo(constructionSites[0]) > 3) {
                    builder.moveTo(constructionSites[0]);
                } else {
                    builder.build(constructionSites[0]);
                }
            });
        }
    }
}

function handleRepairs(room: Room) {
    const structuresNeedingRepair = room.find(FIND_STRUCTURES, {
        filter: (structure) => structure.hits < structure.hitsMax && structure.structureType !== STRUCTURE_WALL
    });

    if (structuresNeedingRepair.length) {
        // Logic to assign creeps to repair tasks
        // For example: Find idle repairer creeps and assign them to the nearest structure that needs repair
        const repairers = room.find(FIND_MY_CREEPS, {
            filter: (creep) => creep.memory.role === 'repairer' && creep.store[RESOURCE_ENERGY] > 0
        });

        if (repairers.length) {
            repairers.forEach(repairer => {
                if (repairer.pos.getRangeTo(structuresNeedingRepair[0]) > 3) {
                    repairer.moveTo(structuresNeedingRepair[0]);
                } else {
                    repairer.repair(structuresNeedingRepair[0]);
                }
            });
        }
    }
}


function manageRoomDefense(room: Room) {

    const towers = room.find(FIND_MY_STRUCTURES, {
        filter: (s): s is StructureTower => s.structureType === STRUCTURE_TOWER
    });

    for (const tower of towers) {
        const closestHostile = tower.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
        if (closestHostile) {
            tower.attack(closestHostile);
        } else {
            // Optionally, use towers for repair if there are no hostiles
            const closestDamagedStructure = tower.pos.findClosestByRange(FIND_STRUCTURES, {
                filter: (structure) => structure.hits < structure.hitsMax
            });
            if (closestDamagedStructure) {
                tower.repair(closestDamagedStructure);
            }
        }
    }

    // Optionally, spawn defensive creeps if hostiles are detected
    const hostiles = room.find(FIND_HOSTILE_CREEPS);
    if (hostiles.length > 0) {
        // Implement your logic to spawn defensive creeps
        // Example: spawnDefenderCreeps(room);
    }
}

function spawnDefenderCreeps(room: Room) {
    const hostiles = room.find(FIND_HOSTILE_CREEPS);
    const spawns = room.find(FIND_MY_SPAWNS);

    // Only proceed if there are hostiles and available spawns
    if (hostiles.length > 0 && spawns.length > 0) {
        const spawn = spawns[0]; // Using the first spawn for simplicity

          // Determine the type of defender creep to spawn
        const body = [TOUGH, ATTACK, MOVE, MOVE]; // Example body parts

          // Check if the spawn is free and if you have enough energy
        if (spawn.spawning === null && room.energyAvailable >= energyCost(body)) {
            const creepName = `Defender_${Game.time}`; // Unique name for the creep
            spawn.spawnCreep(body, creepName, {
                memory: {
                    role: 'defender',
                    room: room.name,
                    working: false // Include the 'working' property
                }
            });
        }
      }
}

// Function to calculate the energy cost of a creep body
function energyCost(body: BodyPartConstant[]): number {
    return body.reduce((cost, part) => cost + BODYPART_COST[part], 0);
}


function manageEnergySources(room: Room) {
    // Find energy sources in the room
    const sources = room.find(FIND_SOURCES);
    console.log(`Found Sources: ` + sources.length);
    let spawned = false;

    // Assign creeps to each energy source
    sources.forEach(source => {
        // Find creeps that are assigned to this source
        const harvesters = room.find(FIND_MY_CREEPS, {
            filter: (creep) => creep.memory.role === 'harvester' && creep.memory.sourceId === source.id
        });
        if (harvesters.length > 0) {
            console.log(`...Harvesters: ` + harvesters.length);
        }

        // Here we're getting the estimated number of harvesters needed for this source
        // Check distance from the nearest spawn
        const spawn = room.find(FIND_MY_SPAWNS)[0];
        let distance = 0;
        if (spawn) {
            distance = spawn.pos.findPathTo(source).length;
        }
        let spots = 0;
        // loop through -1, 0, 1
        for (let x = -1; x < 2; x++) {
            // loop through -1, 0, 1
            for (let y = -1; y < 2; y++) {
                // if the spot is not a wall
                if (room.lookAt(source.pos.x + x, source.pos.y + y)[0].terrain !== 'wall') {
                    // increment the distance
                    spots++;
                }
            }
        }
        // Calculate the max number of harvesters needed for this source
        let max_harvesters: number = 0;
        const controller = room.controller;
        if (controller != undefined) {
            if (controller.level == 1) {
                max_harvesters = spots * (Math.floor(distance / 25)) + 1;
            } else {
                max_harvesters = spots * (Math.floor(distance / 25)) + 1;
            }
        } else {
            max_harvesters = spots * (Math.floor(distance / 25) + 1);
            console.log("I was aboutta spawn a harvester but there is no controller to base the model off of");
        }


        // Check if there are enough harvesters for this source
        if (harvesters.length <= max_harvesters && !spawned) { // Adjust the number as needed
            spawnHarvester(room, source.id);
            console.log(`... Needs Harvester, Max  `+ String(harvesters.length) +`, spawning... `);
            spawned = true;
        }

        // Logic for each harvester to harvest energy
        harvesters.forEach(harvester => {
            if (harvester.store.getFreeCapacity(RESOURCE_ENERGY) > 0 && !harvester.memory.unloading) {
                console.log("...Moving towards target...");
                if (!harvester.pos.isNearTo(source)) {
                    harvester.moveTo(source);
                } else {
                    harvester.harvest(source);
                }
            } else {
                if (harvester.store[RESOURCE_ENERGY] === 0) {
                    harvester.memory.unloading = false;
                    harvester.memory.unload_target = null;
                } else {
                    harvester.memory.unloading = true;
                    console.log("...Moving towards Repo...");

                    let target = findEnergyDeliveryTarget(room, harvester);
                    if (target) {
                        harvester.memory.unload_target = target.id;
                    }

                    if (target) {
                        if (target instanceof ConstructionSite) {
                            if (harvester.build(target) === ERR_NOT_IN_RANGE) {
                                harvester.moveTo(target);
                            }
                        } else if (target instanceof Structure) {
                            if (harvester.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                                harvester.moveTo(target);
                            }
                        }
                    }
                }
            }
        });
    });
}

function spawnHarvester(room: Room, sourceId: Id<Source>) {
    // Define the body parts for the harvester creep
    // Check current upgrade level
    const controller = room.controller;
    type BodyPart = typeof WORK | typeof CARRY | typeof MOVE;



    let body: BodyPart[] = [];
    let energyCapacityAvailable = 0;
    if (controller != undefined) {
        if (controller.level == 1) {
            body = [WORK, CARRY, MOVE];
        } else {
            // check how many extensions we have
            const extensions = room.find(FIND_MY_STRUCTURES, {
              filter: (structure) => structure.structureType === STRUCTURE_EXTENSION
            });
            switch (extensions.length) {
                case 0:
                    body = [WORK, CARRY, CARRY, MOVE, MOVE];
                    break;
                case 1:
                    body = [WORK, CARRY, CARRY, MOVE, MOVE];
                    break;
                case 2:
                    body = [WORK, WORK, CARRY, CARRY, MOVE, MOVE];
                    break;
                case 3:
                    body = [WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE];
                    break;
                case 4:
                    body = [WORK, WORK, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE];
                    break;
                case 5:
                    body = [WORK, WORK, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE];
                    break;
                default:
                    body = [WORK, CARRY, MOVE];
                    break;
            }
        }
    } else {
        console.log("I was aboutta spawn a harvester but there is no controller to base the model off of");
    }

    // Create a unique name for the harvester
    const name = 'Harvester_' + Game.time;

    // Memory object to assign to the new creep
    const memory = {
        role: 'harvester',
        sourceId: sourceId,
        working: false,
        room: room.name
    };

    // Spawn the harvester at the room's spawn
    // You might have multiple spawns; ensure to select an appropriate one
    const spawns = room.find(FIND_MY_SPAWNS);
    if(spawns.length > 0) {
        // console log the cost of the creep
        console.log(`Cost of ${name}: ${energyCost(body)}`);
        spawns[0].spawnCreep(body, name, { memory: memory });
    }
}

// Additional logic to be implemented elsewhere
function manageCreepStates(creep: Creep) {
    if (creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) {
        creep.memory.working = false;
    } else if (!creep.memory.working && creep.store.getFreeCapacity() === 0) {
        creep.memory.working = true;
    }
}

function findEnergyDeliveryTarget(room: Room, creep: Creep): Structure | ConstructionSite | null {
    // Check if a target is already stored in memory and is still valid
    if (creep.memory.unload_target) {
        const possibleTarget = Game.getObjectById(creep.memory.unload_target);
        if (possibleTarget instanceof Structure || possibleTarget instanceof ConstructionSite) {
            // and check if has room
            if (isValidTarget(possibleTarget)) {
                return possibleTarget;
            }
        }
        // Clear the memory if the stored target is no longer valid
        creep.memory.unload_target = null;
    }

    // Define a list of target finders in order of priority
    const targetFinders = [
        () => findStructuresWithFreeCapacity(room, [STRUCTURE_SPAWN, STRUCTURE_EXTENSION]),
        () => findStructuresWithFreeCapacity(room, [STRUCTURE_TOWER]),
        () => findConstructionSites(room, [STRUCTURE_EXTENSION]),
        () => findConstructionSitesOnSwamp(room),
        () => room.controller && room.controller.my && room.controller.level < 5 ? room.controller : null,
        () => room.storage && room.storage.store.getFreeCapacity(RESOURCE_ENERGY) > 0 ? room.storage : null
    ];

    // Iterate over the target finders and return the first valid target
    for (const findTarget of targetFinders) {
        const target = findTarget();
        if (target) {
            // Save the target in memory for future reference
            creep.memory.unload_target = target.id;
            return target;
        }
    }

    return null;
}

function isValidTarget(target: Structure | ConstructionSite): boolean {
    if (target instanceof ConstructionSite) {
        return true;
    }

    if (target instanceof StructureExtension ||
        target instanceof StructureSpawn ||
        target instanceof StructureTower ||
        target instanceof StructureStorage ||
        target instanceof StructureContainer) {
        return target.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
    }

    return false;
}

function findStructuresWithFreeCapacity(room: Room, types: StructureConstant[]): Structure | null {
    return room.find(FIND_STRUCTURES, {
        filter: (structure) => {
            if (!types.includes(structure.structureType)) {
                return false;
            }

            return structure instanceof StructureExtension ||
            structure instanceof StructureSpawn ||
            structure instanceof StructureTower ||
            structure instanceof StructureStorage ||
            structure instanceof StructureContainer
                ? structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
                : false;
        }
    })[0] || null;
}


function findConstructionSites(room: Room, types: BuildableStructureConstant[]): ConstructionSite | null {
    return room.find(FIND_CONSTRUCTION_SITES, {
        filter: (cs) => types.includes(cs.structureType)
    })[0] || null;
}

function findConstructionSitesOnSwamp(room: Room): ConstructionSite | null {
    return room.find(FIND_CONSTRUCTION_SITES, {
        filter: (cs) => cs.structureType === STRUCTURE_ROAD &&
            room.lookForAt(LOOK_TERRAIN, cs.pos.x, cs.pos.y)[0] === 'swamp'
    })[0] || null;
}



function manageUpgraderScreeps(room: Room) {
    // Find upgrader creeps in the room
    const upgraders = room.find(FIND_MY_CREEPS, {
        filter: (creep) => creep.memory.role === 'upgrader'
    });

    // Find the Controller in the room
    const controller = room.controller;

    // Assign upgrader creeps to the Controller
    upgraders.forEach(upgrader => {


        if (upgrader.memory.unloading) {
            if (controller !== undefined) {
                if (upgrader.upgradeController(controller) === ERR_NOT_IN_RANGE) {
                    upgrader.moveTo(controller);
                } else {
                    upgrader.upgradeController(controller);
                }
            } else {
                console.log("No controller found");
            }
            // if empty switch to non-unloading
            if (upgrader.store[RESOURCE_ENERGY] === 0) {
                upgrader.memory.unloading = false;
            }
        } else {
            // find the nearest source
            const source = upgrader.pos.findClosestByPath(FIND_SOURCES);
            if (source) {
                if (upgrader.harvest(source) === ERR_NOT_IN_RANGE) {
                    upgrader.moveTo(source);
                }
            }
            // if full, switch to unloading
            if (upgrader.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
                upgrader.memory.unloading = true;
            }
        }
    });
}

function manageCreepSpawning(room: Room) {
    const maxHarvesters = 5;
    const maxUpgraders = 1;
    const maxBuilders = 2;

    const harvesters = room.find(FIND_MY_CREEPS, {
        filter: (creep) => creep.memory.role === 'harvester'
    });

    const upgraders = room.find(FIND_MY_CREEPS, {
        filter: (creep) => creep.memory.role === 'upgrader'
    });

    const builders = room.find(FIND_MY_CREEPS, {
        filter: (creep) => creep.memory.role === 'builder'
    });

    if (harvesters.length < maxHarvesters) {
        // spawnCreep(room, 'harvester');
        console.log("Would produce harvester here but not because already doing that in energy");
    } else if (upgraders.length < maxUpgraders) {
        spawnCreep(room, 'upgrader');
    } else if (builders.length < maxBuilders) {
        spawnCreep(room, 'builder');
    }
}

function spawnCreep(room: Room, role: string, memory: CreepMemory = {
  role: role,
  room: room.name,
  working: false,  // Ensure this property is included
  unloading: false
}) {
    let body = [WORK, CARRY, MOVE]; // Customize as needed
    const newName = `${role}-${Game.time}`; // Unique name for the new creep

    console.log(`Spawning new ${role}: ${newName}`);

    if (role == "builder") {
        if (room.controller && room.controller.level > 1) {
            // check how many extensions we have
            const extensions = room.find(FIND_MY_STRUCTURES, {
                filter: (structure) => structure.structureType === STRUCTURE_EXTENSION
            });
            switch (extensions.length) {
                case 0:
                    body = [WORK, CARRY, CARRY, MOVE, MOVE];
                    break;
                case 1:
                    body = [WORK, CARRY, CARRY, MOVE, MOVE];
                    break;
                case 2:
                    body = [WORK, WORK, CARRY, CARRY, MOVE, MOVE];
                    break;
                case 3:
                    body = [WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE];
                    break;
                case 4:
                    body = [WORK, WORK, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE];
                    break;
                case 5:
                    body = [WORK, WORK, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE];
                    break;
                default:
                    body = [WORK, CARRY, MOVE];
                    break;
            }
        }

    } else {
        body = [WORK, MOVE, CARRY];
    }

    room.find(FIND_MY_SPAWNS)[0].spawnCreep(body, newName, {
        memory: memory
    });
}

function createConstructionSites(room: Room, level: number) {
    if (level === 0) {
        // Check buildings and sources in the room
        const sources = room.find(FIND_SOURCES);
        const buildings = room.find(FIND_STRUCTURES);
        // Check for the spawn in this room
        const spawns = room.find(FIND_MY_SPAWNS);
        // Find Controller
        const controller = room.controller;
        let road_locations: RoomPosition[] = [];

        // Check the 5 highest spots next to the spawn
        if (spawns.length > 0) {
            for (let x = -1; x < 2; x++) {
                for (let y = -1; y < 2; y++) {
                    // if the spot is not a wall
                    if (room.lookAt(spawns[0].pos.x + x, spawns[0].pos.y + y)[0].terrain !== 'wall') {
                        // look at same spot and see if container there
                        if (room.lookForAt(LOOK_STRUCTURES, spawns[0].pos.x + x, spawns[0].pos.y + y).length === 0) {
                            // create the construction site
                            room.createConstructionSite(spawns[0].pos.x + x, spawns[0].pos.y + y, STRUCTURE_EXTENSION);
                        }
                    }
                }
            }
        } else {
            console.log("I was aboutta spawn a harvester but there is no controller to base the model off of");
        }
    }

    if (level === 1) {
        // Check buildings and sources in the room
        const sources = room.find(FIND_SOURCES);
        const buildings = room.find(FIND_STRUCTURES);
        // Check for the spawn in this room
        const spawns = room.find(FIND_MY_SPAWNS);
        // Find Controller
        const controller = room.controller;
        let road_locations: RoomPosition[] = [];

      // Get Path between spawn and controller
        let path = null;
        if (spawns.length > 0 && controller != undefined) {
            path = spawns[0].pos.findPathTo(controller);
            // Add to road_locations
            path.forEach(path => {
                // Check if the path can have a road
                if (room.lookForAt(LOOK_TERRAIN, path.x, path.y)[0] === 'swamp' || room.lookForAt(LOOK_TERRAIN, path.x, path.y)[0] === 'plain') {
                    // Check road is not already there
                    if (room.lookForAt(LOOK_STRUCTURES, path.x, path.y).length === 0) {
                        // set as the next build
                        room.createConstructionSite(path.x, path.y, STRUCTURE_ROAD);
                    }
                }
            });
        } else {
            console.log("I was aboutta check for path between a spawn and controller but missing one");
        }
        // Get Paths between all sources and spawn, and then all controller and spawn
        sources.forEach(source => {
            if (spawns.length > 0) {
                path = spawns[0].pos.findPathTo(source);
                // Add to road_locations
                path.forEach(path => {
                    // Check if the path can have a road
                    if (room.lookForAt(LOOK_TERRAIN, path.x, path.y)[0] !== 'wall') {
                        // Check road is not already there
                        if (room.lookForAt(LOOK_STRUCTURES, path.x, path.y).length === 0) {
                            // set as the next build
                            room.createConstructionSite(path.x, path.y, STRUCTURE_ROAD);
                        }
                    }
                });
            } else {
                console.log("I was aboutta check for path between a spawn and source but missing one");
            }
            if (controller != undefined) {
                path = controller.pos.findPathTo(source);
                // Add to road_locations
                path.forEach(path => {
                    // Check if the path can have a road
                    if (room.lookForAt(LOOK_TERRAIN, path.x, path.y)[0] !== 'wall') {
                        // Check road is not already there
                        if (room.lookForAt(LOOK_STRUCTURES, path.x, path.y).length === 0) {
                            // set as the next build
                            room.createConstructionSite(path.x, path.y, STRUCTURE_ROAD);
                        }
                    }
                });
            }
        });
    }

}

function manageConstructionAndRepair(room: Room) {


  // handle the early level buildings
    if (room.controller != undefined) {
        // check how many extensions we have
        const extensions = room.find(FIND_MY_STRUCTURES, {
          filter: (structure) => structure.structureType === STRUCTURE_EXTENSION
        });
        if (room.controller.level > 1 && extensions.length > 4) {
            createConstructionSites(room, 1);
        } else {
            createConstructionSites(room, 0);
        }
    } else {
        console.log("I was aboutta spawn a harvester but there is no controller to base the model off of");
    }

    // Find construction sites
    const constructionSites = room.find(FIND_CONSTRUCTION_SITES);

    // Find structures that need repair
    const structuresNeedingRepair = room.find(FIND_STRUCTURES, {
        filter: (structure) => structure.hits < structure.hitsMax && structure.structureType !== STRUCTURE_WALL
    });

    // Prioritize construction over repair
    if (constructionSites.length > 0) {
        // Assign builder creeps to construction
        assignBuildersToConstruction(room, constructionSites);
    } else if (structuresNeedingRepair.length > 0) {
        // Assign builder creeps to repair
        assignBuildersToRepair(room, structuresNeedingRepair);
    }
}

function assignBuildersToConstruction(room: Room, constructionSites: ConstructionSite[]) {
    console.log(`Assigning builders in room: ${room.name}`);

    const builders = room.find(FIND_MY_CREEPS, {
        filter: (creep) => creep.memory.role === 'builder'
    });
    console.log(`Found ${builders.length} builders`);


    for (const builder of builders) {
        if (builder.memory.building && builder.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
            builder.memory.building = false;
            builder.say('🔄 harvest');
            console.log(`Builder ${builder.name} switching to harvest due to empty energy`);
        }
        if (!builder.memory.building && builder.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
            builder.memory.building = true;
            builder.say('🚧 build');
            console.log(`Builder ${builder.name} switching to build due to full energy`);
        }

        if (builder.memory.building) {
            // Filter constructionSites to prioritize non-roads
            const nonRoadSites = constructionSites.filter(site => site.structureType !== STRUCTURE_ROAD);
            let targetSite = builder.pos.findClosestByPath(nonRoadSites);

            // If no non-road sites are found, consider roads
            if (!targetSite) {
                const roadSites = constructionSites.filter(site => site.structureType === STRUCTURE_ROAD);
                targetSite = builder.pos.findClosestByPath(roadSites);
            }

            if (targetSite) {
                console.log(`Builder ${builder.name} moving to build at ${targetSite.pos}`);
                if (builder.build(targetSite) === ERR_NOT_IN_RANGE) {
                    builder.moveTo(targetSite, { visualizePathStyle: { stroke: '#ffffff' } });
                }
            } else {
                console.log(`No construction sites found for builder ${builder.name}`);
            }
        } else {
            // Check if storage exists and has more than 80% energy
            const storageWithEnergy = room.storage && room.storage.store.getUsedCapacity(RESOURCE_ENERGY) > room.storage.store.getCapacity(RESOURCE_ENERGY) * 0.8;
            // Modified logic to harvest energy or withdraw from storage
            if (storageWithEnergy) {
                console.log(`Builder ${builder.name} withdrawing from storage`);
                if (room.storage && builder.withdraw(room.storage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    builder.moveTo(room.storage, { visualizePathStyle: { stroke: '#ffaa00' } });
                }
            } else {
                const nearestSource = builder.pos.findClosestByPath(FIND_SOURCES);
                if (nearestSource) {
                    console.log(`Builder ${builder.name} moving to harvest at ${nearestSource.pos}`);
                    if (builder.harvest(nearestSource) === ERR_NOT_IN_RANGE) {
                        builder.moveTo(nearestSource, { visualizePathStyle: { stroke: '#ffaa00' } });
                    }
                } else {
                    console.log(`No sources found for builder ${builder.name} to harvest`);
                }
            }
        }
    }
}



function assignBuildersToRepair(room: Room, structuresNeedingRepair: Structure[]) {
    const builders = room.find(FIND_MY_CREEPS, {
        filter: (creep) => creep.memory.role === 'builder'
    });

    for (const builder of builders) {
        if (builder.memory.repairing && builder.carry.energy === 0) {
            builder.memory.repairing = false;
            builder.say('🔄 harvest');
        }
        if (!builder.memory.repairing && builder.carry.energy === builder.carryCapacity) {
            builder.memory.repairing = true;
            builder.say('🔧 repair');
        }

        if (builder.memory.repairing) {
            if (builder.repair(structuresNeedingRepair[0]) === ERR_NOT_IN_RANGE) {
                builder.moveTo(structuresNeedingRepair[0], { visualizePathStyle: { stroke: '#ffaa00' } });
            }
        } else {
            // Add logic to harvest energy
        }
    }
}

function performTowerMaintenance(tower: StructureTower) {
    // Implement logic for tower maintenance, like repairing structures or healing creeps
    const closestDamagedStructure = tower.pos.findClosestByRange(FIND_STRUCTURES, {
        filter: (structure) => structure.hits < structure.hitsMax
    });

    if (closestDamagedStructure) {
        tower.repair(closestDamagedStructure);
    } else {
        // Optionally heal creeps here
    }
}

