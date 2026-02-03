import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

const Layout = () => {
  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      width: '100vw',
      overflow: 'hidden'
    }}>
      <Sidebar />
      <main style={{
        flex: 1,
        overflowY: 'auto',
        backgroundColor: '#f5f5f5'
      }}>
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;