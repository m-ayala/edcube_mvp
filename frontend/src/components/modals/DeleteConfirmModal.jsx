const DeleteConfirmModal = ({ courseName, onConfirm, onCancel }) => {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000
      }}
      onClick={onCancel}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '30px',
          maxWidth: '400px',
          textAlign: 'center'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginTop: 0, color: '#dc3545' }}>Delete Course?</h2>
        
        <p style={{ marginBottom: '20px', color: '#666' }}>
          Are you sure you want to delete <strong>"{courseName}"</strong>?
        </p>
        
        <p style={{ marginBottom: '30px', color: '#dc3545', fontSize: '14px' }}>
          This action cannot be undone.
        </p>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1,
              padding: '12px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              flex: 1,
              padding: '12px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            Delete Permanently
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmModal;