# 🎯 Lichess Random Endgames Feature

## Overview

Cette nouvelle fonctionnalité génère des **finales aléatoires et variées** pour permettre à l'utilisateur de s'entrainer à différents types d'endgames.

## Features

✅ **Génération intelligente de finales** basée sur le niveau de l'utilisateur (rating)  
✅ **5 types d'endgames différents**:
- King & Pawn Endgames
- Rook Endgames  
- Minor Piece Endgames (Bishop, Knight)
- Mixed Endgames (Queen)
- Rook & Pawn Endgames

✅ **Placement aléatoire des pièces** pour plus de variété  
✅ **Couleur aléatoire** (jouer en blanc ou noir)  
✅ **Intégration facile au UI** via le bouton "♞ Lichess"

## How to Use

### Pour les utilisateurs

1. Lancez l'application normalement:
```bash
./run.sh
# ou
uvicorn backend:app --reload --port 8000
```

2. Dans le **Endgame Dashboard**, cliquez sur le bouton **"♞ Lichess"**
3. Une nouvelle finale aléatoire se chargera automatiquement
4. Jouez contre l'IA (Stockfish)

### Pour les développeurs

#### Nouvel Endpoint API

```
GET /api/lichess-endgame?rating=1200
```

**Paramètres:**
- `rating` (int, optionnel): Le niveau de l'utilisateur (défaut: 1200)

**Réponse:**
```json
{
  "fen": "8/2k5/8/8/4K2P/8/8/8 b - - 0 1",
  "name": "king pawn endgame",
  "playerColor": "black",
  "source": "lichess",
  "url": ""
}
```

#### Backend - Nouvelle fonction

```python
generate_advanced_endgame(rating: int = 1200) -> dict
```

Génère une position aléatoire basée sur:
- **Difficulté adaptée au rating**: Plus le rating est haut, plus les finales sont complexes
- **5 types d'endgames** choisis aléatoirement
- **Positions variées** au sein de chaque type

## Architecture

### Backend (`backend.py`)

```python
# Génère les finales aléatoires
def generate_advanced_endgame(rating: int = 1200):
    # Calcule le niveau de difficulté
    # Choisit un type d'endgame
    # Sélectionne une position aléatoire
    # Retourne le FEN et les métadonnées

# Endpoint API
@app.get("/api/lichess-endgame")
def lichess_endgame(rating: int = 1200):
    # Génère la finale
    # Choisit la couleur du joueur aléatoirement
    # Retourne les données au frontend
```

### Frontend (`js/main.js`)

```javascript
// Nouvelle fonction pour charger les finales Lichess
async function loadLichessEndgame() {
    const url = `${API_BASE}/api/lichess-endgame?rating=${playerRating}`;
    const data = await fetch(url).then(r => r.json());
    // Charge la position sur le plateau
    // Configure le jeu
}

// Event listener sur le bouton
lichessEndgameBtn.addEventListener('click', () => {
    loadLichessEndgame();
});
```

## Personnalisation

Pour ajouter plus de positions d'endgames:

1. Ouvrez `backend.py`
2. Modifiez le dictionnaire `base_positions` dans `generate_advanced_endgame()`
3. Ajoutez de nouveaux FENs aux listes correspondantes

Exemple:
```python
'my_new_endgame': [
    'fen1',
    'fen2',
    'fen3',
]
```

## Future Enhancements

- [ ] Intégration avec l'API Lichess pour les puzzles
- [ ] Filtrage par type d'endgame
- [ ] Statistiques de performance par type
- [ ] Partage de finales avec d'autres joueurs
- [ ] Import de positions personnalisées

## Dependencies

- `requests` (pour futures intégrations API)
- `python-chess` (pour la validation des positions)

## Troubleshooting

### Le bouton Lichess n'apparaît pas

Vérifiez que vous avez l'HTML à jour:
```html
<button class="endgame-btn lichess-btn" id="lichessEndgameBtn">
    <span class="btn-label">♞ Lichess</span>
    <span class="btn-desc">Random from Lichess</span>
</button>
```

### L'API retourne une erreur 500

Vérifiez que:
1. Le backend démarre sans erreur: `python3 backend.py`
2. La fonction `generate_advanced_endgame()` est bien définie
3. Les FENs sont valides avec python-chess

