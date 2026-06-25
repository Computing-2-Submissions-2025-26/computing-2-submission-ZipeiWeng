// Behaviour tests for the game module only.
// These tests build small game situations and assert player-visible outcomes,
// avoiding DOM details and avoiding re-implementing the game rules.

import assert from "node:assert/strict";
import {
    BOARD_SIZE,
    DIRECTIONS,
    EXIT_INDEX,
    ITEM_TYPES,
    TILE_TYPES,
    createGame,
    detonateCurrentPlayerBomb,
    discardCurrentPlayerItem,
    endTurn,
    getCoordinates,
    getCurrentPlayer,
    getIndex,
    getManhattanDistance,
    isGameWon,
    moveCurrentPlayer,
    revealTile,
    useCurrentPlayerItem
} from "../game.js";

// Test fixtures copy state instead of mutating the real game object. This keeps
// the immutability tests meaningful and makes each scenario easy to read.
function copyPlayer(player, patch) {
    return Object.assign({}, player, {
        items: player.items.slice(),
        temporaryItems: (player.temporaryItems || []).slice(),
        bomb: player.bomb === null ? null : Object.assign({}, player.bomb)
    }, patch || {});
}

// Return a test game with one patched player.
function withPlayer(game, playerId, patch) {
    return Object.assign({}, game, {
        players: game.players.map(function (player) {
            if (player.id === playerId) {
                return copyPlayer(player, patch);
            }
            return copyPlayer(player);
        })
    });
}

// Return a test game with patched key state.
function withKey(game, patch) {
    return Object.assign({}, game, {
        key: Object.assign({}, game.key, patch)
    });
}

// Return a test game with one patched tile.
function withTile(game, index, patch) {
    return Object.assign({}, game, {
        tiles: game.tiles.map(function (tile) {
            if (tile.index === index) {
                return Object.assign({}, tile, patch);
            }
            return Object.assign({}, tile);
        })
    });
}

// Most tests use a fixed key position so random choices do not make behaviour
// checks flaky.
function makeGame(options) {
    return createGame(2, Object.assign({
        keyPosition: 10,
        keyRevealNumber: 8
    }, options || {}));
}

describe("Journey game module", function () {
    it("createGame creates a 9x9 board", function () {
        const game = makeGame();

        assert.equal(game.boardSize, BOARD_SIZE);
        assert.equal(game.tiles.length, 81);
    });

    it("createGame places 2-4 players in the correct corner spawns", function () {
        assert.deepEqual(createGame(2, {keyPosition: 10}).players.map(function (player) {
            return player.position;
        }), [0, 8]);
        assert.deepEqual(createGame(3, {keyPosition: 10}).players.map(function (player) {
            return player.position;
        }), [0, 8, 72]);
        assert.deepEqual(createGame(4, {keyPosition: 10}).players.map(function (player) {
            return player.position;
        }), [0, 8, 72, 80]);
    });

    it("createGame sets the centre exit at index 40", function () {
        const game = makeGame();

        assert.equal(game.exitIndex, EXIT_INDEX);
        assert.equal(game.tiles[EXIT_INDEX].type, TILE_TYPES.EXIT);
        assert.equal(game.tiles[EXIT_INDEX].revealed, true);
    });

    it("createGame creates exactly one key position", function () {
        const game = makeGame({keyPosition: 22});

        assert.equal(game.key.position, 22);
        assert.equal(game.key.holderPlayerId, null);
        assert.equal(game.key.isVisible, false);
    });

    it("randomises the forced key reveal inside the first eight reveals", function () {
        const revealNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(function (seed) {
            return createGame(2, {seed, keyPosition: 10}).keyRevealNumber;
        });

        assert.ok(revealNumbers.every(function (revealNumber) {
            return revealNumber >= 1 && revealNumber <= 8;
        }));
        assert.ok(revealNumbers.some(function (revealNumber) {
            return revealNumber !== 8;
        }));
    });

    it("reveals the key on the scheduled hidden tile reveal", function () {
        let game = makeGame({
            keyPosition: 70,
            keyRevealNumber: 2,
            tileContents: {
                "11": TILE_TYPES.EMPTY,
                "12": TILE_TYPES.EMPTY,
                "13": TILE_TYPES.EMPTY
            }
        });

        game = revealTile(game, 11);
        assert.equal(game.key.isVisible, false);

        game = revealTile(game, 12);

        assert.equal(game.key.position, 12);
        assert.equal(game.key.isVisible, true);
        assert.equal(game.lastMessage.indexOf("Key is Found!"), 0);
    });

    it("getCoordinates and getIndex convert between index and coordinates", function () {
        assert.deepEqual(getCoordinates(40), {row: 4, col: 4});
        assert.equal(getIndex(4, 4), 40);
        assert.equal(getIndex(-1, 0), -1);
    });

    it("getManhattanDistance measures orthogonal board distance", function () {
        assert.equal(getManhattanDistance(0, 40), 8);
        assert.equal(getManhattanDistance(10, 12), 2);
    });

    it("current player advances after ending a turn", function () {
        const game = endTurn(makeGame());

        assert.equal(getCurrentPlayer(game).id, 2);
    });

    it("roundNumber increases after all players have acted", function () {
        let game = makeGame();

        game = endTurn(game);
        game = endTurn(game);

        assert.equal(game.roundNumber, 2);
        assert.equal(getCurrentPlayer(game).id, 1);
    });

    it("players receive a random tool after five own turns without moving", function () {
        const rewardItems = [
            ITEM_TYPES.SWAP_ANY_TILES_WITH_HP_COST,
            ITEM_TYPES.SWAP_PLAYER,
            ITEM_TYPES.TIMED_BOMB_PACK,
            ITEM_TYPES.THIEF_HAND
        ];
        let game = makeGame({seed: 12});

        game = endTurn(game);
        game = endTurn(game);
        game = endTurn(game);
        game = endTurn(game);
        game = endTurn(game);
        game = endTurn(game);
        game = endTurn(game);
        game = endTurn(game);
        game = endTurn(game);

        assert.equal(game.players[0].items.length, 1);
        assert.ok(rewardItems.indexOf(game.players[0].items[0]) !== -1);
        assert.equal(game.players[0].turnsWithoutMove, 0);
        assert.ok(game.lastMessage.indexOf("after 5 turns without moving") !== -1);
    });

    it("moving resets the no-move reward counter", function () {
        let game = withPlayer(makeGame(), 1, {turnsWithoutMove: 2});
        game = withTile(game, 1, {
            type: TILE_TYPES.EMPTY,
            revealed: true,
            consumed: false
        });

        game = moveCurrentPlayer(game, DIRECTIONS.RIGHT);

        assert.equal(game.players[0].turnsWithoutMove, 0);
        assert.equal(game.players[0].movedThisTurn, false);
        assert.deepEqual(game.players[0].items, []);
    });

    it("moving one tile works", function () {
        const game = moveCurrentPlayer(withTile(makeGame(), 1, {
            type: TILE_TYPES.EMPTY,
            revealed: true,
            consumed: false
        }), DIRECTIONS.RIGHT);

        assert.equal(game.players[0].position, 1);
    });

    it("moving outside the board is blocked", function () {
        const game = makeGame();
        const moved = moveCurrentPlayer(game, DIRECTIONS.UP);

        assert.equal(moved.players[0].position, 0);
        assert.equal(getCurrentPlayer(moved).id, 1);
    });

    it("moving into a revealed wall is blocked", function () {
        const game = withTile(makeGame(), 1, {
            type: TILE_TYPES.WALL,
            revealed: true,
            consumed: false
        });
        const moved = moveCurrentPlayer(game, DIRECTIONS.RIGHT);

        assert.equal(moved.players[0].position, 0);
    });

    it("unrevealed tiles cannot be entered", function () {
        let game = makeGame({tileContents: {"1": TILE_TYPES.FULL_HEAL}});
        game = withPlayer(game, 1, {hp: 1});

        const moved = moveCurrentPlayer(game, DIRECTIONS.RIGHT);

        assert.equal(moved.players[0].position, 0);
        assert.equal(moved.players[0].hp, 1);
        assert.equal(getCurrentPlayer(moved).id, 1);
    });

    it("revealTile reveals a hidden tile", function () {
        const game = revealTile(makeGame({tileContents: {"1": TILE_TYPES.EMPTY}}), 1);

        assert.equal(game.tiles[1].revealed, true);
        assert.equal(game.tiles[1].type, TILE_TYPES.EMPTY);
    });

    it("revealing the key tile does not grant a magnet item", function () {
        const game = revealTile(makeGame({keyPosition: 1}), 1);

        assert.equal(game.key.isVisible, true);
        assert.equal(game.players[0].hasKey, false);
        assert.deepEqual(game.players[0].items, []);
    });

    it("stepping onto the revealed key tile gives the key", function () {
        let game = revealTile(makeGame({keyPosition: 1}), 1);
        game = endTurn(game);
        game = moveCurrentPlayer(game, DIRECTIONS.RIGHT);

        assert.equal(game.players[0].hasKey, true);
        assert.equal(game.key.holderPlayerId, 1);
        assert.ok(game.lastMessage.indexOf("got the key") !== -1);
    });

    it("stepping onto the exit with the key wins", function () {
        let game = makeGame();
        game = withPlayer(game, 1, {position: 39, hasKey: true});
        game = withKey(game, {holderPlayerId: 1, isVisible: true, position: 39});

        const moved = moveCurrentPlayer(game, DIRECTIONS.RIGHT);

        assert.equal(isGameWon(moved), true);
        assert.equal(moved.winnerId, 1);
    });

    it("stepping onto the exit without the key does not win", function () {
        let game = makeGame();
        game = withPlayer(game, 1, {position: 39});

        const moved = moveCurrentPlayer(game, DIRECTIONS.RIGHT);

        assert.equal(isGameWon(moved), false);
        assert.equal(moved.lastMessage.indexOf("Need the key to open the door."), 0);
    });

    it("key stealing happens when a player moves onto the key holder", function () {
        let game = makeGame();
        game = withPlayer(game, 1, {position: 0});
        game = withPlayer(game, 2, {position: 1, hasKey: true});
        game = withKey(game, {holderPlayerId: 2, isVisible: true, position: 1});
        game = withTile(game, 1, {type: TILE_TYPES.EMPTY, revealed: true, consumed: false});

        const moved = moveCurrentPlayer(game, DIRECTIONS.RIGHT);

        assert.equal(moved.players[0].hasKey, true);
        assert.equal(moved.players[1].hasKey, false);
        assert.equal(moved.key.holderPlayerId, 1);
        assert.ok(moved.lastMessage.indexOf("got the key") !== -1);
    });

    it("stolen key does not grant the previous holder a magnet", function () {
        let game = makeGame();
        game = withPlayer(game, 2, {position: 1, hasKey: true});
        game = withKey(game, {holderPlayerId: 2, isVisible: true, position: 1});
        game = withTile(game, 1, {type: TILE_TYPES.EMPTY, revealed: true, consumed: false});

        const moved = moveCurrentPlayer(game, DIRECTIONS.RIGHT);

        assert.deepEqual(moved.players[1].items, []);
    });

    it("dead key holder drops the key at the death position", function () {
        let game = makeGame({tileContents: {"2": TILE_TYPES.MINE}});
        game = withPlayer(game, 1, {position: 1, hasKey: true});
        game = withKey(game, {holderPlayerId: 1, isVisible: true, position: 1});

        const revealed = revealTile(game, 2);

        assert.equal(revealed.players[0].position, 0);
        assert.equal(revealed.players[0].hasKey, false);
        assert.equal(revealed.key.holderPlayerId, null);
        assert.equal(revealed.key.position, 1);
    });

    it("fullHeal restores HP", function () {
        let game = withTile(makeGame(), 1, {
            type: TILE_TYPES.FULL_HEAL,
            revealed: true,
            consumed: false
        });
        game = withPlayer(game, 1, {hp: 1});

        const moved = moveCurrentPlayer(game, DIRECTIONS.RIGHT);

        assert.equal(moved.players[0].hp, 3);
    });

    it("monsterCamp damages the player and is consumed", function () {
        let game = withTile(makeGame(), 1, {
            type: TILE_TYPES.MONSTER_CAMP,
            revealed: true,
            consumed: false
        });
        game = withPlayer(game, 1, {hp: 3});

        const moved = moveCurrentPlayer(game, DIRECTIONS.RIGHT);

        assert.equal(moved.players[0].hp, 2);
        assert.equal(moved.players[0].position, 1);
        assert.equal(moved.tiles[1].type, TILE_TYPES.EMPTY);
        assert.equal(moved.tiles[1].consumed, true);
        assert.ok(moved.lastMessage.indexOf("Monster camp attacked") !== -1);
    });

    it("monsterCamp knocks out a player at 1 HP", function () {
        let game = withTile(makeGame(), 1, {
            type: TILE_TYPES.MONSTER_CAMP,
            revealed: true,
            consumed: false
        });
        game = withPlayer(game, 1, {hp: 1});

        const moved = moveCurrentPlayer(game, DIRECTIONS.RIGHT);

        assert.equal(moved.players[0].position, 0);
        assert.equal(moved.players[0].hp, 3);
        assert.ok(moved.lastMessage.indexOf("reset to spawn") !== -1);
    });

    it("restrictMove skips the target player's next turn", function () {
        let game = withPlayer(makeGame(), 1, {items: [ITEM_TYPES.RESTRICT_MOVE]});
        game = useCurrentPlayerItem(game, ITEM_TYPES.RESTRICT_MOVE, {playerId: 2});

        assert.equal(getCurrentPlayer(game).id, 1);
        assert.equal(game.players[1].position, 8);
        assert.equal(game.players[1].restrictedNextTurn, false);
        assert.ok(game.lastMessage.indexOf("skipped a restricted turn") !== -1);
    });

    it("restricted players cannot reveal instead of losing the turn", function () {
        let game = withPlayer(makeGame({tileContents: {"2": TILE_TYPES.EMPTY}}), 1, {
            restrictedNextTurn: true
        });
        game = Object.assign({}, game, {remainingActions: 3});
        game = withTile(game, 1, {type: TILE_TYPES.EMPTY, revealed: true, consumed: false});

        const skipped = revealTile(game, 2);

        assert.equal(skipped.tiles[2].revealed, false);
        assert.equal(skipped.players[0].restrictedNextTurn, false);
        assert.equal(getCurrentPlayer(skipped).id, 2);
    });

    it("swapPlayer swaps positions without resolving tile events", function () {
        let game = withPlayer(makeGame(), 1, {items: [ITEM_TYPES.SWAP_PLAYER]});

        game = useCurrentPlayerItem(game, ITEM_TYPES.SWAP_PLAYER, {playerId: 2});

        assert.equal(game.players[0].position, 8);
        assert.equal(game.players[1].position, 0);
        assert.equal(game.lastMessage.indexOf("Positions swapped."), 0);
        assert.equal(game.lastMessage.indexOf("tile"), -1);
    });

    it("actionBoost gives the current player 2 more actions", function () {
        let game = withTile(makeGame(), 1, {
            type: TILE_TYPES.ACTION_BOOST,
            revealed: true,
            consumed: false
        });

        game = moveCurrentPlayer(game, DIRECTIONS.RIGHT);

        assert.equal(getCurrentPlayer(game).id, 1);
        assert.equal(game.remainingActions, 2);
    });

    it("swapAnyTilesWithHpCost swaps any two allowed tiles and costs 1 HP", function () {
        let game = withPlayer(makeGame(), 1, {items: [ITEM_TYPES.SWAP_ANY_TILES_WITH_HP_COST], hp: 3});
        game = withTile(game, 1, {type: TILE_TYPES.WALL, revealed: true, consumed: false});
        game = withTile(game, 10, {type: TILE_TYPES.MAGNET, revealed: true, consumed: false});

        const swapped = useCurrentPlayerItem(game, ITEM_TYPES.SWAP_ANY_TILES_WITH_HP_COST, {firstIndex: 1, secondIndex: 10});

        assert.equal(swapped.tiles[1].type, TILE_TYPES.MAGNET);
        assert.equal(swapped.tiles[10].type, TILE_TYPES.WALL);
        assert.equal(swapped.players[0].hp, 2);
    });

    it("swapAnyTilesWithHpCost cannot swap a tile occupied by a player", function () {
        let game = withPlayer(makeGame(), 1, {
            position: 1,
            items: [ITEM_TYPES.SWAP_ANY_TILES_WITH_HP_COST],
            hp: 3
        });
        game = withTile(game, 1, {type: TILE_TYPES.WALL, revealed: true, consumed: false});
        game = withTile(game, 10, {type: TILE_TYPES.MAGNET, revealed: true, consumed: false});

        const failed = useCurrentPlayerItem(game, ITEM_TYPES.SWAP_ANY_TILES_WITH_HP_COST, {
            firstIndex: 1,
            secondIndex: 10
        });

        assert.equal(failed.tiles[1].type, TILE_TYPES.WALL);
        assert.equal(failed.tiles[10].type, TILE_TYPES.MAGNET);
        assert.equal(failed.players[0].hp, 3);
        assert.equal(failed.currentPlayerIndex, game.currentPlayerIndex);
    });

    it("swapAnyTilesWithHpCost cannot swap an unrevealed tile", function () {
        let game = withPlayer(makeGame(), 1, {
            items: [ITEM_TYPES.SWAP_ANY_TILES_WITH_HP_COST],
            hp: 3
        });
        game = withTile(game, 1, {type: TILE_TYPES.WALL, revealed: true, consumed: false});

        const failed = useCurrentPlayerItem(game, ITEM_TYPES.SWAP_ANY_TILES_WITH_HP_COST, {
            firstIndex: 1,
            secondIndex: 10
        });

        assert.equal(failed.tiles[1].type, TILE_TYPES.WALL);
        assert.equal(failed.tiles[10].revealed, false);
        assert.equal(failed.players[0].hp, 3);
        assert.equal(failed.currentPlayerIndex, game.currentPlayerIndex);
        assert.ok(failed.lastMessage.indexOf("revealed") !== -1);
    });

    it("swapAnyTilesWithHpCost can move the exit door", function () {
        let game = withPlayer(makeGame(), 1, {
            items: [ITEM_TYPES.SWAP_ANY_TILES_WITH_HP_COST],
            hp: 3
        });
        game = withTile(game, 11, {type: TILE_TYPES.EMPTY, revealed: true, consumed: false});

        const swapped = useCurrentPlayerItem(game, ITEM_TYPES.SWAP_ANY_TILES_WITH_HP_COST, {
            firstIndex: EXIT_INDEX,
            secondIndex: 11
        });

        assert.equal(swapped.exitIndex, 11);
        assert.equal(swapped.tiles[11].type, TILE_TYPES.EXIT);
        assert.equal(swapped.players[0].hp, 2);
    });

    it("magnet pulls a dropped key only within distance 3", function () {
        let game = withPlayer(makeGame(), 1, {items: [ITEM_TYPES.MAGNET]});
        game = withKey(game, {position: 2, holderPlayerId: null, isVisible: true});

        const pulled = useCurrentPlayerItem(game, ITEM_TYPES.MAGNET, {});

        assert.equal(pulled.players[0].hasKey, true);
        assert.equal(pulled.key.holderPlayerId, 1);

        let farGame = withPlayer(makeGame(), 1, {items: [ITEM_TYPES.MAGNET]});
        farGame = withKey(farGame, {position: 80, holderPlayerId: null, isVisible: true});

        const failed = useCurrentPlayerItem(farGame, ITEM_TYPES.MAGNET, {});

        assert.equal(failed.players[0].hasKey, false);
        assert.deepEqual(failed.players[0].items, [ITEM_TYPES.MAGNET]);
    });

    it("magnet steals a held key within distance 3", function () {
        let game = withPlayer(makeGame(), 1, {items: [ITEM_TYPES.MAGNET]});
        game = withPlayer(game, 2, {position: 2, hasKey: true});
        game = withKey(game, {holderPlayerId: 2, position: 2, isVisible: true});

        const stolen = useCurrentPlayerItem(game, ITEM_TYPES.MAGNET, {});

        assert.equal(stolen.players[0].hasKey, true);
        assert.equal(stolen.players[1].hasKey, false);
        assert.deepEqual(stolen.players[1].items, []);
    });

    it("thiefHand steals one chosen item from another player", function () {
        let game = withPlayer(makeGame(), 1, {items: [ITEM_TYPES.THIEF_HAND]});
        game = withPlayer(game, 2, {
            items: [ITEM_TYPES.MAGNET, ITEM_TYPES.SWAP_ANY_TILES_WITH_HP_COST]
        });

        const stolen = useCurrentPlayerItem(game, ITEM_TYPES.THIEF_HAND, {
            playerId: 2,
            itemType: ITEM_TYPES.MAGNET
        });

        assert.deepEqual(stolen.players[0].items, [ITEM_TYPES.MAGNET]);
        assert.deepEqual(stolen.players[1].items, [ITEM_TYPES.SWAP_ANY_TILES_WITH_HP_COST]);
    });

    it("thiefHand can steal the key from another player", function () {
        let game = withPlayer(makeGame(), 1, {items: [ITEM_TYPES.THIEF_HAND]});
        game = withPlayer(game, 2, {position: 2, hasKey: true});
        game = withKey(game, {holderPlayerId: 2, position: 2, isVisible: true});

        const stolen = useCurrentPlayerItem(game, ITEM_TYPES.THIEF_HAND, {
            playerId: 2,
            itemType: "key"
        });

        assert.equal(stolen.players[0].hasKey, true);
        assert.equal(stolen.players[1].hasKey, false);
        assert.equal(stolen.key.holderPlayerId, 1);
        assert.deepEqual(stolen.players[0].items, []);
    });

    it("remoteTrigger triggers a revealed item within distance 2", function () {
        let game = withPlayer(makeGame(), 1, {items: [ITEM_TYPES.REMOTE_TRIGGER]});
        game = withTile(game, 2, {
            type: TILE_TYPES.MAGNET,
            revealed: true,
            consumed: false
        });

        const triggered = useCurrentPlayerItem(game, ITEM_TYPES.REMOTE_TRIGGER, {tileIndex: 2});

        assert.deepEqual(triggered.players[0].items, [ITEM_TYPES.MAGNET]);
        assert.equal(triggered.tiles[2].consumed, true);
        assert.equal(triggered.players[0].position, 0);
    });

    it("remoteTrigger can collect a visible key within distance 2", function () {
        let game = withPlayer(makeGame(), 1, {items: [ITEM_TYPES.REMOTE_TRIGGER]});
        game = withKey(game, {
            position: 2,
            holderPlayerId: null,
            isVisible: true
        });
        game = withTile(game, 2, {
            type: TILE_TYPES.EMPTY,
            revealed: true,
            consumed: false
        });

        const triggered = useCurrentPlayerItem(game, ITEM_TYPES.REMOTE_TRIGGER, {tileIndex: 2});

        assert.equal(triggered.players[0].hasKey, true);
        assert.equal(triggered.key.holderPlayerId, 1);
        assert.deepEqual(triggered.players[0].items, []);
    });

    it("mine explodes within distance 1, reveals nearby hidden tiles, and destroys nearby walls", function () {
        let game = makeGame({
            tileContents: {
                "6": TILE_TYPES.WALL,
                "7": TILE_TYPES.MINE,
                "15": TILE_TYPES.MAGNET,
                "16": TILE_TYPES.FULL_HEAL
            }
        });
        game = withPlayer(game, 1, {position: 6});
        game = withPlayer(game, 2, {position: 5});

        const revealed = revealTile(game, 7);

        assert.equal(revealed.players[0].position, 0);
        assert.equal(revealed.players[1].position, 5);
        assert.equal(revealed.tiles[7].type, TILE_TYPES.EMPTY);
        assert.equal(revealed.tiles[6].revealed, true);
        assert.equal(revealed.tiles[6].type, TILE_TYPES.EMPTY);
        assert.equal(revealed.tiles[6].consumed, true);
        assert.equal(revealed.tiles[16].revealed, true);
        assert.equal(revealed.tiles[16].type, TILE_TYPES.FULL_HEAL);
        assert.equal(revealed.tiles[15].revealed, false);
    });

    it("timedBombPack can be used on a target player", function () {
        let game = withPlayer(makeGame(), 1, {items: [ITEM_TYPES.TIMED_BOMB_PACK]});

        game = useCurrentPlayerItem(game, ITEM_TYPES.TIMED_BOMB_PACK, {playerId: 2, countdown: 2});

        assert.equal(game.players[1].bomb.turnsLeft, 2);
        assert.equal(game.players[1].bomb.sourcePlayerId, 1);
    });

    it("timedBombPack accepts a 20 turn countdown", function () {
        let game = withPlayer(makeGame(), 1, {items: [ITEM_TYPES.TIMED_BOMB_PACK]});

        game = useCurrentPlayerItem(game, ITEM_TYPES.TIMED_BOMB_PACK, {playerId: 2, countdown: 20});

        assert.equal(game.players[1].bomb.turnsLeft, 20);
    });

    it("timedBombPack can be installed on the current player", function () {
        let game = withPlayer(makeGame(), 1, {items: [ITEM_TYPES.TIMED_BOMB_PACK]});

        game = useCurrentPlayerItem(game, ITEM_TYPES.TIMED_BOMB_PACK, {playerId: 1, countdown: 3});

        assert.equal(game.players[0].bomb.turnsLeft, 2);
        assert.equal(game.players[0].bomb.sourcePlayerId, 1);
    });

    it("bombDefuser removes a timed bomb from the current player", function () {
        const game = withPlayer(makeGame(), 1, {
            items: [ITEM_TYPES.BOMB_DEFUSER],
            bomb: {
                turnsLeft: 1,
                sourcePlayerId: 2
            }
        });

        const defused = useCurrentPlayerItem(game, ITEM_TYPES.BOMB_DEFUSER, {});

        assert.equal(defused.players[0].bomb, null);
        assert.deepEqual(defused.players[0].items, []);
        assert.equal(defused.lastMessage.indexOf("Timed bomb exploded"), -1);
        assert.equal(game.players[0].bomb.turnsLeft, 1);
    });

    it("bombDefuser is kept if the current player has no timed bomb", function () {
        const game = withPlayer(makeGame(), 1, {items: [ITEM_TYPES.BOMB_DEFUSER]});

        const failed = useCurrentPlayerItem(game, ITEM_TYPES.BOMB_DEFUSER, {});

        assert.deepEqual(failed.players[0].items, [ITEM_TYPES.BOMB_DEFUSER]);
        assert.equal(failed.players[0].bomb, null);
        assert.equal(getCurrentPlayer(failed).id, 1);
    });

    it("players cannot stack duplicate copies of the same item", function () {
        let game = withPlayer(makeGame(), 1, {items: [ITEM_TYPES.MAGNET]});
        game = withTile(game, 1, {
            type: TILE_TYPES.MAGNET,
            revealed: true,
            consumed: false
        });

        const moved = moveCurrentPlayer(game, DIRECTIONS.RIGHT);

        assert.deepEqual(moved.players[0].items, [ITEM_TYPES.MAGNET]);
        assert.equal(moved.tiles[1].consumed, true);
    });

    it("swapAnyTilesWithHpCost is collected and kept as a stored item", function () {
        let game = withTile(makeGame(), 1, {
            type: TILE_TYPES.SWAP_ANY_TILES_WITH_HP_COST,
            revealed: true,
            consumed: false
        });

        game = moveCurrentPlayer(game, DIRECTIONS.RIGHT);

        assert.deepEqual(game.players[0].items, [ITEM_TYPES.SWAP_ANY_TILES_WITH_HP_COST]);
        assert.equal(game.pendingEvent, null);
        assert.equal(game.tiles[1].consumed, true);

        game = endTurn(game);

        assert.deepEqual(game.players[0].items, [ITEM_TYPES.SWAP_ANY_TILES_WITH_HP_COST]);
    });

    it("bombDefuser is collected and kept as a stored item", function () {
        let game = withTile(makeGame(), 1, {
            type: TILE_TYPES.BOMB_DEFUSER,
            revealed: true,
            consumed: false
        });

        game = moveCurrentPlayer(game, DIRECTIONS.RIGHT);

        assert.deepEqual(game.players[0].items, [ITEM_TYPES.BOMB_DEFUSER]);
        assert.equal(game.pendingEvent, null);
        assert.equal(game.tiles[1].consumed, true);

        game = endTurn(game);

        assert.deepEqual(game.players[0].items, [ITEM_TYPES.BOMB_DEFUSER]);
    });

    it("temporary events are current-turn choices", function () {
        let game = withTile(makeGame(), 1, {
            type: TILE_TYPES.TIMED_BOMB_PACK,
            revealed: true,
            consumed: false
        });

        game = moveCurrentPlayer(game, DIRECTIONS.RIGHT);

        assert.equal(getCurrentPlayer(game).id, 1);
        assert.deepEqual(game.players[0].items, [ITEM_TYPES.TIMED_BOMB_PACK]);
        assert.deepEqual(game.pendingEvent, {
            playerId: 1,
            itemType: ITEM_TYPES.TIMED_BOMB_PACK
        });
        assert.deepEqual(game.players[0].temporaryItems, [ITEM_TYPES.TIMED_BOMB_PACK]);
        assert.equal(game.remainingActions, 1);
    });

    it("ending a turn clears temporary events but keeps stored items", function () {
        let game = withPlayer(makeGame(), 1, {
            items: [
                ITEM_TYPES.MAGNET,
                ITEM_TYPES.SWAP_ANY_TILES_WITH_HP_COST,
                ITEM_TYPES.BOMB_DEFUSER,
                ITEM_TYPES.TIMED_BOMB_PACK
            ],
            temporaryItems: [ITEM_TYPES.TIMED_BOMB_PACK]
        });

        game = endTurn(game);

        assert.deepEqual(game.players[0].items, [
            ITEM_TYPES.MAGNET,
            ITEM_TYPES.SWAP_ANY_TILES_WITH_HP_COST,
            ITEM_TYPES.BOMB_DEFUSER
        ]);
    });

    it("stored no-move reward event items are not cleared as temporary events", function () {
        let game = withPlayer(makeGame(), 1, {
            items: [ITEM_TYPES.TIMED_BOMB_PACK],
            temporaryItems: []
        });

        game = endTurn(game);

        assert.deepEqual(game.players[0].items, [ITEM_TYPES.TIMED_BOMB_PACK]);
    });

    it("temporary events can be dismissed without spending an action", function () {
        let game = withPlayer(makeGame(), 1, {
            items: [ITEM_TYPES.SWAP_PLAYER],
            temporaryItems: [ITEM_TYPES.SWAP_PLAYER]
        });

        game = discardCurrentPlayerItem(game, ITEM_TYPES.SWAP_PLAYER);

        assert.deepEqual(game.players[0].items, []);
        assert.equal(getCurrentPlayer(game).id, 1);
        assert.equal(game.remainingActions, 1);
    });

    it("dismissing a pending temporary event spends the original action", function () {
        let game = withTile(makeGame(), 1, {
            type: TILE_TYPES.SWAP_PLAYER,
            revealed: true,
            consumed: false
        });

        game = moveCurrentPlayer(game, DIRECTIONS.RIGHT);
        game = discardCurrentPlayerItem(game, ITEM_TYPES.SWAP_PLAYER);

        assert.equal(game.pendingEvent, null);
        assert.equal(getCurrentPlayer(game).id, 2);
    });

    it("bomb countdown follows the carrier's completed turns", function () {
        let game = withPlayer(makeGame(), 1, {items: [ITEM_TYPES.TIMED_BOMB_PACK]});

        game = useCurrentPlayerItem(game, ITEM_TYPES.TIMED_BOMB_PACK, {playerId: 2, countdown: 2});
        assert.equal(game.players[1].bomb.turnsLeft, 2);

        game = endTurn(game);
        assert.equal(game.players[1].bomb.turnsLeft, 1);

        game = endTurn(game);
        assert.equal(game.players[1].bomb.turnsLeft, 1);

        game = endTurn(game);
        assert.equal(game.roundNumber, 3);
        assert.equal(game.players[1].bomb, null);
        assert.ok(game.lastMessage.indexOf("Timed bomb exploded") !== -1);
    });

    it("bomb explosion kills same-tile players and damages players within distance 2", function () {
        let game = createGame(4, {keyPosition: 10, keyRevealNumber: 8});
        game = Object.assign({}, game, {currentPlayerIndex: 1});
        game = withPlayer(game, 1, {position: 40});
        game = withPlayer(game, 2, {
            position: 40,
            bomb: {
                turnsLeft: 1,
                sourcePlayerId: 1
            }
        });
        game = withPlayer(game, 3, {position: 41, hp: 3});
        game = withPlayer(game, 4, {position: 42, hp: 3});

        game = endTurn(game);

        assert.equal(game.players[0].position, 0);
        assert.equal(game.players[1].position, 8);
        assert.equal(game.players[1].bomb, null);
        assert.equal(game.players[2].position, 41);
        assert.equal(game.players[2].hp, 1);
        assert.equal(game.players[3].position, 42);
        assert.equal(game.players[3].hp, 2);
        assert.ok(game.lastMessage.indexOf("Timed bomb exploded") !== -1);
    });

    it("bomb installer can spend one action to detonate early", function () {
        let game = Object.assign({}, makeGame(), {remainingActions: 3});
        game = withPlayer(game, 2, {
            position: 20,
            bomb: {
                turnsLeft: 10,
                sourcePlayerId: 1
            }
        });

        game = detonateCurrentPlayerBomb(game, 2);

        assert.equal(game.players[1].bomb, null);
        assert.equal(game.players[1].position, 8);
        assert.equal(getCurrentPlayer(game).id, 1);
        assert.equal(game.remainingActions, 2);
        assert.ok(game.lastMessage.indexOf("Timed bomb exploded") !== -1);
    });

    it("players cannot detonate bombs installed by someone else", function () {
        let game = withPlayer(makeGame(), 2, {
            bomb: {
                turnsLeft: 10,
                sourcePlayerId: 2
            }
        });

        const failed = detonateCurrentPlayerBomb(game, 2);

        assert.deepEqual(failed.players[1].bomb, {
            turnsLeft: 10,
            sourcePlayerId: 2
        });
        assert.equal(getCurrentPlayer(failed).id, 1);
    });

    it("timed bomb explosions destroy nearby revealed walls", function () {
        let game = Object.assign({}, makeGame(), {currentPlayerIndex: 1});
        game = withPlayer(game, 2, {
            position: 10,
            bomb: {
                turnsLeft: 1,
                sourcePlayerId: 1
            }
        });
        game = withTile(game, 11, {
            type: TILE_TYPES.WALL,
            revealed: true,
            consumed: false
        });

        game = endTurn(game);

        assert.equal(game.tiles[11].type, TILE_TYPES.EMPTY);
        assert.equal(game.tiles[11].revealed, true);
        assert.equal(game.tiles[11].consumed, true);
        assert.ok(game.lastMessage.indexOf("Timed bomb exploded") !== -1);
    });

    it("bomb can be passed by moving onto another player before explosion", function () {
        let game = withPlayer(makeGame(), 1, {bomb: {turnsLeft: 3, sourcePlayerId: 2}});
        game = withPlayer(game, 2, {position: 1});
        game = withTile(game, 1, {type: TILE_TYPES.EMPTY, revealed: true, consumed: false});

        const moved = moveCurrentPlayer(game, DIRECTIONS.RIGHT);

        assert.equal(moved.players[0].bomb, null);
        assert.deepEqual(moved.players[1].bomb, {turnsLeft: 3, sourcePlayerId: 2});
    });

    it("core functions do not mutate the original gameState", function () {
        const game = makeGame({tileContents: {"1": TILE_TYPES.EMPTY}});
        const before = JSON.stringify(game);

        moveCurrentPlayer(game, DIRECTIONS.RIGHT);
        revealTile(game, 1);
        useCurrentPlayerItem(withPlayer(game, 1, {items: [ITEM_TYPES.MAGNET]}), ITEM_TYPES.MAGNET, {});

        assert.equal(JSON.stringify(game), before);
    });
});
