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



        // Construction and Repair
        manageConstructionAndRepair(room);

        // Room Defense
        manageRoomDefense(room);

        // Other Room-specific logic...
    }
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

        const max_harvesters = spots * (Math.floor(distance / 25) + 1);

        // Check if there are enough harvesters for this source
        if (harvesters.length <= max_harvesters && !spawned) { // Adjust the number as needed
            spawnHarvester(room, source.id);
            console.log(`... Needs Harvester, spawning... `);
            spawned = true;
        }

        // Logic for each harvester to harvest energy
        harvesters.forEach(harvester => {
            if (harvester.store.getFreeCapacity(RESOURCE_ENERGY) > 0 && !harvester.memory.unloading) {
                console.log("...Moving towards target...");
                if (harvester.harvest(source) === ERR_NOT_IN_RANGE) {
                    harvester.moveTo(source);
                }
            } else {
                if (harvester.store[RESOURCE_ENERGY] === 0) {
                    harvester.memory.unloading = false;
                } else {
                    // set memory unloading to true
                    harvester.memory.unloading = true;
                    // if out of energy, set unloading to false
                    console.log("...Moving towards Repo...");
                    // Find where to deliver the energy (e.g., Spawn, Extensions, or Storage)
                    const target = findEnergyDeliveryTarget(room, harvester);
                    if (target) {
                        if (harvester.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                            harvester.moveTo(target);
                        }
                    }
                }
            }
        });
    });
}

function spawnHarvester(room: Room, sourceId: Id<Source>) {
    // Define the body parts for the harvester creep
    // This is a simple configuration; you might want to make this more dynamic based on your room's economy
    const body = [WORK, CARRY, MOVE];

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

function findEnergyDeliveryTarget(room: Room, creep: Creep) {
    // Prioritize Spawns and Extensions that need energy
    let target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
        filter: (structure) => {
            return (structure.structureType === STRUCTURE_SPAWN ||
                    structure.structureType === STRUCTURE_EXTENSION) &&
                    structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
        }
    });

    if (target) return target;

    // If Spawns and Extensions are full, consider other structures like Towers
    target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
        filter: (structure) => {
            return structure.structureType === STRUCTURE_TOWER &&
                    structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
        }
    });

    if (target) return target;

    // If Towers are also full, consider upgrading the Controller
    if (room.controller && room.controller.my && room.controller.level < 2) {
        return room.controller;
    }

    // Lastly, if all else is satisfied, store excess energy in Storage
    if (room.storage && room.storage.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
        return room.storage;
    }

    // If no suitable target is found, return null
    return null;
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
          if (upgrader.store[RESOURCE_ENERGY] > 0) {
              if (controller !== undefined) {
                  if (upgrader.upgradeController(controller) === ERR_NOT_IN_RANGE) {
                    upgrader.moveTo(controller);
                  }
              } else {
                  console.log("No controller found");
              }
          } else {
              // Find all storage containers in the room
              const storageContainers = room.find(FIND_STRUCTURES, {
                  filter: (structure) => structure.structureType === STRUCTURE_CONTAINER &&
                                        structure.store[RESOURCE_ENERGY] > 0
              });
              // if one storage is above 90% its capacity, grab a full load
              const storageContainer = storageContainers.find((container) => {
                  if ('store' in container) {
                      // Now TypeScript knows that container has a store property
                      return container.store.getUsedCapacity(RESOURCE_ENERGY) > container.store.getCapacity(RESOURCE_ENERGY) * 0.9;
                  }
                  return false;
              });
              // if there is a storage container, grab from it
              if (storageContainer) {
                  if (upgrader.withdraw(storageContainer, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                      upgrader.moveTo(storageContainer);
                  }
              } else {
                  // If there are no storage containers, find the nearest source
                  const source = upgrader.pos.findClosestByPath(FIND_SOURCES);
                  if (source) {
                      if (upgrader.harvest(source) === ERR_NOT_IN_RANGE) {
                          upgrader.moveTo(source);
                      }
                  }
              }
          }
      });
}

function manageCreepSpawning(room: Room) {
    const maxHarvesters = 5;
    const maxUpgraders = 1;
    const maxBuilders = 1;

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
    const body = [WORK, CARRY, MOVE]; // Customize as needed
    const newName = `${role}-${Game.time}`; // Unique name for the new creep

    console.log(`Spawning new ${role}: ${newName}`);



    room.find(FIND_MY_SPAWNS)[0].spawnCreep(body, newName, {
        memory: memory
    });
}

function manageConstructionAndRepair(room: Room) {
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
    const builders = room.find(FIND_MY_CREEPS, {
        filter: (creep) => creep.memory.role === 'builder'
    });

    for (const builder of builders) {
        if (builder.memory.building && builder.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
            builder.memory.building = false;
            builder.say('🔄 harvest');
        }
        if (!builder.memory.building && builder.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
            builder.memory.building = true;
            builder.say('🚧 build');
        }

        if (builder.memory.building) {
            // Find the nearest construction site
            const nearestSite = builder.pos.findClosestByPath(constructionSites);
            if (nearestSite && builder.build(nearestSite) === ERR_NOT_IN_RANGE) {
                builder.moveTo(nearestSite, { visualizePathStyle: { stroke: '#ffffff' } });
            }
        } else {
            // Add logic to harvest energy
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

