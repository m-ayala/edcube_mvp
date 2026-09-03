import { useRef, useState, useLayoutEffect } from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';

// A titled, horizontally-scrolling row of cards with prev/next pagers that
// appear only when the track actually overflows. Used for the Folders,
// Published and Draft sections on the My Courses page.
const CardRow = ({ label, count, children }) => {
  const trackRef = useRef(null);
  const [overflow, setOverflow] = useState({ left: false, right: false });

  const update = () => {
    const el = trackRef.current;
    if (!el) return;
    const left = el.scrollLeft > 4;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
    setOverflow((prev) => (prev.left === left && prev.right === right ? prev : { left, right }));
  };

  useLayoutEffect(() => {
    update();
    const el = trackRef.current;
    if (!el) return;
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      el.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [children]);

  const page = (dir) => {
    const el = trackRef.current;
    if (el) el.scrollBy({ left: dir * (el.clientWidth * 0.8), behavior: 'smooth' });
  };

  return (
    <section style={{ marginBottom: '42px' }}>
      <h2 style={{
        margin: '0 0 16px', fontFamily: "'DM Sans', sans-serif", fontWeight: 500,
        fontSize: '25px', letterSpacing: '-0.01em', color: '#0E1620',
      }}>
        {label}
        {count != null && (
          <span style={{ marginLeft: '10px', fontSize: '16px', color: '#9CA3AF', fontWeight: 500 }}>{count}</span>
        )}
      </h2>

      <div style={{ position: 'relative' }}>
        <div
          ref={trackRef}
          style={{
            display: 'flex', gap: '22px', overflowX: 'auto', padding: '4px 4px 10px',
            scrollSnapType: 'x proximity', scrollbarWidth: 'none',
          }}
          className="card-row-track"
        >
          {children}
        </div>

        {overflow.left && (
          <button className="mc-btn" onClick={() => page(-1)} style={{ ...pager, left: '-4px' }} aria-label="Scroll left">
            <ChevronLeft size={18} />
          </button>
        )}
        {overflow.right && (
          <button className="mc-btn" onClick={() => page(1)} style={{ ...pager, right: '-4px' }} aria-label="Scroll right">
            <ChevronRight size={18} />
          </button>
        )}
      </div>
    </section>
  );
};

const pager = {
  position: 'absolute', top: '50%', transform: 'translateY(-50%)', zIndex: 3,
  width: '42px', height: '42px', borderRadius: '50%',
  background: '#fff', border: '1px solid #EADFE6',
  boxShadow: '0 10px 24px -10px rgba(40,25,45,0.32)',
  display: 'grid', placeItems: 'center', color: '#C1275E', cursor: 'pointer',
};

export default CardRow;
