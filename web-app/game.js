// Journey game rules.
// This module is deliberately DOM-free: it only receives game state data and
// returns new game state data for the browser UI or the unit tests to use.

// Public board constants used by both the game module and UI rendering.
export const BOARD_SIZE = 9;
export const EXIT_INDEX = 40;
export const SPAWN_POSITIONS = Object.freeze([0, 8, 72, 80]);
const KEY_REVEAL_LIMIT = 8;
const MINE_BLAST_RADIUS = 1;
const TIMED_BOMB_BLAST_RADIUS = 2;
const KEY_STEAL_TARGET = "key";
const ADJACENT_EVENT_WEIGHT_MULTIPLIER = 0.35;
const NEARBY_EVENT_WEIGHT_MULTIPLIER = 0.7;

// Directions are strings so UI controls and tests can pass readable commands.
export const DIRECTIONS = Object.freeze({
    UP: "up",
    DOWN: "down",
    LEFT: "left",
    RIGHT: "right"
});

// Tile types describe revealed board content. Hidden tiles keep type === null.
export const TILE_TYPES = Object.freeze({
    EXIT: "exit",
    WALL: "wall",
    TIMED_BOMB_PACK: "timedBombPack",
    MINE: "mine",
    MONSTER_CAMP: "monsterCamp",
    EMPTY: "empty",
    FULL_HEAL: "fullHeal",
    RESTRICT_MOVE: "restrictMove",
    SWAP_PLAYER: "swapPlayer",
    ACTION_BOOST: "actionBoost",
    SWAP_ANY_TILES_WITH_HP_COST: "swapAnyTilesWithHpCost",
    MAGNET: "magnet",
    THIEF_HAND: "thiefHand",
    REMOTE_TRIGGER: "remoteTrigger",
    BOMB_DEFUSER: "bombDefuser"
});

// The magnet, costly any-tile swap, thief hand, remote trigger, and bomb
// defuser are stored items. The other usable effects are temporary events:
// when a player steps onto them, they must use or dismiss the effect.
export const ITEM_TYPES = Object.freeze({
    TIMED_BOMB_PACK: "timedBombPack",
    RESTRICT_MOVE: "restrictMove",
    SWAP_PLAYER: "swapPlayer",
    SWAP_ANY_TILES_WITH_HP_COST: "swapAnyTilesWithHpCost",
    MAGNET: "magnet",
    THIEF_HAND: "thiefHand",
    REMOTE_TRIGGER: "remoteTrigger",
    BOMB_DEFUSER: "bombDefuser"
});

const TEMPORARY_EVENT_TYPES = Object.freeze([
    ITEM_TYPES.TIMED_BOMB_PACK,
    ITEM_TYPES.RESTRICT_MOVE,
    ITEM_TYPES.SWAP_PLAYER
]);

const NO_MOVE_REWARD_TURNS = 5;
const NO_MOVE_REWARD_ITEMS = Object.freeze([
    ITEM_TYPES.SWAP_ANY_TILES_WITH_HP_COST,
    ITEM_TYPES.SWAP_PLAYER,
    ITEM_TYPES.TIMED_BOMB_PACK,
    ITEM_TYPES.THIEF_HAND
]);

// Randomly revealed tiles can never create a second key; the key is unique.
// Weighted reveal table for non-key hidden tiles. Fractional weights are fine:
// the reveal picker only compares each weight's share of the total.
// This scale keeps all non-empty tile ratios while making empty tiles 20%.
const NON_EMPTY_TILE_WEIGHT_SCALE = 1.7112299465240641;
const RANDOM_TILE_WEIGHTS = Object.freeze([
    {type: TILE_TYPES.WALL, weight: 22 * NON_EMPTY_TILE_WEIGHT_SCALE},
    {type: TILE_TYPES.EMPTY, weight: 40},
    {type: TILE_TYPES.MINE, weight: 7 * NON_EMPTY_TILE_WEIGHT_SCALE},
    {type: TILE_TYPES.MONSTER_CAMP, weight: 8 * NON_EMPTY_TILE_WEIGHT_SCALE},
    {type: TILE_TYPES.TIMED_BOMB_PACK, weight: 7 * NON_EMPTY_TILE_WEIGHT_SCALE},
    {type: TILE_TYPES.RESTRICT_MOVE, weight: 6 * NON_EMPTY_TILE_WEIGHT_SCALE},
    {type: TILE_TYPES.FULL_HEAL, weight: 3.5 * NON_EMPTY_TILE_WEIGHT_SCALE},
    {type: TILE_TYPES.SWAP_PLAYER, weight: 6 * NON_EMPTY_TILE_WEIGHT_SCALE},
    {type: TILE_TYPES.ACTION_BOOST, weight: 6 * NON_EMPTY_TILE_WEIGHT_SCALE},
    {type: TILE_TYPES.SWAP_ANY_TILES_WITH_HP_COST, weight: 6 * NON_EMPTY_TILE_WEIGHT_SCALE},
    {type: TILE_TYPES.MAGNET, weight: 7 * NON_EMPTY_TILE_WEIGHT_SCALE},
    {type: TILE_TYPES.THIEF_HAND, weight: 7 * NON_EMPTY_TILE_WEIGHT_SCALE},
    {type: TILE_TYPES.REMOTE_TRIGGER, weight: 6 * NON_EMPTY_TILE_WEIGHT_SCALE},
    {type: TILE_TYPES.BOMB_DEFUSER, weight: 7 * NON_EMPTY_TILE_WEIGHT_SCALE}
]);

// Return whether a tile index is one of the fixed player spawn tiles.
function isSpawnIndex(index) {
    return SPAWN_POSITIONS.indexOf(index) !== -1;
}

// Return whether a tile should never receive random hidden content.
function isProtectedTile(index) {
    return index === EXIT_INDEX || isSpawnIndex(index);
}

// A tiny seeded generator keeps random setup deterministic for unit tests.
function makeSeed(seed) {
    if (Number.isInteger(seed)) {
        return seed >>> 0;
    }
    return 123456789;
}

// Advance the deterministic random generator by one step.
function nextRandomValue(seed) {
    const nextSeed = (seed * 1664525 + 1013904223) >>> 0;
    return {
        seed: nextSeed,
        value: nextSeed / 4294967296
    };
}

// Cloning is the core immutability guard. Public rule functions clone first,
// then apply changes to the clone, so callers keep their original state object.
function clonePlayer(player) {
    const bomb = player.bomb === null ? null : {
        turnsLeft: player.bomb.turnsLeft,
        sourcePlayerId: player.bomb.sourcePlayerId
    };

    return {
        id: player.id,
        position: player.position,
        spawnPosition: player.spawnPosition,
        hp: player.hp,
        maxHp: player.maxHp,
        hasKey: player.hasKey,
        items: player.items.slice(),
        temporaryItems: (player.temporaryItems || []).slice(),
        bomb,
        restrictedNextTurn: player.restrictedNextTurn,
        nextTurnActionPower: player.nextTurnActionPower,
        turnsWithoutMove: player.turnsWithoutMove || 0,
        movedThisTurn: Boolean(player.movedThisTurn)
    };
}

// Copy one tile so rule updates never mutate the old board.
function cloneTile(tile) {
    return {
        index: tile.index,
        type: tile.type,
        revealed: tile.revealed,
        consumed: tile.consumed
    };
}

// Copy the full game state before applying rule changes.
function cloneGame(gameState) {
    return {
        boardSize: gameState.boardSize,
        exitIndex: gameState.exitIndex,
        roundNumber: gameState.roundNumber,
        currentPlayerIndex: gameState.currentPlayerIndex,
        remainingActions: gameState.remainingActions,
        revealCount: gameState.revealCount || 0,
        keyRevealNumber: gameState.keyRevealNumber || KEY_REVEAL_LIMIT,
        pendingEvent: gameState.pendingEvent === null || gameState.pendingEvent === undefined ? null : {
            playerId: gameState.pendingEvent.playerId,
            itemType: gameState.pendingEvent.itemType
        },
        status: gameState.status,
        winnerId: gameState.winnerId,
        rngSeed: gameState.rngSeed,
        key: {
            position: gameState.key.position,
            holderPlayerId: gameState.key.holderPlayerId,
            isVisible: gameState.key.isVisible
        },
        tiles: gameState.tiles.map(cloneTile),
        players: gameState.players.map(clonePlayer),
        revealedTypeCounts: Object.assign({}, gameState.revealedTypeCounts || {}),
        plannedTileContents: Object.assign({}, gameState.plannedTileContents),
        queuedTileContents: gameState.queuedTileContents.slice(),
        lastMessage: gameState.lastMessage
    };
}

// The helpers below work on a cloned game object during one rule resolution.
function getPlayer(game, playerId) {
    return game.players.find(function (player) {
        return player.id === playerId;
    });
}

// Return the active player inside a cloned game state.
function getCurrentMutablePlayer(game) {
    return game.players[game.currentPlayerIndex];
}

// Return the mutable tile object at a board index.
function getTile(game, tileIndex) {
    return game.tiles[tileIndex];
}

// Store the latest player-facing rule message on the game state.
function setMessage(game, message) {
    game.lastMessage = message;
    return game;
}

// Read how many times a tile type has already appeared.
function openedTypeCount(game, tileType) {
    return game.revealedTypeCounts[tileType] || 0;
}

// Return whether a tile type should be spread out spatially.
function isEventOrItemTileType(tileType) {
    return tileType !== null &&
        tileType !== TILE_TYPES.EMPTY &&
        tileType !== TILE_TYPES.WALL &&
        tileType !== TILE_TYPES.EXIT;
}

// Reduce event/item weight when similar content is nearby.
function spatialSpreadMultiplier(game, tileIndex, tileType) {
    let multiplier = 1;

    if (!isEventOrItemTileType(tileType) || !Number.isInteger(tileIndex)) {
        return multiplier;
    }

    game.tiles.forEach(function (tile) {
        let distance;

        if (!tile.revealed || tile.consumed || !isEventOrItemTileType(tile.type)) {
            return;
        }

        distance = getManhattanDistance(tile.index, tileIndex, game.boardSize);
        if (distance === 1) {
            multiplier = Math.min(multiplier, ADJACENT_EVENT_WEIGHT_MULTIPLIER);
        } else if (distance === 2) {
            multiplier = Math.min(multiplier, NEARBY_EVENT_WEIGHT_MULTIPLIER);
        }
    });

    return multiplier;
}

// Once a type has appeared, its later reveal chance is reduced but not removed.
// Nearby event/item tiles also reduce new event/item weights, so special tiles
// tend to spread out without becoming predictable or impossible.
function dynamicTileWeight(game, entry, tileIndex) {
    return entry.weight *
        spatialSpreadMultiplier(game, tileIndex, entry.type) /
        (openedTypeCount(game, entry.type) + 1);
}

// Track a newly revealed tile type for future weighting.
function recordRevealedType(game, tileType) {
    if (tileType !== null && tileType !== TILE_TYPES.EXIT) {
        game.revealedTypeCounts[tileType] = openedTypeCount(game, tileType) + 1;
    }
}

// Choose hidden tile content using the current dynamic weights.
function chooseWeightedTileType(game, tileIndex) {
    const totalWeight = RANDOM_TILE_WEIGHTS.reduce(function (total, entry) {
        return total + dynamicTileWeight(game, entry, tileIndex);
    }, 0);
    const random = nextRandomValue(game.rngSeed);
    let threshold = random.value * totalWeight;
    let index = 0;

    game.rngSeed = random.seed;
    while (index < RANDOM_TILE_WEIGHTS.length) {
        threshold -= dynamicTileWeight(game, RANDOM_TILE_WEIGHTS[index], tileIndex);
        if (threshold <= 0) {
            return RANDOM_TILE_WEIGHTS[index].type;
        }
        index += 1;
    }

    return TILE_TYPES.EMPTY;
}

// The key is placed once at game creation and never appears as random content.
function chooseKeyPosition(playerCount, options) {
    const legalPositions = [];
    let index = 0;

    while (index < BOARD_SIZE * BOARD_SIZE) {
        if (!isProtectedTile(index)) {
            legalPositions.push(index);
        }
        index += 1;
    }

    if (Number.isInteger(options.keyPosition)) {
        if (legalPositions.indexOf(options.keyPosition) === -1) {
            throw new RangeError("keyPosition must be a hidden, non-spawn tile.");
        }
        return {
            position: options.keyPosition,
            seed: makeSeed(options.seed)
        };
    }

    const random = nextRandomValue(makeSeed(options.seed) + playerCount);
    return {
        position: legalPositions[Math.floor(random.value * legalPositions.length)],
        seed: random.seed
    };
}

// Choose which early reveal will force the key to appear.
function chooseKeyRevealNumber(playerCount, options) {
    const queuedReveal = options.keyRevealNumber;

    if (Number.isInteger(queuedReveal)) {
        if (queuedReveal < 1 || queuedReveal > KEY_REVEAL_LIMIT) {
            throw new RangeError("keyRevealNumber must be an integer from 1 to 8.");
        }
        return queuedReveal;
    }

    const random = nextRandomValue(makeSeed(options.seed) + playerCount + 404);
    return Math.floor(random.value * KEY_REVEAL_LIMIT) + 1;
}

// Exit and spawn tiles begin revealed and safe; all other tiles start hidden.
function makeTiles() {
    const tiles = [];
    let index = 0;

    while (index < BOARD_SIZE * BOARD_SIZE) {
        tiles.push({
            index,
            type: null,
            revealed: false,
            consumed: false
        });
        index += 1;
    }

    tiles[EXIT_INDEX] = {
        index: EXIT_INDEX,
        type: TILE_TYPES.EXIT,
        revealed: true,
        consumed: false
    };

    SPAWN_POSITIONS.forEach(function (spawnIndex) {
        tiles[spawnIndex] = {
            index: spawnIndex,
            type: TILE_TYPES.EMPTY,
            revealed: true,
            consumed: false
        };
    });

    return tiles;
}

// Each player starts at their assigned corner with the same survival stats.
function makePlayers(playerCount) {
    return SPAWN_POSITIONS.slice(0, playerCount).map(function (spawnPosition, index) {
        return {
            id: index + 1,
            position: spawnPosition,
            spawnPosition,
            hp: 3,
            maxHp: 3,
            hasKey: false,
            items: [],
            temporaryItems: [],
            bomb: null,
            restrictedNextTurn: false,
            nextTurnActionPower: 1,
            turnsWithoutMove: 0,
            movedThisTurn: false
        };
    });
}

// Protect optional setup data from missing or invalid input.
function normalizeOptions(options) {
    if (options === undefined) {
        return {};
    }
    return options;
}

// Copy deterministic tile overrides supplied by tests or setup.
function copyPlannedContents(options) {
    const contents = options.tileContentsByIndex || options.tileContents || {};
    return Object.assign({}, contents);
}

// Non-key tile content is assigned lazily at reveal time. Tests can inject
// exact tile contents to avoid depending on random outcomes.
function chooseTileContent(game, tileIndex) {
    const key = String(tileIndex);

    if (Object.prototype.hasOwnProperty.call(game.plannedTileContents, key)) {
        return game.plannedTileContents[key];
    }

    if (game.queuedTileContents.length > 0) {
        return game.queuedTileContents.shift();
    }

    return chooseWeightedTileType(game, tileIndex);
}

// Add an item only if the player does not already have it.
function addItemToPlayer(game, playerId, itemType) {
    const player = getPlayer(game, playerId);

    if (player.items.indexOf(itemType) !== -1) {
        return false;
    }

    player.items.push(itemType);
    return true;
}

// Return whether an item must be used or dismissed immediately.
function isTemporaryEventItem(itemType) {
    return TEMPORARY_EVENT_TYPES.indexOf(itemType) !== -1;
}

// Return whether a player holds a temporary event item.
function hasTemporaryItem(player, itemType) {
    return (player.temporaryItems || []).indexOf(itemType) !== -1;
}

// Remove all current-turn-only items from a player.
function clearTemporaryEvents(player) {
    const temporaryItems = (player.temporaryItems || []).slice();

    temporaryItems.forEach(function (itemType) {
        removeOneItem(player, itemType);
    });
    player.temporaryItems = [];
}

// Give a player a temporary event and mark it as pending.
function addTemporaryEventToPlayer(game, playerId, itemType) {
    const player = getPlayer(game, playerId);

    clearTemporaryEvents(player);
    player.items.push(itemType);
    player.temporaryItems.push(itemType);
}

// Convert an internal item id into lower-case display text.
function readableItemName(itemType) {
    if (itemType === "") {
        return "no extra";
    }
    return itemType.replace(/([A-Z])/g, " $1").toLowerCase();
}

// Remove one item from inventory and temporary item tracking.
function removeOneItem(player, itemType) {
    const itemIndex = player.items.indexOf(itemType);

    if (itemIndex === -1) {
        return false;
    }

    player.items.splice(itemIndex, 1);
    if (player.temporaryItems !== undefined) {
        const temporaryIndex = player.temporaryItems.indexOf(itemType);

        if (temporaryIndex !== -1) {
            player.temporaryItems.splice(temporaryIndex, 1);
        }
    }
    return true;
}

// Choose a random no-move reward the player does not own.
function chooseNoMoveRewardItem(game, player) {
    const availableItems = NO_MOVE_REWARD_ITEMS.filter(function (itemType) {
        return player.items.indexOf(itemType) === -1;
    });
    const random = nextRandomValue(game.rngSeed);

    game.rngSeed = random.seed;
    if (availableItems.length === 0) {
        return "";
    }
    return availableItems[Math.floor(random.value * availableItems.length)];
}

// If a player keeps ending their own turns without a real move action, give a
// small random tool so they can break out of blocked routes. Swap-player and
// timed-bomb rewards are stored items here, unlike their step-on event version.
function resolveNoMoveReward(game, playerId) {
    const player = getPlayer(game, playerId);
    let rewardItem;

    if (player === undefined) {
        return "";
    }
    if (player.movedThisTurn) {
        player.turnsWithoutMove = 0;
        player.movedThisTurn = false;
        return "";
    }

    player.turnsWithoutMove += 1;
    if (player.turnsWithoutMove < NO_MOVE_REWARD_TURNS) {
        return "";
    }

    player.turnsWithoutMove = 0;
    rewardItem = chooseNoMoveRewardItem(game, player);
    if (rewardItem === "") {
        return "";
    }

    addItemToPlayer(game, playerId, rewardItem);
    return "Player " + playerId + " received " + readableItemName(rewardItem) + " after 5 turns without moving.";
}

// Death is a reset, not elimination. The key drops before the player respawns.
function killPlayer(game, playerId) {
    const player = getPlayer(game, playerId);
    const deathPosition = player.position;

    if (player.hasKey) {
        game.key.position = deathPosition;
        game.key.holderPlayerId = null;
        game.key.isVisible = true;
    }

    player.hasKey = false;
    player.position = player.spawnPosition;
    player.hp = player.maxHp;
    player.bomb = null;
    player.restrictedNextTurn = false;
    player.nextTurnActionPower = 1;
    player.turnsWithoutMove = 0;
    player.movedThisTurn = false;
    clearTemporaryEvents(player);
}

// Apply HP loss and knock out the player if HP reaches zero.
function damagePlayer(game, playerId, amount) {
    const player = getPlayer(game, playerId);
    player.hp -= amount;

    if (player.hp <= 0) {
        killPlayer(game, playerId);
    }
}

// A key on the ground can only be collected after it has become visible.
function pickUpVisibleKey(game, playerId) {
    const player = getPlayer(game, playerId);

    if (game.key.holderPlayerId === null && game.key.isVisible && game.key.position === player.position) {
        game.key.holderPlayerId = playerId;
        player.hasKey = true;
        return true;
    }

    return false;
}

// Moving onto the key holder transfers the key only. It never creates a magnet;
// magnets must be collected from magnet tiles.
function stealKeyAtCurrentPosition(game, playerId) {
    const player = getPlayer(game, playerId);
    const holderId = game.key.holderPlayerId;

    if (holderId === null || holderId === playerId) {
        return false;
    }

    const holder = getPlayer(game, holderId);
    if (holder.position !== player.position) {
        return false;
    }

    holder.hasKey = false;
    player.hasKey = true;
    game.key.holderPlayerId = playerId;
    game.key.position = player.position;
    game.key.isVisible = true;
    return true;
}

// Bombs pass only when the bomb carrier is the player who moved onto someone.
function passBombFromMover(game, playerId) {
    const mover = getPlayer(game, playerId);

    if (mover.bomb === null) {
        return false;
    }

    const receiver = game.players.find(function (player) {
        return player.id !== playerId && player.position === mover.position;
    });

    if (receiver === undefined) {
        return false;
    }

    receiver.bomb = {
        turnsLeft: mover.bomb.turnsLeft,
        sourcePlayerId: mover.bomb.sourcePlayerId
    };
    mover.bomb = null;
    return true;
}

// Mark the game as won when a key holder reaches the exit.
function checkWin(game, playerId) {
    const player = getPlayer(game, playerId);

    if (player.hasKey && player.position === game.exitIndex) {
        game.status = "won";
        game.winnerId = playerId;
        game.remainingActions = 0;
        setMessage(game, "Player " + playerId + " escaped with the key.");
        return true;
    }

    return false;
}

// Turn a used event or item tile into an empty revealed tile.
function consumeTile(game, tileIndex) {
    const tile = getTile(game, tileIndex);
    tile.type = TILE_TYPES.EMPTY;
    tile.revealed = true;
    tile.consumed = true;
}

// Describe the effect shown when a tile is revealed.
function tileEffectDescription(tileType) {
    if (tileType === TILE_TYPES.WALL) {
        return "Wall revealed: this tile blocks movement.";
    }
    if (tileType === TILE_TYPES.TIMED_BOMB_PACK) {
        return "Timed bomb event revealed: place a countdown bomb on a player.";
    }
    if (tileType === TILE_TYPES.MINE) {
        return "Mine exploded: players within distance 1 were reset to spawn, and nearby tiles were revealed.";
    }
    if (tileType === TILE_TYPES.MONSTER_CAMP) {
        return "Monster camp revealed: step onto it and a monster will attack for 1 HP.";
    }
    if (tileType === TILE_TYPES.FULL_HEAL) {
        return "Full heal revealed: step onto it to restore HP.";
    }
    if (tileType === TILE_TYPES.RESTRICT_MOVE) {
        return "Restrict move event revealed: make one player skip their next turn.";
    }
    if (tileType === TILE_TYPES.SWAP_PLAYER) {
        return "Swap player event revealed: exchange positions with another player.";
    }
    if (tileType === TILE_TYPES.ACTION_BOOST) {
        return "Action boost revealed: step onto it to gain 2 more actions.";
    }
    if (tileType === TILE_TYPES.SWAP_ANY_TILES_WITH_HP_COST) {
        return "Costly swap item revealed: collect it to swap any two allowed tiles for 1 HP.";
    }
    if (tileType === TILE_TYPES.MAGNET) {
        return "Magnet revealed: collect it to pull or steal a nearby visible key.";
    }
    if (tileType === TILE_TYPES.THIEF_HAND) {
        return "Thief hand revealed: collect it to steal one item from another player.";
    }
    if (tileType === TILE_TYPES.REMOTE_TRIGGER) {
        return "Remote trigger revealed: collect it to trigger a nearby revealed event or item.";
    }
    if (tileType === TILE_TYPES.BOMB_DEFUSER) {
        return "Bomb defuser revealed: collect it to remove a timed bomb from yourself.";
    }
    return "Empty tile revealed: this tile is safe.";
}

// Tile effects are step-on effects. Hidden tiles cannot be entered in this
// version of the game, so players must reveal a route before moving through it.
function collectItemFromTile(game, playerId, tile, itemType, collectedMessage) {
    const wasAdded = addItemToPlayer(game, playerId, itemType);

    consumeTile(game, tile.index);
    if (wasAdded) {
        return collectedMessage;
    }
    return "Duplicate item blocked: this player already has " + readableItemName(itemType) + ".";
}

// Collect a current-turn event from a stepped-on tile.
function collectTemporaryEventFromTile(game, playerId, tile, itemType, collectedMessage) {
    addTemporaryEventToPlayer(game, playerId, itemType);
    consumeTile(game, tile.index);
    game.pendingEvent = {
        playerId,
        itemType
    };
    return collectedMessage;
}

// Apply the effect for the tile occupied by a player.
function resolveTileEffectAt(game, playerId, tileIndex) {
    const player = getPlayer(game, playerId);
    const tile = getTile(game, tileIndex);

    if (!tile.revealed || tile.consumed) {
        return "";
    }

    if (tile.type === TILE_TYPES.TIMED_BOMB_PACK) {
        return collectTemporaryEventFromTile(game, playerId, tile, ITEM_TYPES.TIMED_BOMB_PACK, "Timed bomb event triggered: place a countdown bomb on a player.");
    } else if (tile.type === TILE_TYPES.FULL_HEAL) {
        player.hp = player.maxHp;
        consumeTile(game, tile.index);
        return "Full heal triggered: the player is restored to maximum HP.";
    } else if (tile.type === TILE_TYPES.MONSTER_CAMP) {
        const wasKnockedOut = player.hp <= 1;

        damagePlayer(game, playerId, 1);
        consumeTile(game, tile.index);
        if (wasKnockedOut) {
            return "Monster camp attacked: Player " + playerId + " lost 1 HP and was reset to spawn.";
        }
        return "Monster camp attacked: Player " + playerId + " lost 1 HP.";
    } else if (tile.type === TILE_TYPES.RESTRICT_MOVE) {
        return collectTemporaryEventFromTile(game, playerId, tile, ITEM_TYPES.RESTRICT_MOVE, "Restrict move event triggered: make one player skip their next turn.");
    } else if (tile.type === TILE_TYPES.SWAP_PLAYER) {
        return collectTemporaryEventFromTile(game, playerId, tile, ITEM_TYPES.SWAP_PLAYER, "Swap player event triggered: swap positions with another player.");
    } else if (tile.type === TILE_TYPES.ACTION_BOOST) {
        game.remainingActions = Math.max(game.remainingActions, 3);
        consumeTile(game, tile.index);
        return "Action boost triggered: gained 2 more actions.";
    } else if (tile.type === TILE_TYPES.SWAP_ANY_TILES_WITH_HP_COST) {
        return collectItemFromTile(game, playerId, tile, ITEM_TYPES.SWAP_ANY_TILES_WITH_HP_COST, "Costly swap collected: use it later to swap any two allowed tiles for 1 HP.");
    } else if (tile.type === TILE_TYPES.MAGNET) {
        return collectItemFromTile(game, playerId, tile, ITEM_TYPES.MAGNET, "Magnet collected: use it to pull or steal a visible key within distance 3.");
    } else if (tile.type === TILE_TYPES.THIEF_HAND) {
        return collectItemFromTile(game, playerId, tile, ITEM_TYPES.THIEF_HAND, "Thief hand collected: use it later to steal one item from another player.");
    } else if (tile.type === TILE_TYPES.REMOTE_TRIGGER) {
        return collectItemFromTile(game, playerId, tile, ITEM_TYPES.REMOTE_TRIGGER, "Remote trigger collected: use it later to trigger a nearby revealed event or item.");
    } else if (tile.type === TILE_TYPES.BOMB_DEFUSER) {
        return collectItemFromTile(game, playerId, tile, ITEM_TYPES.BOMB_DEFUSER, "Bomb defuser collected: use it later to remove a timed bomb from yourself.");
    }

    return "";
}

// Resolve any tile effect at the player's current position.
function resolveSteppedTile(game, playerId) {
    return resolveTileEffectAt(game, playerId, getPlayer(game, playerId).position);
}

// Prepare action count for the active player's new turn.
function beginCurrentTurn(game) {
    const player = getCurrentMutablePlayer(game);
    clearTemporaryEvents(player);
    game.remainingActions = player.nextTurnActionPower;
    player.nextTurnActionPower = 1;
    player.movedThisTurn = false;
}

// Return bomb damage from Manhattan distance.
function timedBombDamageForDistance(distance) {
    if (distance === 0) {
        return "kill";
    }
    if (distance === 1) {
        return 2;
    }
    if (distance === TIMED_BOMB_BLAST_RADIUS) {
        return 1;
    }
    return 0;
}

// Convert one revealed wall into an empty tile.
function destroyWallTile(game, tileIndex) {
    const tile = getTile(game, tileIndex);

    if (tile.type === TILE_TYPES.WALL) {
        consumeTile(game, tileIndex);
    }
}

// Destroy revealed walls inside a blast radius.
function destroyBlastWalls(game, tileIndex) {
    let index = 0;

    while (index < game.tiles.length) {
        if (getManhattanDistance(tileIndex, index, game.boardSize) <= MINE_BLAST_RADIUS) {
            destroyWallTile(game, index);
        }
        index += 1;
    }
}

// Resolve one or more timed bomb explosions.
function applyTimedBombExplosions(game, explosions) {
    const playerPositions = game.players.map(function (player) {
        return {
            id: player.id,
            position: player.position
        };
    });
    const killedPlayerIds = [];
    const damageByPlayerId = {};
    const damageMessages = [];

    explosions.forEach(function (explosion) {
        destroyBlastWalls(game, explosion.position);
        playerPositions.forEach(function (player) {
            const distance = getManhattanDistance(player.position, explosion.position, game.boardSize);
            const damage = timedBombDamageForDistance(distance);

            if (damage === "kill") {
                if (killedPlayerIds.indexOf(player.id) === -1) {
                    killedPlayerIds.push(player.id);
                }
            } else if (damage > 0 && killedPlayerIds.indexOf(player.id) === -1) {
                damageByPlayerId[player.id] = (damageByPlayerId[player.id] || 0) + damage;
            }
        });
    });

    game.players.forEach(function (player) {
        const damage = damageByPlayerId[player.id] || 0;

        if (killedPlayerIds.indexOf(player.id) !== -1) {
            killPlayer(game, player.id);
        } else if (damage > 0) {
            if (player.hp <= damage) {
                killedPlayerIds.push(player.id);
            } else {
                damageMessages.push("Player " + player.id + " lost " + damage + " HP");
            }
            damagePlayer(game, player.id, damage);
        }
    });

    explosions.forEach(function (explosion) {
        const player = getPlayer(game, explosion.playerId);

        if (player !== undefined) {
            player.bomb = null;
        }
    });

    if (killedPlayerIds.length > 0 || damageMessages.length > 0) {
        const pieces = [];

        if (killedPlayerIds.length > 0) {
            pieces.push("Player " + killedPlayerIds.join(", Player ") +
                (killedPlayerIds.length === 1 ? " was" : " were") + " reset to spawn");
        }
        pieces.push(...damageMessages);
        setMessage(game, "Timed bomb exploded: " + pieces.join(". ") + ".");
        return;
    }
    setMessage(game, "Timed bomb exploded: blast damage resolved.");
}

// A timed bomb follows its current carrier. Its countdown decreases only when
// that carrier's own turn ends or is skipped after the bomb was installed.
function tickBombForPlayer(game, playerId) {
    const previousMessage = game.lastMessage;
    const player = getPlayer(game, playerId);

    if (player === undefined || player.bomb === null) {
        return "";
    }

    player.bomb.turnsLeft -= 1;
    if (player.bomb.turnsLeft > 0) {
        return "";
    }

    applyTimedBombExplosions(game, [{
        playerId: player.id,
        position: player.position
    }]);
    if (game.lastMessage !== previousMessage && game.lastMessage.indexOf("Timed bomb exploded") === 0) {
        return game.lastMessage;
    }
    return "";
}

// Clear a pending event owned by one player.
function clearPendingEventForPlayer(game, playerId) {
    if (game.pendingEvent !== null && game.pendingEvent.playerId === playerId) {
        game.pendingEvent = null;
    }
}

// Move to the next player and resolve end-of-turn effects.
function advanceTurnCursor(game) {
    const endingPlayerId = getCurrentMutablePlayer(game).id;
    const wasLastPlayer = game.currentPlayerIndex === game.players.length - 1;
    const rewardMessage = resolveNoMoveReward(game, endingPlayerId);
    const bombMessage = tickBombForPlayer(game, endingPlayerId);

    if (wasLastPlayer) {
        game.roundNumber += 1;
    }

    game.currentPlayerIndex = wasLastPlayer ? 0 : game.currentPlayerIndex + 1;
    return [rewardMessage, bombMessage].filter(function (message) {
        return message !== "";
    }).join(" ");
}

// Skip any players whose next turn is restricted.
function skipRestrictedTurns(game) {
    const skippedPlayerIds = [];
    const bombMessages = [];
    let guard = 0;

    while (guard < game.players.length && getCurrentMutablePlayer(game).restrictedNextTurn) {
        const skippedPlayer = getCurrentMutablePlayer(game);
        const bombMessage = advanceTurnCursor(game);

        skippedPlayerIds.push(skippedPlayer.id);
        skippedPlayer.restrictedNextTurn = false;
        skippedPlayer.nextTurnActionPower = 1;
        clearTemporaryEvents(skippedPlayer);
        clearPendingEventForPlayer(game, skippedPlayer.id);
        if (bombMessage !== "") {
            bombMessages.push(bombMessage);
        }
        guard += 1;
    }

    return {
        skippedPlayerIds,
        bombMessages
    };
}

// Build the message shown at the start of a turn.
function turnStartMessage(game, skippedPlayerIds, bombMessages) {
    const pieces = bombMessages.slice();

    if (skippedPlayerIds.length > 0) {
        pieces.push("Player " + skippedPlayerIds.join(", Player ") + " skipped a restricted turn.");
    }
    pieces.push("Player " + getCurrentMutablePlayer(game).id + " begins round " + game.roundNumber + ".");
    return pieces.join(" ");
}

// Skip the active player when their restriction triggers.
function skipRestrictedCurrentTurn(gameState) {
    const game = cloneGame(gameState);
    const skippedPlayer = getCurrentMutablePlayer(game);
    const skippedPlayerIds = [skippedPlayer.id];
    const bombMessages = [];
    const bombMessage = advanceTurnCursor(game);
    const laterSkips = skipRestrictedTurns(game);

    skippedPlayer.restrictedNextTurn = false;
    skippedPlayer.nextTurnActionPower = 1;
    clearTemporaryEvents(skippedPlayer);
    clearPendingEventForPlayer(game, skippedPlayer.id);
    if (bombMessage !== "") {
        bombMessages.push(bombMessage);
    }
    beginCurrentTurn(game);
    setMessage(game, turnStartMessage(game, skippedPlayerIds.concat(laterSkips.skippedPlayerIds), bombMessages.concat(laterSkips.bombMessages)));
    return game;
}

// Every successful move, reveal, or item use spends one action. A turn ends
// automatically when the active player has no actions left.
function finishAction(game) {
    const actionMessage = game.lastMessage;

    if (game.status === "won") {
        return game;
    }

    if (game.pendingEvent !== null) {
        return game;
    }

    game.remainingActions -= 1;
    if (game.remainingActions <= 0) {
        const nextGame = endTurn(game);
        if (actionMessage !== "") {
            setMessage(nextGame, actionMessage + " " + nextGame.lastMessage);
        }
        return nextGame;
    }

    return game;
}

// Failed actions still return a fresh state object with a useful message, but
// they do not spend an action point.
function failedAction(gameState, message) {
    return setMessage(cloneGame(gameState), message);
}

// Item targets come from the UI as small objects, but tests may pass simpler
// numbers or arrays. These adapters keep the public API convenient.
function getTargetPlayerId(target) {
    if (typeof target === "number") {
        return target;
    }

    if (target && typeof target.playerId === "number") {
        return target.playerId;
    }

    if (target && typeof target.targetPlayerId === "number") {
        return target.targetPlayerId;
    }

    return null;
}

// Read and clamp a timed bomb countdown target.
function getCountdown(target) {
    if (target && Number.isInteger(target.countdown)) {
        return target.countdown;
    }

    if (target && Number.isInteger(target.turnsLeft)) {
        return target.turnsLeft;
    }

    return null;
}

// Read a two-tile target for tile-swap items.
function getTilePair(target) {
    if (Array.isArray(target) && target.length >= 2) {
        return {
            firstIndex: target[0],
            secondIndex: target[1]
        };
    }

    if (target && Number.isInteger(target.firstIndex) && Number.isInteger(target.secondIndex)) {
        return {
            firstIndex: target.firstIndex,
            secondIndex: target.secondIndex
        };
    }

    return null;
}

// Read a single tile target for remote trigger.
function getTileIndexTarget(target) {
    if (typeof target === "number") {
        return target;
    }
    if (target && Number.isInteger(target.tileIndex)) {
        return target.tileIndex;
    }
    if (target && Number.isInteger(target.index)) {
        return target.index;
    }
    return null;
}

// Read the item or key selected for thief hand.
function getTargetItemType(target) {
    if (target && typeof target.itemType === "string") {
        return target.itemType;
    }
    if (target && typeof target.stolenItemType === "string") {
        return target.stolenItemType;
    }
    return "";
}

// Validate that a tile can be used in a costly swap.
function canSwapTile(game, index) {
    const tile = Number.isInteger(index) && index >= 0 && index < BOARD_SIZE * BOARD_SIZE
        ? getTile(game, index)
        : undefined;

    return tile !== undefined && tile.revealed && !isSpawnIndex(index);
}

// Validate a tile target for remote trigger.
function canRemoteTriggerTile(game, tileIndex, playerPosition) {
    let tile;

    if (!Number.isInteger(tileIndex) || tileIndex < 0 || tileIndex >= BOARD_SIZE * BOARD_SIZE) {
        return false;
    }

    if (game.key.holderPlayerId === null && game.key.isVisible && game.key.position === tileIndex) {
        return getManhattanDistance(playerPosition, tileIndex, game.boardSize) <= 2;
    }

    tile = getTile(game, tileIndex);
    return getManhattanDistance(playerPosition, tileIndex, game.boardSize) <= 2 &&
        tile.revealed &&
        !tile.consumed &&
        tile.type !== TILE_TYPES.EMPTY &&
        tile.type !== TILE_TYPES.WALL &&
        tile.type !== TILE_TYPES.EXIT;
}

// Return whether any player currently occupies a tile.
function tileHasPlayer(game, tileIndex) {
    return game.players.some(function (player) {
        return player.position === tileIndex;
    });
}

// Swapping tile contents also moves a dropped key and can move the exit door.
// Spawn tiles stay fixed so players always keep a safe home position.
function swapTileContents(game, firstIndex, secondIndex) {
    const first = getTile(game, firstIndex);
    const second = getTile(game, secondIndex);
    const firstContent = {
        type: first.type,
        revealed: first.revealed,
        consumed: first.consumed
    };

    first.type = second.type;
    first.revealed = second.revealed;
    first.consumed = second.consumed;
    second.type = firstContent.type;
    second.revealed = firstContent.revealed;
    second.consumed = firstContent.consumed;

    if (game.key.holderPlayerId === null) {
        if (game.key.position === firstIndex) {
            game.key.position = secondIndex;
        } else if (game.key.position === secondIndex) {
            game.key.position = firstIndex;
        }
    }

    if (game.exitIndex === firstIndex) {
        game.exitIndex = secondIndex;
    } else if (game.exitIndex === secondIndex) {
        game.exitIndex = firstIndex;
    }
}

// Reveal one tile affected by a mine blast.
function revealBlastTile(game, tileIndex, explodedMineIndexes) {
    const tile = getTile(game, tileIndex);

    if (tile.revealed) {
        destroyWallTile(game, tileIndex);
        return;
    }

    if (game.key.holderPlayerId === null && !game.key.isVisible && game.key.position === tileIndex) {
        tile.revealed = true;
        game.key.isVisible = true;
        return;
    }

    tile.type = chooseTileContent(game, tileIndex);
    tile.revealed = true;
    tile.consumed = false;
    recordRevealedType(game, tile.type);

    // A mine uncovered by a blast still follows the mine rule: revealed mines
    // explode immediately, then become empty.
    if (tile.type === TILE_TYPES.MINE) {
        revealMine(game, tileIndex, explodedMineIndexes);
    } else {
        destroyWallTile(game, tileIndex);
    }
}

// Reveal all neighbours affected by a mine blast.
function revealBlastNeighbours(game, tileIndex, explodedMineIndexes) {
    let index = 0;

    while (index < game.tiles.length) {
        if (index !== tileIndex && getManhattanDistance(tileIndex, index, game.boardSize) <= MINE_BLAST_RADIUS) {
            revealBlastTile(game, index, explodedMineIndexes);
        }
        index += 1;
    }
}

// Mines kill every player within Manhattan distance 1, reveal nearby tiles,
// and then become empty. Any mine uncovered by the blast also explodes.
function revealMine(game, tileIndex, explodedMineIndexes) {
    const explodedIndexes = explodedMineIndexes || [];

    if (explodedIndexes.indexOf(tileIndex) !== -1) {
        return;
    }

    explodedIndexes.push(tileIndex);
    game.players.forEach(function (player) {
        if (getManhattanDistance(player.position, tileIndex, game.boardSize) <= MINE_BLAST_RADIUS) {
            killPlayer(game, player.id);
        }
    });
    consumeTile(game, tileIndex);
    destroyBlastWalls(game, tileIndex);
    revealBlastNeighbours(game, tileIndex, explodedIndexes);
}

/**
 * Creates a new hidden-tile party board game for two to four local players.
 * The centre exit and corner spawns are fixed, while the key location and
 * future tile contents can be seeded or supplied for deterministic tests.
 *
 * @param {number} playerCount - Number of local players, from 2 to 4.
 * @param {object} [options] - Optional deterministic setup controls.
 * @param {number} [options.seed] - Seed used for repeatable random choices.
 * @param {number} [options.keyPosition] - Fixed hidden tile for the unique key.
 * @param {number} [options.keyRevealNumber] - Forced key reveal number, 1-8.
 * @param {object} [options.tileContents] - Tile content overrides by index.
 * @param {string[]} [options.tileContentSequence] - Queued contents for reveals.
 * @returns {object} A new game state ready for the first player turn.
 */
export function createGame(playerCount, options) {
    const setup = normalizeOptions(options);

    if (!Number.isInteger(playerCount) || playerCount < 2 || playerCount > 4) {
        throw new RangeError("playerCount must be an integer from 2 to 4.");
    }

    const keyChoice = chooseKeyPosition(playerCount, setup);
    return {
        boardSize: BOARD_SIZE,
        exitIndex: EXIT_INDEX,
        roundNumber: 1,
        currentPlayerIndex: 0,
        remainingActions: 1,
        revealCount: 0,
        keyRevealNumber: chooseKeyRevealNumber(playerCount, setup),
        pendingEvent: null,
        status: "playing",
        winnerId: null,
        rngSeed: keyChoice.seed,
        key: {
            position: keyChoice.position,
            holderPlayerId: null,
            isVisible: false
        },
        tiles: makeTiles(),
        players: makePlayers(playerCount),
        revealedTypeCounts: {},
        plannedTileContents: copyPlannedContents(setup),
        queuedTileContents: (setup.tileContentSequence || []).slice(),
        lastMessage: "Player 1 begins round 1."
    };
}

/**
 * Returns the player whose turn is currently active.
 *
 * @param {object} gameState - Current game state.
 * @returns {object} The active player state.
 */
export function getCurrentPlayer(gameState) {
    return clonePlayer(gameState.players[gameState.currentPlayerIndex]);
}

/**
 * Converts a one-dimensional board index into row and column coordinates.
 *
 * @param {number} index - Tile index on the board.
 * @param {number} [boardSize=BOARD_SIZE] - Width and height of the square board.
 * @returns {object} Row and column coordinates for the index.
 */
export function getCoordinates(index, boardSize = BOARD_SIZE) {
    return {
        row: Math.floor(index / boardSize),
        col: index % boardSize
    };
}

/**
 * Converts row and column coordinates into the board's one-dimensional index.
 *
 * @param {number} row - Tile row.
 * @param {number} col - Tile column.
 * @param {number} [boardSize=BOARD_SIZE] - Width and height of the square board.
 * @returns {number} One-dimensional tile index, or -1 when outside the board.
 */
export function getIndex(row, col, boardSize = BOARD_SIZE) {
    if (row < 0 || row >= boardSize || col < 0 || col >= boardSize) {
        return -1;
    }
    return row * boardSize + col;
}

/**
 * Measures the Manhattan distance between two board tiles.
 *
 * @param {number} indexA - First tile index.
 * @param {number} indexB - Second tile index.
 * @param {number} [boardSize=BOARD_SIZE] - Width and height of the square board.
 * @returns {number} Orthogonal grid distance between the two tiles.
 */
export function getManhattanDistance(indexA, indexB, boardSize = BOARD_SIZE) {
    const first = getCoordinates(indexA, boardSize);
    const second = getCoordinates(indexB, boardSize);
    return Math.abs(first.row - second.row) + Math.abs(first.col - second.col);
}

/**
 * Finds the neighbouring tile reached by moving one step in a direction.
 *
 * @param {number} position - Current tile index.
 * @param {string} direction - One of the exported direction constants.
 * @param {number} [boardSize=BOARD_SIZE] - Width and height of the square board.
 * @returns {number} Next tile index, or -1 if the move leaves the board.
 */
export function getNextPosition(position, direction, boardSize = BOARD_SIZE) {
    const coordinates = getCoordinates(position, boardSize);
    let row = coordinates.row;
    let col = coordinates.col;

    if (direction === DIRECTIONS.UP) {
        row -= 1;
    } else if (direction === DIRECTIONS.DOWN) {
        row += 1;
    } else if (direction === DIRECTIONS.LEFT) {
        col -= 1;
    } else if (direction === DIRECTIONS.RIGHT) {
        col += 1;
    } else {
        return -1;
    }

    return getIndex(row, col, boardSize);
}

/**
 * Moves the current player one orthogonal revealed tile, resolving key pickup,
 * stealing, bomb passing, visible tile effects, and a possible win at the exit.
 *
 * @param {object} gameState - Current game state.
 * @param {string} direction - Direction to move.
 * @returns {object} New game state after the move or a blocked-action state.
 */
export function moveCurrentPlayer(gameState, direction) {
    if (gameState.status === "won") {
        return failedAction(gameState, "The game has already been won.");
    }

    const current = gameState.players[gameState.currentPlayerIndex];
    if (current.restrictedNextTurn) {
        return skipRestrictedCurrentTurn(gameState);
    }

    const nextPosition = getNextPosition(current.position, direction, gameState.boardSize);
    if (nextPosition === -1) {
        return failedAction(gameState, "That move leaves the board.");
    }

    const targetTile = gameState.tiles[nextPosition];
    if (!targetTile.revealed) {
        return failedAction(gameState, "Hidden tiles must be revealed before players can move onto them.");
    }

    if (targetTile.revealed && targetTile.type === TILE_TYPES.WALL) {
        return failedAction(gameState, "A revealed wall blocks that tile.");
    }

    const game = cloneGame(gameState);
    const player = getCurrentMutablePlayer(game);
    const keyHolderBefore = gameState.key.holderPlayerId;
    player.position = nextPosition;
    player.turnsWithoutMove = 0;
    player.movedThisTurn = true;

    // Movement resolves in a fixed order: contact effects, visible key pickup,
    // visible tile effect, then win detection.
    stealKeyAtCurrentPosition(game, player.id);
    passBombFromMover(game, player.id);
    pickUpVisibleKey(game, player.id);
    const steppedTileMessage = resolveSteppedTile(game, player.id);
    pickUpVisibleKey(game, player.id);
    stealKeyAtCurrentPosition(game, player.id);
    checkWin(game, player.id);

    if (game.status !== "won") {
        if (game.key.holderPlayerId === player.id && keyHolderBefore !== player.id) {
            setMessage(game, "Player " + player.id + " got the key.");
        } else if (player.position === game.exitIndex && !player.hasKey) {
            setMessage(game, "Need the key to open the door.");
        } else {
            setMessage(game, steppedTileMessage || "Moved.");
        }
    }

    return finishAction(game);
}

/**
 * Reveals a hidden tile. Revealed mines explode immediately, while the unique
 * key becomes visible without being picked up or granting any item.
 *
 * @param {object} gameState - Current game state.
 * @param {number} tileIndex - Tile index to reveal.
 * @returns {object} New game state after revealing the tile.
 */
export function revealTile(gameState, tileIndex) {
    if (gameState.players[gameState.currentPlayerIndex].restrictedNextTurn) {
        return skipRestrictedCurrentTurn(gameState);
    }

    if (!Number.isInteger(tileIndex) || tileIndex < 0 || tileIndex >= gameState.tiles.length) {
        return failedAction(gameState, "Choose a tile on the board.");
    }

    const originalTile = gameState.tiles[tileIndex];
    if (originalTile.revealed) {
        return failedAction(gameState, "That tile is already revealed.");
    }

    const game = cloneGame(gameState);
    const tile = getTile(game, tileIndex);
    const revealNumber = game.revealCount + 1;
    const isScheduledKeyReveal = game.key.holderPlayerId === null &&
        !game.key.isVisible &&
        revealNumber >= game.keyRevealNumber;

    game.revealCount += 1;
    if (game.key.holderPlayerId === null && !game.key.isVisible &&
            (tileIndex === game.key.position || isScheduledKeyReveal)) {
        game.key.position = tileIndex;
        tile.revealed = true;
        game.key.isVisible = true;
        setMessage(game, "Key is Found!");
        return finishAction(game);
    }

    tile.type = chooseTileContent(game, tileIndex);
    tile.revealed = true;
    tile.consumed = false;
    recordRevealedType(game, tile.type);

    if (tile.type === TILE_TYPES.MINE) {
        revealMine(game, tileIndex);
        setMessage(game, tileEffectDescription(TILE_TYPES.MINE));
    } else {
        setMessage(game, tileEffectDescription(tile.type));
    }

    return finishAction(game);
}

/**
 * Uses one item held by the current player. Targets are supplied as small data
 * objects, such as a player id for player items or two tile indices for swaps.
 *
 * @param {object} gameState - Current game state.
 * @param {string} itemType - Item type to use.
 * @param {object|number|number[]} target - Target data for the chosen item.
 * @returns {object} New game state after using the item, or unchanged on failure.
 */
export function useCurrentPlayerItem(gameState, itemType, target) {
    if (gameState.status === "won") {
        return failedAction(gameState, "The game has already been won.");
    }

    const originalPlayer = gameState.players[gameState.currentPlayerIndex];
    if (originalPlayer.restrictedNextTurn) {
        return skipRestrictedCurrentTurn(gameState);
    }

    if (originalPlayer.items.indexOf(itemType) === -1) {
        return failedAction(gameState, "Player " + originalPlayer.id + " does not have that item.");
    }

    const game = cloneGame(gameState);
    const player = getCurrentMutablePlayer(game);
    const playerId = player.id;
    const pendingEventMatches = game.pendingEvent !== null &&
        game.pendingEvent.playerId === playerId &&
        game.pendingEvent.itemType === itemType;
    let succeeded = false;
    let actionMessage = "";
    let stolenItemTypeToAdd = "";

    if (itemType === ITEM_TYPES.TIMED_BOMB_PACK) {
        const targetPlayerId = getTargetPlayerId(target);
        const countdown = getCountdown(target);
        const targetPlayer = getPlayer(game, targetPlayerId);

        if (targetPlayer === undefined || !Number.isInteger(countdown) || countdown < 1 || countdown > 20) {
            return failedAction(gameState, "A timed bomb needs a target player and 1-20 turn countdown.");
        }

        targetPlayer.bomb = {
            turnsLeft: countdown,
            sourcePlayerId: playerId
        };
        actionMessage = "Timed bomb placed: Player " + targetPlayerId + " has a " + countdown + " turn countdown.";
        succeeded = true;
    } else if (itemType === ITEM_TYPES.RESTRICT_MOVE) {
        const targetPlayer = getPlayer(game, getTargetPlayerId(target));

        if (targetPlayer === undefined) {
            return failedAction(gameState, "Choose a player to restrict.");
        }

        targetPlayer.restrictedNextTurn = true;
        actionMessage = "Restrict move used: Player " + targetPlayer.id + " will skip their next turn.";
        succeeded = true;
    } else if (itemType === ITEM_TYPES.SWAP_PLAYER) {
        const targetPlayer = getPlayer(game, getTargetPlayerId(target));

        if (targetPlayer === undefined || targetPlayer.id === playerId) {
            return failedAction(gameState, "Choose another player to swap with.");
        }

        const oldPosition = player.position;
        player.position = targetPlayer.position;
        targetPlayer.position = oldPosition;
        // Swapping is movement-like for player contact, but deliberately does
        // not trigger tile contents because no one stepped onto a tile.
        pickUpVisibleKey(game, playerId);
        stealKeyAtCurrentPosition(game, playerId);
        checkWin(game, playerId);
        actionMessage = "Positions swapped.";
        succeeded = true;
    } else if (itemType === ITEM_TYPES.SWAP_ANY_TILES_WITH_HP_COST) {
        const pair = getTilePair(target);

        if (pair === null || !canSwapTile(game, pair.firstIndex) || !canSwapTile(game, pair.secondIndex) ||
                tileHasPlayer(game, pair.firstIndex) || tileHasPlayer(game, pair.secondIndex) ||
                pair.firstIndex === pair.secondIndex) {
            return failedAction(gameState, "Choose two different revealed, unoccupied non-spawn tiles.");
        }

        swapTileContents(game, pair.firstIndex, pair.secondIndex);
        damagePlayer(game, playerId, 1);
        actionMessage = "Costly swap used: tiles " + pair.firstIndex + " and " + pair.secondIndex + " were swapped. Player " + playerId + " lost 1 HP.";
        succeeded = true;
    } else if (itemType === ITEM_TYPES.MAGNET) {
        if (player.hasKey) {
            return failedAction(gameState, "The key is already yours.");
        }

        if (game.key.holderPlayerId !== null) {
            const holder = getPlayer(game, game.key.holderPlayerId);
            if (holder.id !== playerId && getManhattanDistance(player.position, holder.position, game.boardSize) <= 3) {
                holder.hasKey = false;
                player.hasKey = true;
                game.key.holderPlayerId = playerId;
                game.key.position = player.position;
                game.key.isVisible = true;
                checkWin(game, playerId);
                actionMessage = "Player " + playerId + " got the key.";
                succeeded = true;
            }
        } else if (game.key.isVisible && getManhattanDistance(player.position, game.key.position, game.boardSize) <= 3) {
            game.key.holderPlayerId = playerId;
            game.key.position = player.position;
            player.hasKey = true;
            checkWin(game, playerId);
            actionMessage = "Player " + playerId + " got the key.";
            succeeded = true;
        }

        if (!succeeded) {
            return failedAction(gameState, "No visible key is within magnet range.");
        }
    } else if (itemType === ITEM_TYPES.THIEF_HAND) {
        const targetPlayerId = getTargetPlayerId(target);
        const stolenItemType = getTargetItemType(target);
        const targetPlayer = getPlayer(game, targetPlayerId);

        if (targetPlayer === undefined || targetPlayer.id === playerId || stolenItemType === "") {
            return failedAction(gameState, "Choose another player's item to steal.");
        }
        if (stolenItemType === KEY_STEAL_TARGET) {
            if (player.hasKey) {
                return failedAction(gameState, "The key is already yours.");
            }
            if (!targetPlayer.hasKey || game.key.holderPlayerId !== targetPlayer.id) {
                return failedAction(gameState, "That player does not have the key.");
            }

            targetPlayer.hasKey = false;
            player.hasKey = true;
            game.key.holderPlayerId = playerId;
            game.key.position = player.position;
            game.key.isVisible = true;
            checkWin(game, playerId);
            actionMessage = "Player " + playerId + " got the key.";
            succeeded = true;
        } else {
            if (targetPlayer.items.indexOf(stolenItemType) === -1) {
                return failedAction(gameState, "That player does not have the chosen item.");
            }
            if (stolenItemType !== itemType && player.items.indexOf(stolenItemType) !== -1) {
                return failedAction(gameState, "Duplicate item blocked: this player already has " + readableItemName(stolenItemType) + ".");
            }

            removeOneItem(targetPlayer, stolenItemType);
            stolenItemTypeToAdd = stolenItemType;
            actionMessage = "Thief hand used: stole " + readableItemName(stolenItemType) + " from Player " + targetPlayer.id + ".";
            succeeded = true;
        }
    } else if (itemType === ITEM_TYPES.REMOTE_TRIGGER) {
        const tileIndex = getTileIndexTarget(target);
        let triggeredMessage = "";

        if (canRemoteTriggerTile(game, tileIndex, player.position)) {
            if (game.key.holderPlayerId === null && game.key.isVisible && game.key.position === tileIndex) {
                game.key.holderPlayerId = playerId;
                game.key.position = player.position;
                player.hasKey = true;
                checkWin(game, playerId);
                triggeredMessage = "Player " + playerId + " got the key.";
            } else {
                triggeredMessage = resolveTileEffectAt(game, playerId, tileIndex);
            }
        }

        if (triggeredMessage === "") {
            return failedAction(gameState, "Choose a revealed event or item within 2 tiles.");
        }

        actionMessage = "Remote trigger used: " + triggeredMessage;
        succeeded = true;
    } else if (itemType === ITEM_TYPES.BOMB_DEFUSER) {
        if (player.bomb === null) {
            return failedAction(gameState, "No timed bomb is installed on this player.");
        }

        player.bomb = null;
        actionMessage = "Bomb defuser used: timed bomb removed.";
        succeeded = true;
    } else {
        return failedAction(gameState, "That item type is not recognised.");
    }

    if (succeeded) {
        removeOneItem(player, itemType);
        if (stolenItemTypeToAdd !== "") {
            addItemToPlayer(game, playerId, stolenItemTypeToAdd);
        }
        if (pendingEventMatches) {
            game.pendingEvent = null;
        }
        if (game.status !== "won") {
            setMessage(game, actionMessage);
        }
        return finishAction(game);
    }

    return failedAction(gameState, "The item had no valid effect.");
}

/**
 * Lets the current player spend one action to detonate a timed bomb they
 * installed earlier, without waiting for the carrier's countdown to reach 0.
 *
 * @param {object} gameState - Current game state.
 * @param {object|number} target - Bomb carrier player id or target object.
 * @returns {object} New game state after the early detonation, or unchanged on failure.
 */
export function detonateCurrentPlayerBomb(gameState, target) {
    if (gameState.status === "won") {
        return failedAction(gameState, "The game has already been won.");
    }

    const originalPlayer = gameState.players[gameState.currentPlayerIndex];
    if (originalPlayer.restrictedNextTurn) {
        return skipRestrictedCurrentTurn(gameState);
    }

    const targetPlayerId = getTargetPlayerId(target);
    const targetPlayer = gameState.players.find(function (player) {
        return player.id === targetPlayerId;
    });

    if (targetPlayer === undefined || targetPlayer.bomb === null ||
            targetPlayer.bomb.sourcePlayerId !== originalPlayer.id) {
        return failedAction(gameState, "Choose one of your installed bombs to detonate.");
    }

    const game = cloneGame(gameState);
    const bombCarrier = getPlayer(game, targetPlayerId);

    applyTimedBombExplosions(game, [{
        playerId: bombCarrier.id,
        position: bombCarrier.position
    }]);
    return finishAction(game);
}

/**
 * Dismisses a temporary current-turn event without spending an action. Stored
 * items such as the magnet are intentionally preserved by this helper.
 *
 * @param {object} gameState - Current game state.
 * @param {string} itemType - Temporary event type to dismiss.
 * @returns {object} New game state with that temporary event removed.
 */
export function discardCurrentPlayerItem(gameState, itemType) {
    const originalPlayer = gameState.players[gameState.currentPlayerIndex];
    const originalPendingEventMatches = gameState.pendingEvent !== null &&
        gameState.pendingEvent !== undefined &&
        gameState.pendingEvent.playerId === originalPlayer.id &&
        gameState.pendingEvent.itemType === itemType;

    if (originalPlayer.restrictedNextTurn) {
        return skipRestrictedCurrentTurn(gameState);
    }

    if (!isTemporaryEventItem(itemType) || originalPlayer.items.indexOf(itemType) === -1 ||
            (!hasTemporaryItem(originalPlayer, itemType) && !originalPendingEventMatches)) {
        return failedAction(gameState, "No temporary event was dismissed.");
    }

    const game = cloneGame(gameState);
    const player = getCurrentMutablePlayer(game);
    const pendingEventMatches = game.pendingEvent !== null &&
        game.pendingEvent.playerId === player.id &&
        game.pendingEvent.itemType === itemType;

    removeOneItem(player, itemType);
    if (pendingEventMatches) {
        game.pendingEvent = null;
    }
    setMessage(game, readableItemName(itemType) + " event dismissed.");
    return pendingEventMatches ? finishAction(game) : game;
}

/**
 * Ends the active player's turn, skips any players restricted for their next
 * turn, starts the next available player, and ticks the active player's bomb.
 *
 * @param {object} gameState - Current game state.
 * @returns {object} New game state at the start of the next turn.
 */
export function endTurn(gameState) {
    if (gameState.status === "won") {
        return cloneGame(gameState);
    }

    const game = cloneGame(gameState);
    const current = getCurrentMutablePlayer(game);
    const bombMessages = [];
    const skippedTurns = [];
    const bombMessage = advanceTurnCursor(game);
    const laterSkips = skipRestrictedTurns(game);

    clearTemporaryEvents(current);
    clearPendingEventForPlayer(game, current.id);
    if (bombMessage !== "") {
        bombMessages.push(bombMessage);
    }
    skippedTurns.push(...laterSkips.skippedPlayerIds);
    bombMessages.push(...laterSkips.bombMessages);
    beginCurrentTurn(game);
    setMessage(game, turnStartMessage(game, skippedTurns, bombMessages));
    return game;
}

/**
 * Reports whether any player has won the game.
 *
 * @param {object} gameState - Current game state.
 * @returns {boolean} True once a key holder reaches the centre exit.
 */
export function isGameWon(gameState) {
    return gameState.status === "won";
}

/**
 * Builds a presentation-safe view of the board for the browser UI. Hidden tile
 * contents remain hidden, while visible key, exit, players, and bombs are shown.
 *
 * @param {object} gameState - Current game state.
 * @returns {object[]} Visible tile descriptions for rendering the board.
 */
export function getVisibleBoard(gameState) {
    return gameState.tiles.map(function (tile) {
        const players = gameState.players.filter(function (player) {
            return player.position === tile.index;
        }).map(function (player) {
            return {
                id: player.id,
                hp: player.hp,
                maxHp: player.maxHp,
                hasKey: player.hasKey,
                bomb: player.bomb === null ? null : {
                    turnsLeft: player.bomb.turnsLeft,
                    sourcePlayerId: player.bomb.sourcePlayerId
                }
            };
        });

        return {
            index: tile.index,
            coordinates: getCoordinates(tile.index, gameState.boardSize),
            revealed: tile.revealed,
            type: tile.revealed ? tile.type : null,
            isExit: tile.index === gameState.exitIndex,
            isSpawn: isSpawnIndex(tile.index),
            hasVisibleKey: gameState.key.holderPlayerId === null && gameState.key.isVisible && gameState.key.position === tile.index,
            players
        };
    });
}
