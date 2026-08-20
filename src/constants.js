// Ordre officiel des rangs, du plus fort au plus faible.
// Utilisé pour l'axe horizontal (colonnes) ET vertical (lignes) de la matrice 13x13.
export const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2']

// Actions par défaut proposées à l'ouverture de l'appli.
export const DEFAULT_ACTIONS = [
  { id: 'a-raise', name: 'Raise', color: '#e53935' },
  { id: 'a-call', name: 'Call', color: '#43a047' },
  { id: 'a-limp', name: 'Limp', color: '#1e88e5' },
  { id: 'a-fold', name: 'Fold', color: '#9e9e9e' },
]

// Clé de stockage localStorage.
export const STORAGE_KEY = 'rangemaker.matrices.v1'
