import './CategoryTabs.css';

function CategoryTabs({ selected, onSelect }) {
  const categories = [
    { id: 'rent', name: 'Alquiler', icon: '🏠' },
    { id: 'items', name: 'Artículos', icon: '👕' },
    { id: 'services', name: 'Servicios', icon: '🛠' }
  ];

  return (
    <div className="category-tabs">
      {categories.map(category => (
        <button
          key={category.id}
          className={`category-tab ${selected === category.id ? 'active' : ''}`}
          onClick={() => onSelect(category.id)}
        >
          <span className="category-icon">{category.icon}</span>
          <span className="category-name">{category.name}</span>
        </button>
      ))}
    </div>
  );
}

export default CategoryTabs;

