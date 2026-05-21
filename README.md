# HiChess - Chess Game Online

Un jeu d'échecs moderne et élégant avec interface web interactive, construit avec **chessground**, **chess.js**, **FastAPI** et **Python**.

## Features

- ♟️ Interface moderne avec **chessground** (vraie UI d'échecs)
- 🤖 IA adversaire jouable automatiquement
- ✅ Validation complète des coups légaux avec chess.js
- 📊 Détection automatique des checks, checkmates et draws
- 🎨 Design responsive et beau (sidebar avec contrôles)
- 📋 Affichage live du FEN (position)
- 🔄 Undo/Reset des coups
- 📱 Responsive design (fonctionne sur mobile et desktop)

## Installation

### Prérequis

- Python 3.8+
- pip

### Setup

```bash
# Installer les dépendances backend
pip install -r requirements.txt
```

**Frontend**: Aucune installation nécessaire - les librairies (chessground, chess.js) sont chargées via CDN.

## Utilisation

### Lancer le serveur (2 options)

#### Option 1: Script automatique (Mac/Linux)

```bash
chmod +x run.sh
./run.sh
```

Le navigateur s'ouvrira automatiquement sur `http://localhost:8000`

#### Option 2: Démarrage manuel

```bash
uvicorn backend:app --reload --port 8000
```

Puis ouvrir dans votre navigateur:
```
http://localhost:8000
```

### Jouer

1. Le board s'affiche avec les pièces à leur position initiale
2. **Les Blancs (vous) jouent en premier**
3. Cliquez et glissez pour bouger vos pièces
4. Les carrés verts montrent les coups légaux
5. **L'IA (Noir) joue automatiquement** après votre coup
6. Utilisez les boutons:
   - 🎮 **New Game**: Nouvelle partie
   - 🔄 **Undo**: Annuler les 2 derniers coups
   - 🔁 **Reset**: Réinitialiser la partie
7. Le FEN s'affiche à gauche et peut être copié

## Architecture

### Frontend (`main.html`, `js/main.js`, `css/main.css`)

- **Chessground** : Interface visuelle du plateau d'échecs
- **Chess.js** : Logique et validation des coups légaux
- **Fetch API** : Communication REST avec le backend

### Backend (`backend.py`)

- **FastAPI** : Framework web léger asynchrone
- **python-chess** : Moteur d'échecs robuste
- **CORS** : Support des requêtes cross-origin

## Endpoints API

### `POST /api/validate-move`

Valide et joue un coup.

**Request:**
```json
{
    "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    "from_square": "e2",
    "to_square": "e4"
}
```

**Response:**
```json
{
    "valid": true,
    "fen": "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
    "isGameOver": false,
    "result": null
}
```

### `POST /api/ai-move`

Fait jouer l'IA.

**Request:**
```json
{
    "fen": "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1"
}
```

**Response:**
```json
{
    "move": "e7e5",
    "fen": "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2",
    "isGameOver": false,
    "result": null
}
```

## Utilisation

1. Les Blancs jouent toujours en premier (vous)
2. Cliquez et glissez pour bouger les pièces
3. Les coups légaux sont surlignés en vert
4. L'IA (Noir) joue automatiquement après votre coup
5. Cliquez "New Game" pour recommencer une partie

## Améliorations futures

- [ ] Moteur IA plus intelligent (minimax, évaluation)
- [ ] Sauvegarde des parties
- [ ] Historique des coups
- [ ] Mode PvP en ligne
- [ ] Chronomètre / Blitz
- [ ] Variations et analyse

