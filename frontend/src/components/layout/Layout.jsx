import { useRef, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

const Layout = () => {
  const blobsRef = useRef(null);

  useEffect(() => {
    const el = blobsRef.current;
    if (!el) return;
    const colors = ['#B2E8C8', '#ACD8F0', '#F2C0D4', '#F7E4A0'];
    const cols = 7, rows = 6;
    const xStep = 100 / cols, yStep = 100 / rows;
    let ci = 0;
    for (let row = 0; row < rows; row++) {
      const offset = (row % 2 === 1) ? xStep / 2 : 0;
      for (let col = 0; col < cols; col++) {
        const x = offset + col * xStep + xStep * 0.5;
        const y = row * yStep + yStep * 0.5;
        if (x > 108) continue;
        const jx = Math.sin(row * 7 + col * 3) * 3.5;
        const jy = Math.cos(row * 5 + col * 11) * 3.5;
        const size = 90 + Math.abs(Math.sin(row * 4 + col * 9)) * 55;
        const blur = 40 + Math.abs(Math.cos(row * 3 + col * 7)) * 22;
        const opacity = 0.25 + Math.abs(Math.sin(row * 6 + col * 2)) * 0.16;
        const blob = document.createElement('div');
        blob.style.cssText = `position:absolute;border-radius:50%;width:${size}px;height:${size}px;background:${colors[ci % 4]};left:${x + jx}%;top:${y + jy}%;filter:blur(${blur}px);opacity:${opacity};transform:translate(-50%,-50%);`;
        el.appendChild(blob);
        ci++;
      }
    }
    return () => { el.innerHTML = ''; };
  }, []);

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      width: '100vw',
      overflow: 'hidden',
      position: 'relative',
      backgroundColor: '#FAFAF9'
    }}>
      <div ref={blobsRef} className="blobs-bg" />
      <Sidebar />
      <main style={{
        flex: 1,
        overflowY: 'auto',
        position: 'relative',
        zIndex: 1
      }}>
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
