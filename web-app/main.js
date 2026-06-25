// Browser UI for Hidden Key Hunt.
// Rule decisions stay in game.js; this file only renders state, gathers user
// input, and calls exported game functions.

import {
    DIRECTIONS,
    ITEM_TYPES,
    TILE_TYPES,
    createGame,
    detonateCurrentPlayerBomb,
    discardCurrentPlayerItem,
    endTurn,
    getCurrentPlayer,
    getVisibleBoard,
    moveCurrentPlayer,
    revealTile,
    useCurrentPlayerItem
} from "./game.js";

const menuScreen = document.querySelector("#menu-screen");
const setupScreen = document.querySelector("#setup-screen");
const introScreen = document.querySelector("#intro-screen");
const gameScreen = document.querySelector("#game-screen");
const menuStartButton = document.querySelector("#menu-start");
const introStartButton = document.querySelector("#intro-start");
const setupPlayerCountElement = document.querySelector("#setup-player-count");
const setupRolePickerElement = document.querySelector("#setup-role-picker");
const playerSetupListElement = document.querySelector("#player-setup-list");
const setupStatusElement = document.querySelector("#setup-status");
const setupBackButton = document.querySelector("#setup-back");
const setupStartGameButton = document.querySelector("#setup-start-game");
const gameMenuButton = document.querySelector("#game-menu-button");
const pauseMenuElement = document.querySelector("#pause-menu");
const resumeGameButton = document.querySelector("#resume-game");
const restartGameButton = document.querySelector("#restart-game");
const pauseMainMenuButton = document.querySelector("#pause-main-menu");
const bombModalElement = document.querySelector("#bomb-modal");
const bombTitleElement = document.querySelector("#bomb-title");
const bombTargetsElement = document.querySelector("#bomb-targets");
const bombConfirmButton = document.querySelector("#bomb-confirm");
const bombCancelButton = document.querySelector("#bomb-cancel");
const victoryScreenElement = document.querySelector("#victory-screen");
const victoryTitleElement = document.querySelector("#victory-title");
const victoryCharacterElement = document.querySelector("#victory-character");
const victoryRestartButton = document.querySelector("#victory-restart");
const victoryMainMenuButton = document.querySelector("#victory-main-menu");
const boardElement = document.querySelector("#board");
const movementLayerElement = document.querySelector("#movement-layer");
const statusElement = document.querySelector("#status");
const centerPromptElement = document.querySelector("#center-prompt");
const centerPromptTitleElement = document.querySelector("#center-prompt-title");
const centerPromptVisualElement = document.querySelector("#center-prompt-visual");
const centerPromptTextElement = document.querySelector("#center-prompt-text");
const centerPromptCloseButton = document.querySelector("#center-prompt-close");
const turnHandoffElement = document.querySelector("#turn-handoff");
const turnHandoffCard = document.querySelector("#turn-handoff-card");
const turnHandoffTitleElement = document.querySelector("#turn-handoff-title");
const currentPlayerElement = document.querySelector("#current-player");
const currentPlayerNameElement = document.querySelector("#current-player-name");
const currentHpElement = document.querySelector("#current-hp");
const currentPlayerDetailsElement = document.querySelector("#current-player-details");
const selectedTileElement = document.querySelector("#selected-tile");
const effectDetailsElement = document.querySelector("#effect-details");
const endTurnButton = document.querySelector("#end-turn");
const inventoryElement = document.querySelector("#inventory");
const detonateControlsElement = document.querySelector("#detonate-controls");
const itemModeElement = document.querySelector("#item-mode");
const itemTargetsElement = document.querySelector("#item-targets");
const targetPlayerSelect = document.querySelector("#target-player");
const bombCountdownInput = document.querySelector("#bomb-countdown");
const useItemButton = document.querySelector("#use-item");
const noUseButton = document.querySelector("#no-use");
const noUseModalElement = document.querySelector("#no-use-modal");
const noUseTextElement = document.querySelector("#no-use-text");
const noUseBackButton = document.querySelector("#no-use-back");
const noUseConfirmButton = document.querySelector("#no-use-confirm");

// UI-only state. The game rules do not depend on selectedTile.
let gameState = createGame(2, {seed: 2026});
let selectedTile = null;
let selectedItemIndex = null;
let itemTargetTiles = [];
let uiMessage = "";
let centerPromptTimer = null;
let isPaused = false;
let isFeedbackOpen = false;
let isTurnHandoffOpen = false;
let isBombModalOpen = false;
let isNoUseModalOpen = false;
let pendingNoUseItemType = "";
let selectedBombTargetId = null;
let selectedStealItemType = "";
let movementAnimation = null;
let movementTimer = null;
let lockedSidebarGameState = null;
let pendingTurnHandoffPlayerId = null;
let pendingTurnHandoffLockedState = null;
let weakenedPlayerIds = [];
let setupActivePlayerIndex = 0;
let setupPendingRoleId = "";

const WALK_ANIMATION_MS = 720;
const MONSTER_CAMP_IMAGE_SRC = "assets/%E5%A6%96%E6%80%AA%E8%90%A5%E5%9C%B0.png";

const ROLE_OPTIONS = Object.freeze([
    {id: "lotusScout", name: "Lotus Scout"},
    {id: "reedGuard", name: "Reed Guard"},
    {id: "tideHealer", name: "Tide Healer"},
    {id: "emberTrickster", name: "Ember Trickster"}
]);

let playerProfiles = ROLE_OPTIONS.map(function (role, index) {
    return {
        id: index + 1,
        name: "",
        roleId: "",
        ready: false
    };
});

const TILE_ICONS = Object.freeze({
    hidden: "?",
    key: "🗝️",
    exit: "🚪",
    wall: "🧱",
    timedBombPack: "💣",
    mine: "💥",
    monsterCamp: "",
    empty: "",
    thiefHand: "🖐️",
    remoteTrigger: "🎯",
    fullHeal: "❤️",
    restrictMove: "⛔",
    swapPlayer: "🔁",
    actionBoost: "⚡",
    swapAnyTilesWithHpCost: "🧩",
    magnet: "🧲",
    bombDefuser: "🧰"
});

const TILE_EFFECTS = Object.freeze({
    wall: "Wall: blocks movement after it is revealed.",
    timedBombPack: "Timed bomb event: place a countdown bomb. Same tile is knocked out, distance 1 loses 2 HP, distance 2 loses 1 HP.",
    mine: "Mine: explodes as soon as it is revealed, resets players within distance 1, and reveals nearby tiles.",
    monsterCamp: "Monster camp: step onto it and lose 1 HP.",
    empty: "Empty tile: safe, with no extra effect.",
    thiefHand: "Thief hand: steal one item from another player.",
    remoteTrigger: "Remote trigger: trigger a revealed event or item within 2 tiles.",
    fullHeal: "Full heal: restores maximum HP when stepped on.",
    restrictMove: "Restrict move event: block a player's next movement.",
    swapPlayer: "Swap player event: exchange positions with another player.",
    actionBoost: "Action boost: gives 2 more actions.",
    swapAnyTilesWithHpCost: "Costly swap item: keep it, then swap any two allowed tiles for 1 HP.",
    magnet: "Magnet: collect it to pull or steal a visible key within distance 3.",
    bombDefuser: "Bomb defuser: keep it, then remove the timed bomb installed on yourself."
});

const ITEM_ICONS = Object.freeze({
    timedBombPack: TILE_ICONS.timedBombPack,
    thiefHand: TILE_ICONS.thiefHand,
    remoteTrigger: TILE_ICONS.remoteTrigger,
    restrictMove: TILE_ICONS.restrictMove,
    swapPlayer: TILE_ICONS.swapPlayer,
    swapAnyTilesWithHpCost: TILE_ICONS.swapAnyTilesWithHpCost,
    magnet: TILE_ICONS.magnet,
    bombDefuser: TILE_ICONS.bombDefuser
});

// Convert internal tile data into short text for buttons and screen readers.
function tileName(tile) {
    if (tile.isExit) {
        return "Exit";
    }
    if (!tile.revealed) {
        return "Hidden";
    }
    if (tile.type === TILE_TYPES.EMPTY) {
        return "Empty";
    }
    return tile.type;
}

function readableType(type) {
    if (type === "") {
        return "No item";
    }
    return type.replace(/([A-Z])/g, " $1");
}

function escapeAttribute(value) {
    return String(value).replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function playerCount() {
    return Number(setupPlayerCountElement.value);
}

function activeProfiles() {
    return playerProfiles.slice(0, playerCount());
}

function roleForId(roleId) {
    return ROLE_OPTIONS.find(function (role) {
        return role.id === roleId;
    }) || null;
}

function roleClass(roleId) {
    return roleForId(roleId) === null ? "role-unselected" : "role-" + roleId;
}

function roleChoiceNumber(roleId) {
    return ROLE_OPTIONS.findIndex(function (role) {
        return role.id === roleId;
    }) + 1;
}

function profileForPlayer(playerId) {
    return playerProfiles[playerId - 1] || {
        id: playerId,
        name: defaultPlayerName(playerId),
        roleId: ROLE_OPTIONS[0].id,
        ready: true
    };
}

function defaultPlayerName(playerId) {
    return "Player " + playerId;
}

function playerName(playerId) {
    return profileForPlayer(playerId).name.trim() || defaultPlayerName(playerId);
}

function formatMessageForUi(message) {
    let formatted = message || "";
    let keyHolderMatch;

    if (formatted.indexOf("Positions swapped.") !== -1) {
        return "Positions swapped.";
    }

    gameState.players.forEach(function (player) {
        formatted = formatted.replace(new RegExp("Player " + player.id, "g"), playerName(player.id));
    });

    if (formatted.indexOf("Key is Found!") !== -1) {
        return "Key is Found!";
    }
    keyHolderMatch = formatted.match(/([^.]*) got the key\./);
    if (keyHolderMatch !== null) {
        return keyHolderMatch[1] + " got the key.";
    }
    if (isNoMoveRewardMessage(formatted)) {
        if (formatted.indexOf("after 5 turns without moving") !== -1) {
            formatted = formatted.replace(
                /([^.]*) received ([^.]*?) after 5 turns without moving\./,
                "$1 received a random item because they did not move for 5 turns: $2."
            );
        }
        formatted = formatted.replace(/(?:^|\s)[^.]* begins round \d+\./g, "");
        return formatted.trim();
    }

    formatted = formatted.replace(/(?:^|\s)[^.]* begins round \d+\./g, "");
    formatted = formatted.replace(/ next turn/g, " soon");
    formatted = formatted.replace(/ this turn/g, "");
    formatted = formatted.replace(/ turn countdown/g, " countdown");
    formatted = formatted.replace(/ round countdown/g, " countdown");
    formatted = formatted.replace(/ rounds/g, "");
    formatted = formatted.replace(/ turns/g, "");
    formatted = formatted.replace(/ round/g, "");
    return formatted.trim();
}

function isSetupReady() {
    return activeProfiles().every(function (profile) {
        return profile.roleId !== "" && profile.ready;
    });
}

function firstUnreadyPlayerIndex() {
    return activeProfiles().findIndex(function (profile) {
        return profile.roleId === "" || !profile.ready;
    });
}

function clampSetupActivePlayer() {
    const count = playerCount();

    if (setupActivePlayerIndex >= count) {
        setupActivePlayerIndex = count - 1;
    }
    if (setupActivePlayerIndex < 0) {
        setupActivePlayerIndex = 0;
    }
}

function setupActiveProfile() {
    clampSetupActivePlayer();
    return activeProfiles()[setupActivePlayerIndex] || activeProfiles()[0];
}

function roleOwner(roleId) {
    return activeProfiles().find(function (profile) {
        return profile.roleId === roleId;
    }) || null;
}

function resetSetupRoles() {
    playerProfiles.forEach(function (profile) {
        profile.roleId = "";
        profile.ready = false;
    });
    setupActivePlayerIndex = 0;
    setupPendingRoleId = "";
}

function showScreen(screenName) {
    menuScreen.hidden = screenName !== "menu";
    setupScreen.hidden = screenName !== "setup";
    introScreen.hidden = screenName !== "intro";
    gameScreen.hidden = screenName !== "game";
    if (screenName === "menu") {
        resetSetupRoles();
    }
    if (screenName !== "game") {
        lockedSidebarGameState = null;
        isPaused = false;
        isFeedbackOpen = false;
        isTurnHandoffOpen = false;
        isBombModalOpen = false;
        isNoUseModalOpen = false;
        pendingTurnHandoffPlayerId = null;
        pendingTurnHandoffLockedState = null;
        selectedBombTargetId = null;
        selectedStealItemType = "";
        pendingNoUseItemType = "";
        weakenedPlayerIds = [];
        pauseMenuElement.hidden = true;
        centerPromptElement.hidden = true;
        turnHandoffElement.hidden = true;
        bombModalElement.hidden = true;
        noUseModalElement.hidden = true;
        victoryScreenElement.hidden = true;
        clearMovementAnimation();
    }
}

function setPaused(paused) {
    if (gameScreen.hidden) {
        return;
    }

    isPaused = paused;
    pauseMenuElement.hidden = !paused;
    if (paused) {
        isBombModalOpen = false;
        selectedBombTargetId = null;
        bombModalElement.hidden = true;
    }
    if (paused) {
        resumeGameButton.focus();
    } else {
        boardElement.focus();
    }
}

function updateSetupStatus() {
    setupStartGameButton.disabled = !isSetupReady();
    setupStatusElement.textContent = isSetupReady()
        ? "All ready."
        : (setupPendingRoleId === ""
            ? "Choose a colour."
            : "Confirm this colour.");
}

function renderRolePicker() {
    const activeProfile = setupActiveProfile();
    const previewRoleId = setupPendingRoleId === "" ? activeProfile.roleId : setupPendingRoleId;
    const canConfirm = setupPendingRoleId !== "";

    setupRolePickerElement.innerHTML =
        "<div class=\"setup-current-player\">" +
        "<span class=\"setup-player-token character-sprite sprite-side player-" + activeProfile.id + " " +
        roleClass(previewRoleId) + "\"></span>" +
        "<div><p class=\"setup-current-label\">Choosing</p>" +
        "<p class=\"setup-current-name\">" + escapeAttribute(playerName(activeProfile.id)) + "</p></div>" +
        "</div>" +
        "<div class=\"setup-role-grid\" aria-label=\"Choose character colour\">" +
        ROLE_OPTIONS.map(function (role) {
            const owner = roleOwner(role.id);
            const isTaken = owner !== null;
            const isSelected = setupPendingRoleId === role.id;

            return "<button type=\"button\" class=\"setup-role-choice character-choice " +
                roleClass(role.id) + (isSelected ? " selected-role" : "") + (isTaken ? " taken-role" : "") +
                "\" data-role-id=\"" + role.id + "\" aria-pressed=\"" + (isSelected ? "true" : "false") +
                "\" aria-label=\"Character colour " + roleChoiceNumber(role.id) + (isTaken ? " already chosen" : "") +
                "\"" + (isTaken ? " disabled" : "") + ">" +
                "<span class=\"role-choice-sprite character-sprite sprite-side " + roleClass(role.id) + "\">Colour " +
                roleChoiceNumber(role.id) + "</span>" +
                "</button>";
        }).join("") +
        "</div>" +
        "<button type=\"button\" id=\"setup-confirm-role\" class=\"setup-confirm-role\"" +
        (canConfirm ? "" : " disabled") + ">Confirm</button>";
}

function renderPlayerSetup() {
    playerSetupListElement.innerHTML = "";

    activeProfiles().forEach(function (profile) {
        const card = document.createElement("article");
        const isActive = setupActiveProfile().id === profile.id;

        card.className = "player-setup-card" + (profile.ready ? " ready" : "") + (isActive ? " active-setup-player" : "");
        card.innerHTML =
            "<div class=\"player-setup-heading\">" +
            "<span class=\"setup-player-token character-sprite sprite-side player-" + profile.id + " " +
            roleClass(profile.roleId) + "\"></span>" +
            "</div>" +
            "<label for=\"player-name-" + profile.id + "\">Name</label>" +
            "<input id=\"player-name-" + profile.id + "\" class=\"setup-name-input\" data-player-id=\"" + profile.id +
            "\" value=\"" + escapeAttribute(profile.name) + "\" maxlength=\"18\" placeholder=\"" +
            escapeAttribute(defaultPlayerName(profile.id)) + "\">";
        playerSetupListElement.append(card);
    });

    renderRolePicker();
    updateSetupStatus();
}

function selectSetupRole(roleId) {
    const profile = setupActiveProfile();
    const owner = roleOwner(roleId);

    if (owner !== null) {
        return;
    }

    setupPendingRoleId = roleId;
    profile.ready = false;
    profile.roleId = "";
    renderPlayerSetup();
}

function confirmSetupRole() {
    const profile = setupActiveProfile();
    const owner = roleOwner(setupPendingRoleId);
    let nextUnreadyIndex;

    if (setupPendingRoleId === "" || owner !== null) {
        return;
    }

    profile.roleId = setupPendingRoleId;
    profile.ready = true;
    setupPendingRoleId = "";
    nextUnreadyIndex = firstUnreadyPlayerIndex();
    setupActivePlayerIndex = nextUnreadyIndex === -1 ? profile.id - 1 : nextUnreadyIndex;
    clampSetupActivePlayer();
    renderPlayerSetup();
}

function currentSelectedItem(player) {
    if (selectedItemIndex === null || selectedItemIndex < 0 || selectedItemIndex >= player.items.length) {
        selectedItemIndex = null;
        itemTargetTiles = [];
        return "";
    }
    return player.items[selectedItemIndex];
}

function requiredTileTargetCount(itemType) {
    if (itemType === ITEM_TYPES.SWAP_ANY_TILES_WITH_HP_COST) {
        return 2;
    }
    if (itemType === ITEM_TYPES.REMOTE_TRIGGER) {
        return 1;
    }
    return 0;
}

function isPlayerTargetItem(itemType) {
    return itemType === ITEM_TYPES.TIMED_BOMB_PACK ||
        itemType === ITEM_TYPES.RESTRICT_MOVE ||
        itemType === ITEM_TYPES.SWAP_PLAYER ||
        itemType === ITEM_TYPES.THIEF_HAND;
}

function isTemporaryEventItem(itemType) {
    return itemType === ITEM_TYPES.TIMED_BOMB_PACK ||
        itemType === ITEM_TYPES.RESTRICT_MOVE ||
        itemType === ITEM_TYPES.SWAP_PLAYER;
}

function canNoUseItem(itemType) {
    return itemType !== "" && pendingEventItem() === itemType && isTemporaryEventItem(itemType);
}

function discardTemporaryEvent(itemType) {
    if (!isTemporaryEventItem(itemType)) {
        return false;
    }

    selectedItemIndex = null;
    itemTargetTiles = [];
    pendingNoUseItemType = "";
    isNoUseModalOpen = false;
    noUseModalElement.hidden = true;
    updateGame(discardCurrentPlayerItem(gameState, itemType));
    return true;
}

function requestNoUse(itemType) {
    if (!canNoUseItem(itemType)) {
        return false;
    }

    pendingNoUseItemType = itemType;
    isNoUseModalOpen = true;
    noUseTextElement.textContent = readableType(itemType) + " will disappear next turn.";
    noUseModalElement.hidden = false;
    noUseConfirmButton.focus();
    return true;
}

function closeNoUseModal() {
    if (!isNoUseModalOpen) {
        return;
    }

    isNoUseModalOpen = false;
    pendingNoUseItemType = "";
    noUseModalElement.hidden = true;
    render();
}

function confirmNoUseCancel() {
    const itemType = pendingNoUseItemType;

    if (itemType === "") {
        closeNoUseModal();
        return;
    }

    isNoUseModalOpen = false;
    pendingNoUseItemType = "";
    noUseModalElement.hidden = true;
    closeBombModal(false);
    return discardTemporaryEvent(itemType);
}

function pendingEventItem() {
    const player = getCurrentPlayer(gameState);

    if (gameState.pendingEvent === null || gameState.pendingEvent === undefined) {
        return "";
    }
    if (gameState.pendingEvent.playerId !== player.id) {
        return "";
    }
    return gameState.pendingEvent.itemType;
}

function openPendingEventControls() {
    const itemType = pendingEventItem();

    if (itemType === "") {
        return false;
    }

    selectPendingEventItem();
    render();
    if (isPlayerTargetItem(itemType)) {
        openBombModal();
        return true;
    }
    if (requiredTileTargetCount(itemType) > 0) {
        focusTile(getCurrentPlayer(gameState).position);
        return true;
    }
    return false;
}

function selectPendingEventItem() {
    const player = getCurrentPlayer(gameState);
    const itemType = pendingEventItem();

    if (itemType === "") {
        return;
    }

    selectedItemIndex = player.items.indexOf(itemType);
    itemTargetTiles = [];
}

function itemModeText(itemType) {
    const requiredTargets = requiredTileTargetCount(itemType);

    if (itemType === "") {
        return "Pick item";
    }
    if (requiredTargets > 0) {
        return readableType(itemType) + ": choose " + requiredTargets + " tiles";
    }
    return readableType(itemType) + ": choose target";
}

function itemTargetText() {
    if (itemTargetTiles.length === 0) {
        return "Tiles: -";
    }
    return "Tiles: " + itemTargetTiles.join(", ");
}

function heartElements(player) {
    return Array.from({length: player.maxHp}, function (ignore, index) {
        const heart = document.createElement("span");

        heart.className = index < player.hp ? "heart filled" : "heart empty";
        heart.textContent = index < player.hp ? "♥" : "♡";
        heart.setAttribute("aria-hidden", "true");
        return heart;
    });
}

function renderHearts(player) {
    currentHpElement.innerHTML = "";
    currentHpElement.setAttribute("aria-label", playerName(player.id) + " HP " + player.hp + " of " + player.maxHp);
    heartElements(player).forEach(function (heart) {
        currentHpElement.append(heart);
    });
}

function flashCurrentHearts() {
    currentHpElement.classList.remove("hp-flash");
    window.setTimeout(function () {
        currentHpElement.classList.add("hp-flash");
    }, 0);
    window.setTimeout(function () {
        currentHpElement.classList.remove("hp-flash");
    }, 1500);
}

function isWeakenedPlayer(playerId) {
    return weakenedPlayerIds.indexOf(playerId) !== -1;
}

function flashDamagedPlayers(playerIds) {
    const uniqueIds = playerIds.filter(function (playerId, index) {
        return playerIds.indexOf(playerId) === index;
    });

    if (uniqueIds.length === 0) {
        return;
    }

    weakenedPlayerIds = uniqueIds;
    render();
    window.setTimeout(function () {
        weakenedPlayerIds = [];
        render();
    }, 1450);
}

function tileText(tile) {
    if (tile.hasVisibleKey) {
        return TILE_ICONS.key;
    }
    if (tile.isExit) {
        return TILE_ICONS.exit;
    }
    if (!tile.revealed) {
        return "";
    }
    if (tile.type === TILE_TYPES.WALL) {
        return "";
    }
    return TILE_ICONS[tile.type] || "";
}

function appendTileImage(content, tile) {
    if (tile.hasVisibleKey || !tile.revealed || tile.type !== TILE_TYPES.MONSTER_CAMP) {
        return;
    }

    const image = document.createElement("img");

    image.className = "monster-camp-icon";
    image.src = MONSTER_CAMP_IMAGE_SRC;
    image.alt = "";
    image.setAttribute("aria-hidden", "true");
    content.append(image);
}

function tileEffectText(tile) {
    if (tile.hasVisibleKey) {
        return "Key: step onto this revealed tile to pick it up, then reach the centre exit.";
    }
    if (tile.isExit) {
        return "Exit: a player must carry the key here to win.";
    }
    if (!tile.revealed) {
        return "Hidden tile: confirm this tile to reveal it before players can enter.";
    }
    return TILE_EFFECTS[tile.type] || "Revealed tile.";
}

function describePlayers(tile) {
    if (tile.players.length === 0) {
        return "";
    }
    return " " + tile.players.map(function (player) {
        return playerName(player.id);
    }).join(", ");
}

function effectTextFromMessage(message) {
    if (message === undefined || message === "") {
        return "Reveal a tile or step onto a revealed event to see its effect.";
    }
    return message;
}

function tileClass(tile) {
    const classes = ["tile"];

    if (tile.index === selectedTile) {
        classes.push("selected");
    }
    if (itemTargetTiles.indexOf(tile.index) !== -1) {
        classes.push("item-target-selected");
    }
    if (!tile.revealed) {
        classes.push("hidden");
    } else {
        classes.push("revealed");
        classes.push("tile-" + tile.type);
    }
    if (tile.isExit) {
        classes.push("exit");
    }
    if (tile.hasVisibleKey) {
        classes.push("key-tile");
    }
    if (tile.players.length > 0) {
        classes.push("occupied");
    }

    return classes.join(" ");
}

function setUiMessage(message) {
    uiMessage = message;
    renderTurn();
}

function playerById(game, playerId) {
    return game.players.find(function (player) {
        return player.id === playerId;
    });
}

function isMovementAnimating() {
    return movementAnimation !== null;
}

function tileCenterPercent(tileIndex) {
    const boardSize = gameState.boardSize;
    const row = Math.floor(tileIndex / boardSize);
    const col = tileIndex % boardSize;

    return {
        left: ((col + 0.5) / boardSize) * 100,
        top: ((row + 0.5) / boardSize) * 100
    };
}

function walkingDirectionClass(direction) {
    if (direction === DIRECTIONS.LEFT) {
        return "character-sprite sprite-side walk-side walk-left";
    }
    if (direction === DIRECTIONS.RIGHT) {
        return "character-sprite sprite-side walk-side walk-right";
    }
    return "character-sprite sprite-front walk-front";
}

function movementDetails(previousGame, nextGame, playerId, direction) {
    const previousPlayer = playerById(previousGame, playerId);
    const nextPlayer = playerById(nextGame, playerId);

    if (previousPlayer === undefined || nextPlayer === undefined ||
            previousPlayer.position === nextPlayer.position) {
        return null;
    }

    return {
        playerId,
        direction,
        from: previousPlayer.position,
        to: nextPlayer.position,
        message: nextGame.lastMessage,
        rendered: false
    };
}

function clearMovementAnimation() {
    window.clearTimeout(movementTimer);
    movementAnimation = null;
    movementLayerElement.innerHTML = "";
    gameScreen.classList.remove("movement-locked");
}

function queueTurnHandoff(playerId, lockedState) {
    pendingTurnHandoffPlayerId = playerId;
    pendingTurnHandoffLockedState = lockedState || null;
}

function maybeShowTurnHandoff() {
    if (pendingTurnHandoffPlayerId === null || gameScreen.hidden || gameState.status === "won" ||
            isFeedbackOpen || isBombModalOpen || isNoUseModalOpen || isMovementAnimating() || isTurnHandoffOpen) {
        return;
    }

    lockedSidebarGameState = pendingTurnHandoffLockedState;
    turnHandoffTitleElement.textContent = playerName(pendingTurnHandoffPlayerId) + "'s turn";
    turnHandoffElement.hidden = false;
    isTurnHandoffOpen = true;
    turnHandoffCard.focus();
}

function closeTurnHandoff() {
    if (!isTurnHandoffOpen) {
        return;
    }

    turnHandoffElement.hidden = true;
    isTurnHandoffOpen = false;
    pendingTurnHandoffPlayerId = null;
    pendingTurnHandoffLockedState = null;
    lockedSidebarGameState = null;
    render();
    boardElement.focus();
}

function closeCenterPrompt() {
    centerPromptElement.hidden = true;
    isFeedbackOpen = false;
    if (pendingTurnHandoffPlayerId === null) {
        lockedSidebarGameState = null;
    }
    window.clearTimeout(centerPromptTimer);
    render();
    if (openPendingEventControls()) {
        return;
    }
    maybeShowTurnHandoff();
}

function uiMessageText(message) {
    return formatMessageForUi(message);
}

function isNoMoveRewardMessage(message) {
    return typeof message === "string" &&
        (message.indexOf("after 5 turns without moving") !== -1 ||
        message.indexOf("did not move for 5 turns") !== -1);
}

function addedItemType(previousPlayer, nextPlayer) {
    const previousItems = previousPlayer.items || [];

    return (nextPlayer.items || []).find(function (itemType) {
        return previousItems.indexOf(itemType) === -1;
    }) || "";
}

function noMoveRewardDetails(previousGame, nextGame) {
    const messageMatch = nextGame.lastMessage.match(/Player (\d+) received ([^.]*?) after 5 turns without moving\./);
    let rewardPlayer;

    if (messageMatch !== null) {
        return {
            playerId: Number(messageMatch[1]),
            itemName: messageMatch[2]
        };
    }

    rewardPlayer = nextGame.players.find(function (nextPlayer) {
        const previousPlayer = playerById(previousGame, nextPlayer.id);
        const itemType = previousPlayer === undefined ? "" : addedItemType(previousPlayer, nextPlayer);

        return previousPlayer !== undefined &&
            itemType !== "" &&
            previousPlayer.turnsWithoutMove >= 4 &&
            nextPlayer.turnsWithoutMove === 0 &&
            previousPlayer.position === nextPlayer.position;
    });

    if (rewardPlayer === undefined) {
        return null;
    }

    return {
        playerId: rewardPlayer.id,
        itemName: readableType(addedItemType(playerById(previousGame, rewardPlayer.id), rewardPlayer))
    };
}

function noMoveRewardPrompt(details) {
    if (details === null) {
        return "";
    }

    return playerName(details.playerId) +
        " received a random item because they did not move for 5 turns: " +
        details.itemName + ".";
}

function promptTitleText(message) {
    if (isNoMoveRewardMessage(message)) {
        return "No Move Reward";
    }
    if (message.indexOf("Need the key to open the door") !== -1) {
        return "Locked Door";
    }
    if (message.indexOf("Key is Found") !== -1 ||
            message.indexOf("got the key") !== -1) {
        return "Key";
    }
    if (message.indexOf("Bomb defuser") !== -1) {
        return "Bomb Defuser";
    }
    if (message.indexOf("Timed bomb") !== -1 || message.indexOf("Bomb") !== -1) {
        return "Timed Bomb";
    }
    if (message.indexOf("Mine") !== -1) {
        return "Mine";
    }
    if (message.indexOf("Monster camp") !== -1) {
        return "Monster Camp";
    }
    if (message.indexOf("Wall") !== -1) {
        return "Wall";
    }
    if (message.indexOf("Full heal") !== -1) {
        return "Full Heal";
    }
    if (message.indexOf("Restrict move") !== -1) {
        return "Restrict Move";
    }
    if (message.indexOf("Swap player") !== -1 || message.indexOf("Positions swapped") !== -1) {
        return "Swap Player";
    }
    if (message.indexOf("Action boost") !== -1) {
        return "Action Boost";
    }
    if (message.indexOf("Costly swap") !== -1) {
        return "Costly Swap";
    }
    if (message.indexOf("Magnet") !== -1) {
        return "Magnet";
    }
    if (message.indexOf("Thief hand") !== -1) {
        return "Thief Hand";
    }
    if (message.indexOf("Remote trigger") !== -1) {
        return "Remote Trigger";
    }
    if (message.indexOf("Duplicate item") !== -1) {
        return "Item";
    }
    return "Event";
}

function sidebarGameState() {
    return lockedSidebarGameState || gameState;
}

function visualCard(icon, label) {
    return "<span class=\"visual-card\"><span class=\"visual-icon\">" + icon + "</span><span>" + label + "</span></span>";
}

function visualImageCard(source, label) {
    return "<span class=\"visual-card\"><img class=\"visual-image-icon\" src=\"" + source +
        "\" alt=\"\" aria-hidden=\"true\"><span>" + label + "</span></span>";
}

function isDoorWarningMessage(message) {
    return message.indexOf("Need the key to open the door") !== -1;
}

function promptVisualHtml(message) {
    if (isNoMoveRewardMessage(message)) {
        return "<div class=\"visual-diagram\">" +
            visualCard("5", "No Move") +
            "<span class=\"visual-arrow\">&rarr;</span>" +
            visualCard("?", "Random") +
            "<span class=\"visual-arrow\">&rarr;</span>" +
            visualCard("I", "Item") +
            "</div>";
    }
    if (isDoorWarningMessage(message)) {
        return "<div class=\"visual-diagram locked-door-diagram\">" +
            visualCard(TILE_ICONS.exit, "Door") +
            "<span class=\"visual-arrow\">&larr;</span>" +
            visualCard(TILE_ICONS.key, "Key") +
            "</div>";
    }
    if (message.indexOf("Key is Found") !== -1 ||
            message.indexOf("got the key") !== -1) {
        return "<div class=\"visual-diagram key-transfer-diagram\">" +
            visualCard("P", "Carry") +
            "<span class=\"visual-arrow\">&larr;</span>" +
            visualCard(TILE_ICONS.key, "Key") +
            "</div>";
    }
    if (message.indexOf("knocked out") !== -1 || message.indexOf("revived") !== -1) {
        return "<div class=\"visual-diagram revive-diagram\">" +
            visualCard("&times;", "Down") +
            "<span class=\"visual-arrow\">&rarr;</span>" +
            visualCard("P", "Spawn") +
            "<span class=\"visual-arrow\">&rarr;</span>" +
            visualCard("&hearts;&hearts;&hearts;", "Revive") +
            "</div>";
    }
    if (message.indexOf("Mine exploded") !== -1) {
        return "<div class=\"visual-diagram danger-diagram\">" +
            visualCard(TILE_ICONS.mine, "Blast") +
            "<span class=\"visual-radius\">1</span>" +
            visualCard("P", "Reset") +
            "</div>";
    }
    if (message.indexOf("Monster camp") !== -1) {
        return "<div class=\"visual-diagram danger-diagram\">" +
            visualImageCard(MONSTER_CAMP_IMAGE_SRC, "Camp") +
            "<span class=\"visual-arrow\">&rarr;</span>" +
            visualCard("-1", "HP") +
            "</div>";
    }
    if (message.indexOf("Bomb defuser") !== -1) {
        return "<div class=\"visual-diagram\">" +
            visualCard(TILE_ICONS.bombDefuser, "Defuse") +
            "<span class=\"visual-arrow\">&rarr;</span>" +
            visualCard(TILE_ICONS.timedBombPack, "Clear") +
            "</div>";
    }
    if (message.indexOf("Timed bomb") !== -1 || message.indexOf("Bomb") !== -1) {
        return "<div class=\"visual-diagram\">" +
            visualCard(TILE_ICONS.timedBombPack, "Timer") +
            "<span class=\"visual-arrow\">&rarr;</span>" +
            visualCard("P", "Carry") +
            "<span class=\"visual-arrow\">&rarr;</span>" +
            visualCard("2", "Blast") +
            "</div>";
    }
    if (message.indexOf("Wall") !== -1) {
        return "<div class=\"visual-diagram\">" +
            visualCard("P", "Move") +
            "<span class=\"visual-wall\"></span>" +
            visualCard("&times;", "Blocked") +
            "</div>";
    }
    if (message.indexOf("Full heal") !== -1) {
        return "<div class=\"visual-diagram\">" +
            visualCard(TILE_ICONS.fullHeal, "Heal") +
            "<span class=\"visual-arrow\">&rarr;</span>" +
            visualCard("&hearts;&hearts;&hearts;", "HP") +
            "</div>";
    }
    if (message.indexOf("Restrict move") !== -1) {
        return "<div class=\"visual-diagram\">" +
            visualCard(TILE_ICONS.restrictMove, "Stop") +
            "<span class=\"visual-arrow\">&rarr;</span>" +
            visualCard("P", "No move") +
            "</div>";
    }
    if (message.indexOf("Swap player") !== -1 || message.indexOf("Positions swapped") !== -1) {
        return "<div class=\"visual-diagram\">" +
            visualCard("P1", "Here") +
            "<span class=\"visual-arrow\">&harr;</span>" +
            visualCard("P2", "There") +
            "</div>";
    }
    if (message.indexOf("Action boost") !== -1) {
        return "<div class=\"visual-diagram\">" +
            visualCard(TILE_ICONS.actionBoost, "Boost") +
            "<span class=\"visual-arrow\">&rarr;</span>" +
            visualCard("3", "Actions") +
            "</div>";
    }
    if (message.indexOf("swap") !== -1 || message.indexOf("Swap") !== -1) {
        return "<div class=\"visual-diagram\">" +
            visualCard("A", "Tile") +
            "<span class=\"visual-arrow\">&harr;</span>" +
            visualCard("B", "Tile") +
            "</div>";
    }
    if (message.indexOf("Magnet") !== -1) {
        return "<div class=\"visual-diagram\">" +
            visualCard(TILE_ICONS.magnet, "Pull") +
            "<span class=\"visual-arrow\">&rarr;</span>" +
            visualCard(TILE_ICONS.key, "Key") +
            "</div>";
    }
    if (message.indexOf("Thief hand") !== -1) {
        return "<div class=\"visual-diagram\">" +
            visualCard(TILE_ICONS.thiefHand, "Steal") +
            "<span class=\"visual-arrow\">&rarr;</span>" +
            visualCard("I", "Item") +
            "</div>";
    }
    if (message.indexOf("Remote trigger") !== -1) {
        return "<div class=\"visual-diagram\">" +
            visualCard(TILE_ICONS.remoteTrigger, "Range 2") +
            "<span class=\"visual-arrow\">&rarr;</span>" +
            visualCard("!", "Event") +
            "</div>";
    }
    if (message.indexOf("Key") !== -1 || message.indexOf("key") !== -1) {
        return "<div class=\"visual-diagram\">" +
            visualCard(TILE_ICONS.key, "Key") +
            "<span class=\"visual-arrow\">&rarr;</span>" +
            visualCard(TILE_ICONS.exit, "Exit") +
            "</div>";
    }
    if (message.indexOf("Duplicate item") !== -1) {
        return "<div class=\"visual-diagram\">" +
            visualCard("1", "Only") +
            "<span class=\"visual-arrow\">&times;</span>" +
            visualCard("2", "Same") +
            "</div>";
    }
    return "<div class=\"visual-diagram\">" +
        visualCard("?", "Reveal") +
        "<span class=\"visual-arrow\">&rarr;</span>" +
        visualCard("!", "Event") +
        "</div>";
}

function showCenterPrompt(message, shouldStayOpen) {
    const persistent = shouldStayOpen !== false;
    const visibleMessage = uiMessageText(message);

    centerPromptTitleElement.textContent = promptTitleText(visibleMessage);
    centerPromptVisualElement.innerHTML = promptVisualHtml(visibleMessage);
    centerPromptTextElement.textContent = visibleMessage;
    centerPromptElement.classList.toggle("door-warning", isDoorWarningMessage(visibleMessage));
    centerPromptElement.hidden = false;
    isFeedbackOpen = persistent;
    window.clearTimeout(centerPromptTimer);
    if (persistent) {
        centerPromptCloseButton.focus();
        return;
    }

    centerPromptTimer = window.setTimeout(closeCenterPrompt, 1800);
}

function finishMovementAnimation() {
    const feedbackMessage = movementAnimation === null ? "" : movementAnimation.message;

    clearMovementAnimation();
    if (feedbackMessage === "") {
        if (pendingTurnHandoffPlayerId === null) {
            lockedSidebarGameState = null;
        }
    }
    render();
    if (feedbackMessage !== "") {
        showCenterPrompt(feedbackMessage);
    } else {
        maybeShowTurnHandoff();
    }
}

function renderMovementLayer() {
    let start;
    let end;
    let token;

    if (movementAnimation === null) {
        movementLayerElement.innerHTML = "";
        gameScreen.classList.remove("movement-locked");
        return;
    }

    gameScreen.classList.add("movement-locked");
    if (movementAnimation.rendered) {
        return;
    }

    start = tileCenterPercent(movementAnimation.from);
    end = tileCenterPercent(movementAnimation.to);
    token = document.createElement("span");
    token.className = "walking-token " + walkingDirectionClass(movementAnimation.direction) +
        " player-" + movementAnimation.playerId + " " + roleClass(profileForPlayer(movementAnimation.playerId).roleId);
    token.textContent = "";
    const walkingPlayer = playerById(gameState, movementAnimation.playerId);

    if (walkingPlayer !== undefined) {
        token.append(makeHpMarker(walkingPlayer));
    }
    if (walkingPlayer !== undefined && walkingPlayer.hasKey) {
        const keyMarker = document.createElement("span");
        keyMarker.className = "key-marker";
        keyMarker.textContent = TILE_ICONS.key;
        keyMarker.setAttribute("aria-hidden", "true");
        token.append(keyMarker);
    }
    if (walkingPlayer !== undefined && walkingPlayer.bomb !== null) {
        token.append(makeBombMarker(walkingPlayer));
    }
    token.style.left = start.left + "%";
    token.style.top = start.top + "%";
    token.style.transitionDuration = WALK_ANIMATION_MS + "ms";

    movementAnimation.rendered = true;
    movementLayerElement.innerHTML = "";
    movementLayerElement.append(token);
    window.clearTimeout(movementTimer);
    window.requestAnimationFrame(function () {
        window.requestAnimationFrame(function () {
            token.style.left = end.left + "%";
            token.style.top = end.top + "%";
        });
    });
    movementTimer = window.setTimeout(finishMovementAnimation, WALK_ANIMATION_MS + 80);
}

function closeBombModal(shouldCancelItem) {
    const cancelledItem = currentSelectedItem(getCurrentPlayer(gameState));

    bombModalElement.hidden = true;
    isBombModalOpen = false;
    selectedBombTargetId = null;
    selectedStealItemType = "";
    if (shouldCancelItem) {
        if (!requestNoUse(cancelledItem)) {
            selectedItemIndex = null;
            itemTargetTiles = [];
            setUiMessage(readableType(cancelledItem) + " cancelled.");
        }
        render();
    }
}

function renderStealTargets(currentPlayer) {
    bombTargetsElement.innerHTML = "";
    bombTargetsElement.setAttribute("aria-label", "Choose item to steal");
    gameState.players.forEach(function (player) {
        if (player.id === currentPlayer.id) {
            return;
        }

        if (player.hasKey) {
            const keyButton = document.createElement("button");
            const keySelected = selectedBombTargetId === player.id && selectedStealItemType === "key";
            const profile = profileForPlayer(player.id);

            keyButton.type = "button";
            keyButton.className = keySelected ? "bomb-target selected-bomb-target player-" + player.id : "bomb-target player-" + player.id;
            keyButton.title = playerName(player.id) + " key";
            keyButton.setAttribute("aria-label", "Steal key from " + playerName(player.id));
            keyButton.setAttribute("aria-pressed", keySelected ? "true" : "false");
            keyButton.innerHTML = "<span class=\"bomb-target-avatar character-sprite sprite-side player-" + player.id + " " +
                roleClass(profile.roleId) + "\"></span><span class=\"steal-item-icon\">" + TILE_ICONS.key + "</span>";
            keyButton.addEventListener("click", function () {
                selectedBombTargetId = player.id;
                selectedStealItemType = "key";
                renderBombTargets();
            });
            bombTargetsElement.append(keyButton);
        }

        player.items.forEach(function (itemType) {
            const button = document.createElement("button");
            const isSelected = selectedBombTargetId === player.id && selectedStealItemType === itemType;
            const profile = profileForPlayer(player.id);

            button.type = "button";
            button.className = isSelected ? "bomb-target selected-bomb-target player-" + player.id : "bomb-target player-" + player.id;
            button.title = playerName(player.id) + " " + readableType(itemType);
            button.setAttribute("aria-label", "Steal " + readableType(itemType) + " from " + playerName(player.id));
            button.setAttribute("aria-pressed", isSelected ? "true" : "false");
            button.innerHTML = "<span class=\"bomb-target-avatar character-sprite sprite-side player-" + player.id + " " +
                roleClass(profile.roleId) + "\"></span><span class=\"steal-item-icon\">" + (ITEM_ICONS[itemType] || "I") + "</span>";
            button.addEventListener("click", function () {
                selectedBombTargetId = player.id;
                selectedStealItemType = itemType;
                renderBombTargets();
            });
            bombTargetsElement.append(button);
        });
    });
    bombConfirmButton.disabled = selectedBombTargetId === null || selectedStealItemType === "";
}

function renderBombTargets() {
    const currentPlayer = getCurrentPlayer(gameState);
    const itemType = currentSelectedItem(currentPlayer);
    const canTargetSelf = itemType === ITEM_TYPES.RESTRICT_MOVE || itemType === ITEM_TYPES.TIMED_BOMB_PACK;

    bombTitleElement.textContent = ITEM_ICONS[itemType] || "";
    bombCountdownInput.hidden = itemType !== ITEM_TYPES.TIMED_BOMB_PACK;
    bombCancelButton.textContent = canNoUseItem(itemType) ? "No Use" : "Cancel";
    if (itemType === ITEM_TYPES.THIEF_HAND) {
        renderStealTargets(currentPlayer);
        return;
    }
    bombTargetsElement.innerHTML = "";
    bombTargetsElement.setAttribute("aria-label", "Choose target player");
    gameState.players.forEach(function (player) {
        const profile = profileForPlayer(player.id);
        const button = document.createElement("button");
        const isSelected = selectedBombTargetId === player.id;

        if (player.id === currentPlayer.id && !canTargetSelf) {
            return;
        }

        button.type = "button";
        button.className = isSelected ? "bomb-target selected-bomb-target player-" + player.id : "bomb-target player-" + player.id;
        button.title = playerName(player.id);
        button.setAttribute("aria-label", "Choose " + playerName(player.id));
        button.setAttribute("aria-pressed", isSelected ? "true" : "false");
        button.innerHTML = "<span class=\"bomb-target-avatar character-sprite sprite-side player-" + player.id + " " +
            roleClass(profile.roleId) + "\"></span><span>" + escapeAttribute(playerName(player.id)) + "</span>";
        button.addEventListener("click", function () {
            selectedBombTargetId = player.id;
            renderBombTargets();
        });
        bombTargetsElement.append(button);
    });
    bombConfirmButton.disabled = selectedBombTargetId === null;
}

function openBombModal() {
    selectedBombTargetId = null;
    selectedStealItemType = "";
    isBombModalOpen = true;
    bombModalElement.hidden = false;
    bombCountdownInput.value = bombCountdownInput.value || "2";
    renderBombTargets();
    const firstTargetButton = bombTargetsElement.querySelector("button");

    if (firstTargetButton !== null) {
        firstTargetButton.focus();
    }
}

function playExplosion(tileIndex) {
    window.setTimeout(function () {
        const button = boardButton(tileIndex);
        const effect = document.createElement("span");

        if (button === null) {
            return;
        }

        effect.className = "explosion-effect";
        effect.textContent = TILE_ICONS.mine;
        effect.setAttribute("aria-hidden", "true");
        button.append(effect);
        window.setTimeout(function () {
            effect.remove();
        }, 900);
    }, 0);
}

function playMonsterBite(tileIndex) {
    window.setTimeout(function () {
        const button = boardButton(tileIndex);
        const effect = document.createElement("span");

        if (button === null) {
            return;
        }

        effect.className = "bite-effect";
        effect.setAttribute("aria-hidden", "true");
        [1, 2, 3].forEach(function (index) {
            const slash = document.createElement("span");

            slash.className = "bite-slash bite-slash-" + index;
            effect.append(slash);
        });
        button.append(effect);
        window.setTimeout(function () {
            effect.remove();
        }, 950);
    }, 0);
}

function makeBombMarker(player) {
    const bomb = document.createElement("span");

    bomb.className = "bomb-marker";
    bomb.textContent = TILE_ICONS.timedBombPack + String(player.bomb.turnsLeft);
    bomb.setAttribute("aria-label", "Bomb explodes in " + player.bomb.turnsLeft + " turns");
    return bomb;
}

// Board and walking tokens share this badge so every on-map character shows HP.
function makeHpMarker(player) {
    const hpMarker = document.createElement("span");
    const maxHp = player.maxHp || 3;
    const hearts = Array.from({length: maxHp}, function (ignore, index) {
        return index < player.hp ? "♥" : "♡";
    });

    hpMarker.className = "token-hp-marker";
    hpMarker.textContent = hearts.join("");
    hpMarker.setAttribute("aria-label", player.hp + " of " + maxHp + " HP");
    return hpMarker;
}

// The board is rendered as 81 semantic buttons so mouse and keyboard users can
// both select and confirm tile actions.
function renderBoard() {
    const visibleBoard = getVisibleBoard(gameState);
    boardElement.innerHTML = "";

    visibleBoard.forEach(function (tile) {
        const button = document.createElement("button");
        const label = tileName(tile) + " tile " + tile.index + ". " + tileEffectText(tile) + describePlayers(tile);
        const content = document.createElement("span");
        const tokenRow = document.createElement("span");

        button.type = "button";
        button.className = tileClass(tile);
        button.dataset.index = String(tile.index);
        button.setAttribute("aria-label", label);
        button.title = tileEffectText(tile);

        content.className = "tile-content";
        content.textContent = tileText(tile);
        appendTileImage(content, tile);
        button.append(content);

        const visiblePlayers = tile.players.filter(function (player) {
            return movementAnimation === null || movementAnimation.playerId !== player.id;
        });

        tokenRow.className = "tokens token-count-" + visiblePlayers.length +
            (visiblePlayers.length > 1 ? " shared-token-layout" : "");
        visiblePlayers.forEach(function (player, playerIndex) {
            const token = document.createElement("span");

            token.className = "player-token character-sprite sprite-front player-" + player.id + " " +
                roleClass(profileForPlayer(player.id).roleId) + " token-slot-" + (playerIndex + 1) +
                (isWeakenedPlayer(player.id) ? " weakened-player" : "");
            token.textContent = "";
            token.setAttribute("aria-label", playerName(player.id));

            token.append(makeHpMarker(player));

            if (player.hasKey) {
                const keyMarker = document.createElement("span");
                keyMarker.className = "key-marker";
                keyMarker.textContent = TILE_ICONS.key;
                keyMarker.setAttribute("aria-hidden", "true");
                token.append(keyMarker);
            }

            if (player.bomb !== null) {
                token.append(makeBombMarker(player));
            }

            tokenRow.append(token);
        });
        button.append(tokenRow);

        button.addEventListener("click", function () {
            handleTileClick(tile.index);
        });
        boardElement.append(button);
    });
}

// Turn information is kept in aria-live status text so state changes are
// announced without forcing focus away from the controls.
function renderTurn() {
    const panelGame = sidebarGameState();
    const player = getCurrentPlayer(panelGame);
    const profile = profileForPlayer(player.id);
    const bombText = player.bomb === null ? "-" : TILE_ICONS.timedBombPack + player.bomb.turnsLeft;
    const keyText = player.hasKey ? TILE_ICONS.key : "-";

    currentPlayerElement.textContent = "";
    currentPlayerElement.setAttribute("aria-label", playerName(player.id));
    currentPlayerElement.title = playerName(player.id);
    currentPlayerElement.className = "current-player-token character-sprite sprite-front player-" + player.id + " " +
        roleClass(profile.roleId) + (isWeakenedPlayer(player.id) ? " weakened-player" : "");
    currentPlayerNameElement.textContent = playerName(player.id);
    renderHearts(player);
    currentPlayerDetailsElement.textContent = keyText + " " + bombText + " tile " + player.position;
    selectedTileElement.textContent = selectedTile === null ? "" : "Selected tile " + selectedTile;
    statusElement.textContent = formatMessageForUi(uiMessage ||
        (gameState.status === "won" ? playerName(gameState.winnerId) + " has won." : gameState.lastMessage));
    effectDetailsElement.textContent = effectTextFromMessage(statusElement.textContent);
}

function renderInventory(player) {
    inventoryElement.innerHTML = "";
    currentSelectedItem(player);

    if (player.items.length === 0) {
        return;
    }

    player.items.forEach(function (itemType, index) {
        const button = document.createElement("button");
        const selected = selectedItemIndex === index;

        button.type = "button";
        button.className = selected ? "item-button selected-item" : "item-button";
        button.textContent = ITEM_ICONS[itemType] || "I";
        button.title = readableType(itemType);
        button.setAttribute("role", "option");
        button.setAttribute("aria-label", readableType(itemType) + (selected ? " selected. Click again to cancel." : ". Click to select."));
        button.setAttribute("aria-selected", selected ? "true" : "false");
        button.addEventListener("click", function () {
            if (isPaused || isFeedbackOpen || isTurnHandoffOpen || isBombModalOpen ||
                    isNoUseModalOpen || isMovementAnimating()) {
                return;
            }

            if (selectedItemIndex === index) {
                closeBombModal(false);
                if (!requestNoUse(itemType)) {
                    selectedItemIndex = null;
                    itemTargetTiles = [];
                    setUiMessage(readableType(itemType) + " cancelled.");
                }
            } else {
                selectedItemIndex = index;
                itemTargetTiles = [];
                setUiMessage(itemModeText(itemType));
            }
            render();
            if (isPlayerTargetItem(itemType) && selectedItemIndex === index) {
                openBombModal();
                return;
            }
            if (requiredTileTargetCount(itemType) > 0 && selectedItemIndex === index) {
                focusTile(selectedTile === null ? getCurrentPlayer(gameState).position : selectedTile);
            }
        });
        inventoryElement.append(button);
    });
}

function installedBombTargets(panelGame, playerId) {
    return panelGame.players.filter(function (player) {
        return player.bomb !== null && player.bomb.sourcePlayerId === playerId;
    });
}

function renderDetonateControls(panelGame) {
    const player = getCurrentPlayer(panelGame);
    const targets = installedBombTargets(panelGame, player.id);

    detonateControlsElement.innerHTML = "";
    detonateControlsElement.hidden = targets.length === 0 || panelGame.status === "won";
    if (detonateControlsElement.hidden) {
        return;
    }

    targets.forEach(function (target) {
        const button = document.createElement("button");
        const profile = profileForPlayer(target.id);

        button.type = "button";
        button.className = "detonate-button player-" + target.id;
        button.title = "Detonate bomb on " + playerName(target.id);
        button.setAttribute("aria-label", "Detonate bomb on " + playerName(target.id));
        button.innerHTML = "<span class=\"detonate-bomb-icon\">" + TILE_ICONS.timedBombPack +
            String(target.bomb.turnsLeft) + "</span><span class=\"detonate-target character-sprite sprite-side player-" +
            target.id + " " + roleClass(profile.roleId) + "\"></span>";
        button.addEventListener("click", function () {
            if (isPaused || isFeedbackOpen || isTurnHandoffOpen || isBombModalOpen ||
                    isNoUseModalOpen || isMovementAnimating()) {
                return;
            }

            selectedItemIndex = null;
            itemTargetTiles = [];
            updateGame(detonateCurrentPlayerBomb(gameState, target.id));
        });
        detonateControlsElement.append(button);
    });
}

// Rebuild select controls from the current game state while preserving the
// previous choice when it still exists.
function fillSelect(select, values, formatter) {
    const currentValue = select.value;
    select.innerHTML = "";

    values.forEach(function (value) {
        const option = document.createElement("option");
        option.value = String(value);
        option.textContent = formatter(value);
        select.append(option);
    });

    if (values.map(String).indexOf(currentValue) !== -1) {
        select.value = currentValue;
    }
}

function renderItemControls() {
    const panelGame = sidebarGameState();
    const player = getCurrentPlayer(panelGame);
    const itemType = currentSelectedItem(player);
    const requiredTargets = requiredTileTargetCount(itemType);
    const isTileTargetItem = requiredTargets > 0;
    const isDirectUseItem = itemType === ITEM_TYPES.MAGNET ||
        itemType === ITEM_TYPES.BOMB_DEFUSER;

    renderInventory(player);
    renderDetonateControls(panelGame);
    itemModeElement.hidden = true;
    itemModeElement.textContent = "";
    itemTargetsElement.hidden = true;
    itemTargetsElement.textContent = "";
    targetPlayerSelect.hidden = true;
    useItemButton.hidden = !isDirectUseItem && !isTileTargetItem;
    noUseButton.hidden = !canNoUseItem(itemType);
    fillSelect(targetPlayerSelect, gameState.players.map(function (target) {
        return target.id;
    }), function (playerId) {
        return playerName(playerId);
    });
    useItemButton.textContent = isTileTargetItem ? "Confirm" : "Use";
    useItemButton.disabled = itemType === "" ||
        (isTileTargetItem ? itemTargetTiles.length < requiredTargets : !isDirectUseItem);
    noUseButton.textContent = "No Use";
}

function renderVictoryScreen() {
    const hasWinner = gameState.status === "won";
    const winnerId = gameState.winnerId || 1;

    victoryScreenElement.hidden = !hasWinner;
    if (!hasWinner) {
        return;
    }

    victoryTitleElement.textContent = playerName(winnerId) + " wins";
    victoryCharacterElement.className = "victory-character character-sprite sprite-front player-" + winnerId + " " +
        roleClass(profileForPlayer(winnerId).roleId);
}

// A single render pass keeps the UI consistent after every game action.
function render() {
    renderBoard();
    renderTurn();
    renderItemControls();
    renderMovementLayer();
    renderVictoryScreen();
}

function hpLossPlayerIds(previousGame, nextGame) {
    return previousGame.players.filter(function (previousPlayer) {
        const nextPlayer = nextGame.players.find(function (player) {
            return player.id === previousPlayer.id;
        });

        return nextPlayer !== undefined && nextPlayer.hp < previousPlayer.hp;
    }).map(function (player) {
        return player.id;
    });
}

function timedBombExplosionTiles(previousGame, nextGame) {
    const placedBombMatch = nextGame.lastMessage.match(/Timed bomb placed: Player (\d+) has/);
    const explodedTiles = previousGame.players.filter(function (previousPlayer) {
        const nextPlayer = nextGame.players.find(function (player) {
            return player.id === previousPlayer.id;
        });

        return previousPlayer.bomb !== null && nextPlayer !== undefined && nextPlayer.bomb === null;
    }).map(function (player) {
        return player.position;
    });
    let placedBombPlayer;

    if (nextGame.lastMessage.indexOf("Timed bomb exploded") === -1) {
        return [];
    }

    if (explodedTiles.length > 0) {
        return explodedTiles;
    }

    if (placedBombMatch !== null) {
        placedBombPlayer = previousGame.players.find(function (player) {
            return player.id === Number(placedBombMatch[1]);
        });
        if (placedBombPlayer !== undefined) {
            return [placedBombPlayer.position];
        }
    }

    return [];
}

function monsterAttackTileIndex(nextGame) {
    if (nextGame.lastMessage.indexOf("Monster camp attacked") === -1) {
        return null;
    }
    if (itemTargetTiles.length > 0) {
        return itemTargetTiles[0];
    }
    if (selectedTile !== null) {
        return selectedTile;
    }
    return getCurrentPlayer(gameState).position;
}

function sidebarStateAfterDamage(previousGame, nextGame) {
    return Object.assign({}, previousGame, {
        key: Object.assign({}, nextGame.key),
        players: previousGame.players.map(function (previousPlayer) {
            const nextPlayer = nextGame.players.find(function (player) {
                return player.id === previousPlayer.id;
            });

            return nextPlayer === undefined ? previousPlayer : nextPlayer;
        }),
        lastMessage: nextGame.lastMessage,
        status: nextGame.status,
        winnerId: nextGame.winnerId
    });
}

function resetPlayerIds(previousGame, nextGame) {
    const resetMessage = nextGame.lastMessage.indexOf("reset to spawn") !== -1 ||
        nextGame.lastMessage.indexOf("reset to their spawn") !== -1 ||
        nextGame.lastMessage.indexOf("was reset to spawn") !== -1;

    return previousGame.players.filter(function (previousPlayer) {
        const nextPlayer = nextGame.players.find(function (player) {
            return player.id === previousPlayer.id;
        });

        return nextPlayer !== undefined &&
            nextPlayer.position === nextPlayer.spawnPosition &&
            previousPlayer.position !== nextPlayer.position &&
            (resetMessage || nextPlayer.hp > previousPlayer.hp);
    }).map(function (player) {
        return player.id;
    });
}

function resetFeedbackMessage(playerIds, baseMessage) {
    if (playerIds.length === 0) {
        return baseMessage;
    }
    return baseMessage + " " + playerIds.map(playerName).join(", ") +
        (playerIds.length === 1 ? " was" : " were") + " knocked out and revived at spawn.";
}

// A successful rule action either changes the active turn, changes how many
// actions remain, changes the game status, or records a different rule message.
// UI-only selections can be cleared after that so the next player starts fresh.
function didSpendAction(previousGame, nextGame) {
    return previousGame.currentPlayerIndex !== nextGame.currentPlayerIndex ||
            previousGame.remainingActions !== nextGame.remainingActions ||
            previousGame.roundNumber !== nextGame.roundNumber ||
            previousGame.status !== nextGame.status ||
            JSON.stringify(previousGame.pendingEvent || null) !== JSON.stringify(nextGame.pendingEvent || null);
}

function updateGame(nextGame, shouldShowFeedback) {
    const previousGame = gameState;
    const showFeedback = shouldShowFeedback !== false;
    const actionWasResolved = didSpendAction(previousGame, nextGame);
    const resetIds = resetPlayerIds(previousGame, nextGame);
    const feedbackMessage = resetFeedbackMessage(resetIds, nextGame.lastMessage);
    const messageChanged = feedbackMessage !== previousGame.lastMessage;
    const rewardDetails = noMoveRewardDetails(previousGame, nextGame);
    const rewardPromptMessage = noMoveRewardPrompt(rewardDetails);
    const shouldShowNoMoveReward = rewardPromptMessage !== "";
    const damagedPlayerIds = hpLossPlayerIds(previousGame, nextGame);
    const bombExplosionTiles = timedBombExplosionTiles(previousGame, nextGame);
    const monsterAttackTile = monsterAttackTileIndex(nextGame);
    const promptMessage = shouldShowNoMoveReward ? rewardPromptMessage : feedbackMessage;
    const promptWillOpen = (showFeedback || shouldShowNoMoveReward) && promptMessage !== "" &&
        (actionWasResolved || messageChanged || shouldShowNoMoveReward);
    const playerWillChange = previousGame.currentPlayerIndex !== nextGame.currentPlayerIndex;

    gameState = nextGame;
    if (playerWillChange && nextGame.status !== "won") {
        queueTurnHandoff(getCurrentPlayer(nextGame).id, sidebarStateAfterDamage(previousGame, nextGame));
        lockedSidebarGameState = sidebarStateAfterDamage(previousGame, nextGame);
    } else if (!isFeedbackOpen) {
        lockedSidebarGameState = null;
    }
    uiMessage = "";
    if (actionWasResolved) {
        selectedTile = null;
        selectedItemIndex = null;
        itemTargetTiles = [];
        pendingNoUseItemType = "";
        closeBombModal(false);
    }
    selectPendingEventItem();
    render();

    if (pendingEventItem() !== "" && !promptWillOpen && !isMovementAnimating()) {
        openPendingEventControls();
    }

    bombExplosionTiles.forEach(playExplosion);
    if (monsterAttackTile !== null) {
        playMonsterBite(monsterAttackTile);
    }
    if (damagedPlayerIds.length > 0) {
        flashDamagedPlayers(damagedPlayerIds);
    }
    if (damagedPlayerIds.indexOf(getCurrentPlayer(sidebarGameState()).id) !== -1) {
        flashCurrentHearts();
    }

    if (promptWillOpen) {
        showCenterPrompt(promptMessage);
    } else {
        maybeShowTurnHandoff();
    }
}

function visibleTileAt(tileIndex) {
    return getVisibleBoard(gameState).find(function (tile) {
        return tile.index === tileIndex;
    });
}

function canChooseItemTargetTile(tileIndex, itemType) {
    const tile = visibleTileAt(tileIndex);
    const isTileSwapItem = itemType === ITEM_TYPES.SWAP_ANY_TILES_WITH_HP_COST;
    const player = getCurrentPlayer(gameState);
    const isRemoteTrigger = itemType === ITEM_TYPES.REMOTE_TRIGGER;

    if (tile === undefined) {
        showCenterPrompt("Choose a board tile.", false);
        return false;
    }
    if (isRemoteTrigger) {
        if (Math.abs(tile.coordinates.row - Math.floor(player.position / gameState.boardSize)) +
                Math.abs(tile.coordinates.col - (player.position % gameState.boardSize)) > 2 ||
                !tile.revealed ||
                (!tile.hasVisibleKey && tile.type === TILE_TYPES.EMPTY) ||
                tile.type === TILE_TYPES.WALL ||
                tile.isExit) {
            showCenterPrompt("Choose a revealed event or item within 2 tiles.", false);
            return false;
        }
        return true;
    }
    if (isTileSwapItem && !tile.revealed) {
        showCenterPrompt("You cannot choose unrevealed tiles.", false);
        return false;
    }
    if (tile.players.length > 0) {
        showCenterPrompt("You cannot choose a tile with a player on it.", false);
        return false;
    }
    if (isTileSwapItem && tile.isSpawn) {
        showCenterPrompt("Choose a non-spawn tile.", false);
        return false;
    }
    return true;
}

function directionToAdjacentTile(tileIndex) {
    const player = getCurrentPlayer(gameState);
    const boardSize = gameState.boardSize;
    const currentRow = Math.floor(player.position / boardSize);
    const currentCol = player.position % boardSize;
    const targetRow = Math.floor(tileIndex / boardSize);
    const targetCol = tileIndex % boardSize;
    const rowDiff = targetRow - currentRow;
    const colDiff = targetCol - currentCol;

    if (rowDiff === -1 && colDiff === 0) {
        return DIRECTIONS.UP;
    }
    if (rowDiff === 1 && colDiff === 0) {
        return DIRECTIONS.DOWN;
    }
    if (rowDiff === 0 && colDiff === -1) {
        return DIRECTIONS.LEFT;
    }
    if (rowDiff === 0 && colDiff === 1) {
        return DIRECTIONS.RIGHT;
    }
    return null;
}

function boardButton(tileIndex) {
    return boardElement.querySelector("[data-index=\"" + tileIndex + "\"]");
}

function focusTile(tileIndex) {
    const button = boardButton(tileIndex);

    if (button !== null) {
        button.focus();
    }
}

function selectTile(tileIndex, shouldFocus) {
    const tile = visibleTileAt(tileIndex);
    const itemType = currentSelectedItem(getCurrentPlayer(gameState));
    const selectedMessage = itemType === ""
        ? "Tile " + tileIndex + " selected. " + tileEffectText(tile) + " Click it again or press Enter to confirm."
        : "Tile " + tileIndex + " selected for " + readableType(itemType) + ". Click it again or press Enter to confirm this target.";

    selectedTile = tileIndex;
    setUiMessage(selectedMessage);
    render();

    if (shouldFocus) {
        focusTile(tileIndex);
    }
}

function useSelectedItem() {
    const itemType = currentSelectedItem(getCurrentPlayer(gameState));
    const requiredTargets = requiredTileTargetCount(itemType);

    if (requiredTargets > 0 && itemTargetTiles.length < requiredTargets) {
        showCenterPrompt(requiredTargets === 1 ? "Choose a target tile first." : "Choose two tiles first.", false);
        return;
    }

    const nextGame = useCurrentPlayerItem(gameState, itemType, itemTarget(itemType));
    const itemWasUsed = didSpendAction(gameState, nextGame);

    updateGame(nextGame);
    if (!itemWasUsed) {
        itemTargetTiles = [];
        selectedTile = null;
        render();
    }
}

function confirmItemTargetTile(tileIndex, itemType) {
    const requiredTargets = requiredTileTargetCount(itemType);
    const targetIndex = itemTargetTiles.indexOf(tileIndex);
    let droppedTile = null;

    if (requiredTargets === 0) {
        showCenterPrompt("This item does not need a board tile. Use the right-side target controls, then press Use item.", false);
        return;
    }
    if (!canChooseItemTargetTile(tileIndex, itemType)) {
        return;
    }

    if (targetIndex !== -1) {
        itemTargetTiles.splice(targetIndex, 1);
    } else {
        itemTargetTiles.push(tileIndex);
        if (itemTargetTiles.length > requiredTargets) {
            droppedTile = itemTargetTiles.shift();
        }
    }
    selectedTile = null;
    if (droppedTile !== null) {
        setUiMessage("Tile " + droppedTile + " was unselected. Press Confirm to swap the two highlighted tiles.");
    } else if (requiredTargets === 1 && itemTargetTiles.length === 1) {
        setUiMessage("Target tile selected. Press Confirm to use it.");
    } else if (itemTargetTiles.length === requiredTargets) {
        setUiMessage("Two tiles selected. Press Confirm to swap them.");
    } else {
        setUiMessage("Choose " + (requiredTargets - itemTargetTiles.length) + " more tile.");
    }
    render();
}

function confirmSelectedTile(tileIndex) {
    const itemType = currentSelectedItem(getCurrentPlayer(gameState));
    const tile = visibleTileAt(tileIndex);
    const direction = directionToAdjacentTile(tileIndex);
    const previousGame = gameState;
    const movingPlayerId = getCurrentPlayer(gameState).id;
    let pendingMovement;
    let nextGame;

    if (itemType !== "") {
        confirmItemTargetTile(tileIndex, itemType);
        return;
    }

    if (!tile.revealed) {
        nextGame = revealTile(gameState, tileIndex);
        updateGame(nextGame);
        if (nextGame.lastMessage.indexOf("Mine exploded") !== -1) {
            playExplosion(tileIndex);
        }
        return;
    }

    if (direction === null) {
        showCenterPrompt("You can only move to one adjacent revealed tile.", false);
        return;
    }

    nextGame = moveCurrentPlayer(gameState, direction);
    pendingMovement = movementDetails(previousGame, nextGame, movingPlayerId, direction);
    if (pendingMovement === null &&
            nextGame.players[nextGame.currentPlayerIndex].position === getCurrentPlayer(gameState).position &&
            nextGame.currentPlayerIndex === gameState.currentPlayerIndex &&
            nextGame.roundNumber === gameState.roundNumber &&
            nextGame.status === gameState.status) {
        showCenterPrompt(nextGame.lastMessage || "You cannot move to that tile.", false);
        updateGame(nextGame, false);
        return;
    }

    if (pendingMovement !== null) {
        clearMovementAnimation();
        movementAnimation = pendingMovement;
        updateGame(nextGame, false);
        return;
    }
    updateGame(nextGame);
}

// First click selects a tile. Clicking the same tile again confirms the action:
// hidden tiles are revealed, while revealed adjacent tiles are movement targets.
function handleTileClick(tileIndex) {
    const itemType = currentSelectedItem(getCurrentPlayer(gameState));

    if (isPaused || isFeedbackOpen || isTurnHandoffOpen || isBombModalOpen ||
            isNoUseModalOpen || isMovementAnimating()) {
        return;
    }
    if (pendingEventItem() !== "" && requiredTileTargetCount(pendingEventItem()) === 0) {
        return;
    }
    if (requiredTileTargetCount(itemType) > 0) {
        confirmItemTargetTile(tileIndex, itemType);
        return;
    }

    if (selectedTile === tileIndex) {
        confirmSelectedTile(tileIndex);
        return;
    }

    selectTile(tileIndex, false);
}

// Different items need different target shapes; this function only translates
// form controls into the target object expected by game.js.
function itemTarget(itemType) {
    if (itemType === ITEM_TYPES.TIMED_BOMB_PACK) {
        return {
            playerId: selectedBombTargetId === null ? Number(targetPlayerSelect.value) : selectedBombTargetId,
            countdown: Number(bombCountdownInput.value)
        };
    }

    if (itemType === ITEM_TYPES.RESTRICT_MOVE || itemType === ITEM_TYPES.SWAP_PLAYER) {
        return {
            playerId: Number(targetPlayerSelect.value)
        };
    }

    if (itemType === ITEM_TYPES.THIEF_HAND) {
        return {
            playerId: selectedBombTargetId,
            itemType: selectedStealItemType
        };
    }

    if (itemType === ITEM_TYPES.SWAP_ANY_TILES_WITH_HP_COST) {
        return {
            firstIndex: itemTargetTiles[0],
            secondIndex: itemTargetTiles[1]
        };
    }

    if (itemType === ITEM_TYPES.REMOTE_TRIGGER) {
        return {
            tileIndex: itemTargetTiles[0]
        };
    }

    return {};
}

function isBoardTileElement(element) {
    return element !== null &&
            element.classList !== undefined &&
            element.classList.contains("tile");
}

function isFormControlElement(element) {
    const tagName = element === null || typeof element.tagName !== "string" ? "" : element.tagName.toLowerCase();

    return tagName === "button" || tagName === "input" || tagName === "select";
}

function selectedTileAfterArrow(key) {
    const boardSize = gameState.boardSize;
    const baseTile = selectedTile === null ? getCurrentPlayer(gameState).position : selectedTile;
    const row = Math.floor(baseTile / boardSize);
    const col = baseTile % boardSize;

    if (key === "ArrowUp" && row > 0) {
        return baseTile - boardSize;
    }
    if (key === "ArrowDown" && row < boardSize - 1) {
        return baseTile + boardSize;
    }
    if (key === "ArrowLeft" && col > 0) {
        return baseTile - 1;
    }
    if (key === "ArrowRight" && col < boardSize - 1) {
        return baseTile + 1;
    }
    return baseTile;
}

function startPreparedGame() {
    selectedTile = null;
    selectedItemIndex = null;
    itemTargetTiles = [];
    isPaused = false;
    isFeedbackOpen = false;
    isTurnHandoffOpen = false;
    isBombModalOpen = false;
    isNoUseModalOpen = false;
    selectedBombTargetId = null;
    selectedStealItemType = "";
    lockedSidebarGameState = null;
    pendingTurnHandoffPlayerId = null;
    pendingTurnHandoffLockedState = null;
    pendingNoUseItemType = "";
    pauseMenuElement.hidden = true;
    centerPromptElement.hidden = true;
    turnHandoffElement.hidden = true;
    bombModalElement.hidden = true;
    noUseModalElement.hidden = true;
    victoryScreenElement.hidden = true;
    clearMovementAnimation();
    uiMessage = "";
    gameState = createGame(playerCount(), {seed: Date.now()});
    showScreen("intro");
    introStartButton.focus();
}

function enterPreparedGame() {
    if (introScreen.hidden) {
        return;
    }

    showScreen("game");
    render();
    queueTurnHandoff(getCurrentPlayer(gameState).id, null);
    maybeShowTurnHandoff();
}

menuStartButton.addEventListener("click", function () {
    renderPlayerSetup();
    showScreen("setup");
});

setupBackButton.addEventListener("click", function () {
    showScreen("menu");
});

introStartButton.addEventListener("click", enterPreparedGame);

setupPlayerCountElement.addEventListener("change", function () {
    const firstUnreadyIndex = firstUnreadyPlayerIndex();

    clampSetupActivePlayer();
    if (firstUnreadyIndex !== -1) {
        setupActivePlayerIndex = firstUnreadyIndex;
    }
    renderPlayerSetup();
});

playerSetupListElement.addEventListener("input", function (event) {
    const playerId = Number(event.target.dataset.playerId);
    const profile = playerProfiles[playerId - 1];
    const currentNameElement = setupRolePickerElement.querySelector(".setup-current-name");
    const card = event.target.closest(".player-setup-card");

    if (event.target.classList.contains("setup-name-input") && profile !== undefined) {
        profile.name = event.target.value;
        profile.ready = profile.roleId !== "";
        if (!profile.ready) {
            setupActivePlayerIndex = profile.id - 1;
        }
        if (card !== null) {
            card.classList.toggle("ready", profile.ready);
            card.classList.toggle("active-setup-player", setupActiveProfile().id === profile.id);
        }
        if (setupActiveProfile().id === profile.id && currentNameElement !== null) {
            currentNameElement.textContent = playerName(profile.id);
        }
        updateSetupStatus();
    }
});

setupRolePickerElement.addEventListener("click", function (event) {
    const roleButton = event.target.closest(".setup-role-choice");
    const confirmButton = event.target.closest("#setup-confirm-role");

    if (confirmButton !== null && !confirmButton.disabled) {
        confirmSetupRole();
        return;
    }

    if (roleButton !== null && !roleButton.disabled) {
        selectSetupRole(roleButton.dataset.roleId);
    }
});

setupStartGameButton.addEventListener("click", function () {
    if (isSetupReady()) {
        startPreparedGame();
    }
});

endTurnButton.addEventListener("click", function () {
    if (isPaused || isFeedbackOpen || isTurnHandoffOpen || isBombModalOpen ||
            isNoUseModalOpen || isMovementAnimating()) {
        return;
    }
    selectedItemIndex = null;
    itemTargetTiles = [];
    updateGame(endTurn(gameState), false);
});

useItemButton.addEventListener("click", function () {
    if (isPaused || isFeedbackOpen || isTurnHandoffOpen || isBombModalOpen ||
            isNoUseModalOpen || isMovementAnimating()) {
        return;
    }

    const itemType = currentSelectedItem(getCurrentPlayer(gameState));

    if (itemType === ITEM_TYPES.TIMED_BOMB_PACK) {
        openBombModal();
        return;
    }

    if (itemType !== "") {
        useSelectedItem();
    }
});

noUseButton.addEventListener("click", function () {
    if (isPaused || isFeedbackOpen || isTurnHandoffOpen || isNoUseModalOpen || isMovementAnimating()) {
        return;
    }

    requestNoUse(currentSelectedItem(getCurrentPlayer(gameState)));
});

gameMenuButton.addEventListener("click", function () {
    if (gameScreen.hidden || gameState.status === "won") {
        return;
    }

    setPaused(true);
});

resumeGameButton.addEventListener("click", function () {
    setPaused(false);
});

restartGameButton.addEventListener("click", function () {
    startPreparedGame();
});

pauseMainMenuButton.addEventListener("click", function () {
    selectedTile = null;
    selectedItemIndex = null;
    itemTargetTiles = [];
    showScreen("menu");
});

victoryRestartButton.addEventListener("click", function () {
    startPreparedGame();
});

victoryMainMenuButton.addEventListener("click", function () {
    selectedTile = null;
    selectedItemIndex = null;
    itemTargetTiles = [];
    showScreen("menu");
});

centerPromptCloseButton.addEventListener("click", closeCenterPrompt);

turnHandoffCard.addEventListener("click", closeTurnHandoff);

bombCancelButton.addEventListener("click", function () {
    const itemType = currentSelectedItem(getCurrentPlayer(gameState));

    if (requestNoUse(itemType)) {
        return;
    }

    closeBombModal(false);
    selectedItemIndex = null;
    itemTargetTiles = [];
    setUiMessage(readableType(itemType) + " cancelled.");
    render();
});

noUseBackButton.addEventListener("click", closeNoUseModal);

noUseConfirmButton.addEventListener("click", confirmNoUseCancel);

bombConfirmButton.addEventListener("click", function () {
    const itemType = currentSelectedItem(getCurrentPlayer(gameState));
    const countdown = Number(bombCountdownInput.value);

    if (selectedBombTargetId === null) {
        return;
    }
    if (itemType === ITEM_TYPES.THIEF_HAND && selectedStealItemType === "") {
        return;
    }
    if (itemType === ITEM_TYPES.TIMED_BOMB_PACK && (!Number.isInteger(countdown) || countdown < 1 || countdown > 20)) {
        showCenterPrompt("Choose a 1-20 turn countdown.", false);
        return;
    }

    targetPlayerSelect.value = String(selectedBombTargetId);
    useSelectedItem();
});

document.addEventListener("keydown", function (event) {
    const target = event.target;
    const targetIsBoardTile = isBoardTileElement(target);
    const targetIsOtherControl = isFormControlElement(target) && !targetIsBoardTile;
    const arrowTarget = selectedTileAfterArrow(event.key);

    if (isFeedbackOpen) {
        if (event.key === "Escape" || event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            closeCenterPrompt();
        }
        return;
    }

    if (isTurnHandoffOpen) {
        if (event.key === "Escape" || event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            closeTurnHandoff();
        }
        return;
    }

    if (isNoUseModalOpen) {
        if (event.key === "Escape") {
            event.preventDefault();
            closeNoUseModal();
        }
        return;
    }

    if (isBombModalOpen) {
        if (event.key === "Escape") {
            event.preventDefault();
            requestNoUse(currentSelectedItem(getCurrentPlayer(gameState)));
        }
        return;
    }

    if (isMovementAnimating()) {
        return;
    }

    if (event.key === "Escape" && !gameScreen.hidden) {
        event.preventDefault();
        setPaused(!isPaused);
        return;
    }

    if (isPaused) {
        return;
    }

    if (gameState.status === "won") {
        return;
    }

    if (pendingEventItem() !== "" && requiredTileTargetCount(pendingEventItem()) === 0) {
        return;
    }

    if (event.key.startsWith("Arrow") && !targetIsOtherControl) {
        event.preventDefault();
        selectTile(arrowTarget, true);
        return;
    }

    if (event.key === "Enter" && selectedTile !== null && !targetIsOtherControl) {
        if (targetIsBoardTile && Number(target.dataset.index) !== selectedTile) {
            return;
        }
        event.preventDefault();
        confirmSelectedTile(selectedTile);
    }
});

renderPlayerSetup();
showScreen("menu");
render();
