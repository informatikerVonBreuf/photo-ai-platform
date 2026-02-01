// EXEMPLE D'UTILISATION DU DROPDOWN
// À placer dans un fichier ou copier dans ton code existant

import Dropdown from "../components/Dropdown";

// Exemple 1 : Sélecteur d'orientation
export function OrientationSelector({ value, onChange }) {
  const orientationOptions = [
    { value: "any", label: "Toute orientation" },
    { value: "portrait", label: "Portrait" },
    { value: "landscape", label: "Paysage" },
    { value: "square", label: "Carré" },
  ];

  return (
    <div className="field">
      <label className="fieldLabel">Orientation</label>
      <Dropdown
        label="Sélectionner une orientation"
        items={orientationOptions}
        onSelect={(item) => onChange(item.value)}
      />
    </div>
  );
}

// Exemple 2 : Sélecteur de qualité
export function QualitySelector({ value, onChange }) {
  const qualityOptions = [
    { value: "all", label: "Toutes les photos" },
    { value: "hq", label: "Haute qualité (4K+)" },
    { value: "mq", label: "Qualité moyenne (1080p)" },
    { value: "draft", label: "Brouillons" },
  ];

  return (
    <div className="field">
      <label className="fieldLabel">Qualité</label>
      <Dropdown
        label="Sélectionner la qualité"
        items={qualityOptions}
        onSelect={(item) => onChange(item.value)}
      />
    </div>
  );
}

// Exemple 3 : Sélecteur de collection
export function CollectionSelector({ value, onChange, collections = [] }) {
  const items = collections.map((col) => ({
    value: col.id,
    label: col.name,
  }));

  return (
    <div className="field">
      <label className="fieldLabel">Collection</label>
      <Dropdown
        label="Choisir une collection..."
        items={items}
        onSelect={(item) => onChange(item.value)}
      />
    </div>
  );
}

// ============================================
// INTÉGRATION DANS FiltersPage :
// ============================================

/*
DANS FiltersPage.jsx, remplace les inputs "orientation" par :

import Dropdown from "../components/Dropdown";
import "../styles/dropdown.css"; // <-- IMPORTANT : importe le CSS

// Dans le JSX, remplace :
// <select value={orientation} onChange={(e) => setOrientation(e.target.value)}>
//   <option value="any">Toute orientation</option>
//   ...
// </select>

// Par :
<Dropdown
  label="Toute orientation"
  items={[
    { value: "any", label: "Toute orientation" },
    { value: "portrait", label: "Portrait" },
    { value: "landscape", label: "Paysage" },
    { value: "square", label: "Carré" },
  ]}
  onSelect={(item) => setOrientation(item.value)}
/>

// Et n'oublie pas d'importer le CSS en haut du fichier :
import "../styles/dropdown.css";

*/
