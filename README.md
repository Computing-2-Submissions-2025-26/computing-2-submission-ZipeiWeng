# Journey

**CID:** 02622860

Journey is a local multiplayer browser board game for 2 to 4 players. Players explore a hidden 9 by 9 map, reveal tiles, collect tools, avoid hazards, steal or recover the key, and try to reach the glowing gate in the centre of the board.

The project is split into a pure game module, a browser interface, unit tests, and generated JSDoc API documentation.

## How To Run

Install dependencies:

```properties
npm install
```

Run the unit tests:

```properties
npm test
```

Generate the API documentation:

```properties
npm run docs
```

Run syntax lint checks:

```properties
npm run lint
```

Note: this template includes an older `jslint` package that cannot parse ES module `import` and `export` syntax. The `lint` script therefore uses Node's syntax checker on the project JavaScript files, while the code keeps the required module structure for the coursework API and browser app.

Open the web app:

- Use the VS Code launch configuration `Run Web App - Firefox`, or
- Open `web-app/index.html` in Firefox.

## Project Structure

- `web-app/game.js` contains the game rules and exported API. It has no DOM or UI code.
- `web-app/main.js` handles rendering, events, animation, menus, and calls into `game.js`.
- `web-app/index.html` contains the page structure.
- `web-app/default.css` imports the main stylesheet.
- `web-app/style.css` contains the visual layout, board, character, modal, and animation styles.
- `web-app/tests/game.test.js` contains behaviour-focused Mocha tests for the game module.
- `jsdoc.json` points JSDoc at `web-app/game.js`.
- `docs/` contains generated API documentation.

## Game Objective

The goal is to find the key and reach the glowing gate in the centre tile.

The key appears during one of the first eight hidden tile reveals. Once the key has been found, it can be picked up, stolen, dropped, pulled with a magnet, or stolen with the thief hand. A player wins by carrying the key onto the centre gate.

If a player reaches the gate without the key, the game shows a warning that the key is needed.

## Turn And Input Rules

Each player normally has 1 action on their turn.

A player selects a tile with the mouse or keyboard. Selecting the same tile again confirms the action.

- Confirming a hidden tile reveals it.
- Confirming an adjacent revealed tile moves onto it.
- Hidden tiles cannot be entered.
- Revealed walls cannot be entered.
- Movement, reveal, and item use are the main action types.
- The action boost event gives the current player 2 extra actions.

Keyboard support:

- Arrow keys move the current tile selection.
- Enter confirms the selected tile.
- Escape opens or closes the pause menu.

If a player finishes five of their own turns without using a move action, they receive one random tool from a small reward pool. This helps players recover when blocked by the map.

## Player State

Each player has:

- A custom name.
- A selected character colour.
- A board position.
- 3 maximum HP.
- A visible HP marker above their character on the map.
- An inventory for stored tools.
- Optional key ownership.
- Optional timed bomb status.

When a player is knocked out, they return to their spawn position, recover to full HP, lose any installed timed bomb, and drop the key if they were carrying it.

## Tile Types

The board contains hidden tiles. When revealed, a tile can become one of these types.

### Wall

A wall blocks movement. Players cannot step onto it. Bomb effects can destroy nearby revealed walls, turning them into empty tiles.

### Empty

An empty tile has no extra effect.

### Mine

A mine explodes immediately when revealed. It affects tiles within distance 1:

- Players in range are knocked out and reset to spawn.
- Nearby hidden tiles are revealed.
- Nearby revealed walls are destroyed and become empty tiles.

### Monster Camp

A monster camp attacks a player who steps onto it. The player loses 1 HP and receives visual feedback. The tile is consumed after the attack.

### Full Heal

Restores the current player to full HP when stepped on.

### Restrict Move

A temporary event. The current player must choose a target player or dismiss the event. The target player skips their next turn.

### Swap Player

A temporary event. The current player chooses another player and swaps positions with them.

### Action Boost

Gives the current player 2 more actions.

### Timed Bomb Pack

A temporary event when found on the board. The current player chooses a target player and a countdown from 1 to 20.

Bomb rules:

- The countdown follows the bomb carrier's completed turns.
- The installer can spend an action to detonate their installed bomb early.
- The carrier can pass the bomb by moving onto another player before it explodes.
- Players on the same tile as the explosion are knocked out.
- Players at distance 1 lose 2 HP.
- Players at distance 2 lose 1 HP.
- Nearby revealed walls are destroyed.

### Magnet

A stored item. A player can use it later to pull a dropped key or steal a held key if the key or key holder is within distance 3.

### Thief Hand

A stored item. A player can use it later to steal one item from another player. It can also steal the key.

### Remote Trigger

A stored item. A player can trigger a revealed event or item within distance 2 without standing on that tile. It can also collect a visible key within distance 2.

### Costly Swap

A stored item. A player chooses two revealed, unoccupied, non-spawn tiles and swaps their contents. The centre gate can be selected. Using this item costs 1 HP.

### Bomb Defuser

A stored item. A player can remove a timed bomb installed on themselves. If they have no bomb, the item is not consumed.

## Random Tile Weights

Hidden non-key tiles use weighted random selection. Empty tiles currently have a base probability of about 19 percent. Non-empty tiles are more common, and the game also reduces nearby event/item weights so special tiles are less likely to cluster too tightly.

The current base weights are stored in `RANDOM_TILE_WEIGHTS` in `web-app/game.js`.

## Web Interface

The browser app includes:

- A main menu.
- A setup screen for player count, names, and unique character colours.
- A start guide screen with the glowing gate and "Go to The Gate!".
- A fixed board background using the provided map artwork.
- Character sprites and walking animation.
- On-map HP, key, and bomb indicators.
- Event explanation modals with icons or diagrams.
- Inventory controls for stored tools.
- Target selection modals for player-targeting tools.
- Pause menu, restart, and return-to-menu controls.
- A victory screen with the winning character.

## API Summary

The game module exports functions for creating and transitioning game state:

- `createGame`
- `getCurrentPlayer`
- `getCoordinates`
- `getIndex`
- `getManhattanDistance`
- `getNextPosition`
- `moveCurrentPlayer`
- `revealTile`
- `useCurrentPlayerItem`
- `detonateCurrentPlayerBomb`
- `discardCurrentPlayerItem`
- `endTurn`
- `isGameWon`
- `getVisibleBoard`

Each exported function is documented in `game.js` with JSDoc, including parameters and return values.

## Testing

The Mocha tests focus on the game module, not the UI implementation. They cover board creation, movement, hidden and revealed tiles, wall blocking, key ownership, win conditions, player damage and reset, mines, monster camps, stored items, temporary events, bomb behaviour, no-move rewards, and immutability of the core game functions.

Run them with:

```properties
npm test
```
