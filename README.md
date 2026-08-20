# ♠ RangeMaker

Application web **100 % locale** (React + Vite) pour construire, sauvegarder et
imprimer des **matrices de ranges poker** (grille standard 13×13). Aucune base
de données ni serveur : tout est stocké dans le `localStorage` du navigateur.

## Lancer l'application

```bash
npm install
npm run dev
```

Puis ouvrir l'URL affichée (par défaut http://localhost:5173).

Pour générer une version de production :

```bash
npm run build
npm run preview
```

## La matrice 13×13

- **Diagonale** = paires (AA, KK … 22)
- **Triangle supérieur droit** = mains _suited_ (AKs, AQs …)
- **Triangle inférieur gauche** = mains _offsuit_ (AKo, AQo …)
- Ordre des rangs (lignes et colonnes) : `A K Q J T 9 8 7 6 5 4 3 2`

## Utilisation

### 1. Définir les actions
Dans le panneau **Actions** (à droite) : ajoutez des actions (Limp, Raise,
Fold, Call, 3bet…), choisissez leur **couleur** (color picker) et leur **nom**.
Cliquez sur une action pour la rendre **active** (une seule à la fois).

### 2. Remplir la grille
Deux modes, combinables :

- **Peinture** : réglez le curseur « % appliqué au clic », puis
  **cliquez / glissez** sur les cases pour appliquer l'action active à ce
  pourcentage. À 100 %, la case devient pleine de cette action ; les autres
  actions de la case sont réduites automatiquement pour ne jamais dépasser 100 %.
- **Édition fine** : **clic droit** ou **double-clic** sur une case ouvre une
  fenêtre avec un **slider + champ numérique** par action, pour régler
  précisément la répartition (ex. AKs = 70 % Limp / 25 % Raise / 5 % Fold).
  Le reste jusqu'à 100 % est laissé **neutre (gris clair)**.

Chaque case affiche les couleurs en **bandes verticales proportionnelles**
(empilées horizontalement), avec le nom de la main lisible par-dessus.

Boutons : **Vider la case** (dans l'éditeur) et **Tout réinitialiser**
(au-dessus de la grille).

### 3. Sauvegarder / gérer
Panneau **Matrices enregistrées** :

- **Enregistrer sous…** : demande un nom et stocke la grille + les actions.
- **Mettre à jour** : écrase la matrice actuellement chargée.
- Sur chaque matrice : **Charger, Renommer, Dupliquer, Export (JSON), Supprimer**.
- **Importer JSON** : recharge une matrice exportée (sauvegarde externe / partage).

### 4. Export PDF imprimable
- Cochez les cases des matrices à imprimer.
- Choisissez le nombre de **matrices par page** (1 ou 2), puis **Générer le PDF**.
- Le PDF (format **A4**) contient, pour chaque matrice : son **nom**, la
  **grille 13×13** avec le remplissage proportionnel des couleurs, et une
  **légende** (nom + couleur + % global moyen de chaque action).

## Stack technique
- **React 18 + Vite** (JavaScript)
- **jsPDF** + **html2canvas** pour l'export PDF (rendu fidèle des couleurs)
- Persistance : **localStorage** uniquement

## Structure du projet

```
src/
├── main.jsx                # point d'entrée React
├── App.jsx                 # état global + logique (peinture, sauvegarde…)
├── styles.css              # styles de l'interface
├── constants.js            # rangs, actions par défaut, clé localStorage
├── utils/
│   ├── hands.js            # noms des mains + grille vide + totaux
│   ├── storage.js          # lecture/écriture localStorage
│   └── pdf.js              # génération du PDF (jsPDF + html2canvas)
└── components/
    ├── RangeGrid.jsx       # grille 13×13 + clic/glisser
    ├── RangeCell.jsx       # une case + bandes proportionnelles
    ├── ActionsPanel.jsx    # définition/sélection des actions
    ├── CellEditor.jsx      # édition fine d'une case
    └── MatrixManager.jsx   # sauvegarde / chargement / import-export / PDF
```
