// frontend/src/components/common/FavoriteStar.jsx
// Star toggle shown just left of a link's delete button. Filled amber = in Favorites.
import { Star } from 'lucide-react';

const FavoriteStar = ({ active, onToggle, size = 13, style }) => (
  <button
    type="button"
    onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggle(); }}
    title={active ? 'Remove from favorites' : 'Add to favorites'}
    aria-label={active ? 'Remove from favorites' : 'Add to favorites'}
    aria-pressed={active}
    style={{
      background: 'none', border: 'none', cursor: 'pointer', padding: '2px',
      display: 'flex', alignItems: 'center', flexShrink: 0,
      color: active ? '#F59E0B' : '#B8BCC4', transition: 'color .15s, transform .1s',
      ...style,
    }}
    onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = '#F59E0B'; }}
    onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = '#B8BCC4'; }}
  >
    <Star size={size} fill={active ? '#F59E0B' : 'none'} strokeWidth={2} />
  </button>
);

export default FavoriteStar;
