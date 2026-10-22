const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// `impact` (optional, from GET /api/curricula/{id}/delete-impact) names who is affected. `checking`
// disables the button while it loads; `error` shows a failed delete without closing the dialog.
const DeleteConfirmModal = ({ courseName, onConfirm, onCancel, impact = null, checking = false, busy = false, disabled = false, error = '' }) => {
  const collaborators = impact?.collaborators || 0;
  const pending = impact?.pending_invites || 0;
  const links = impact?.active_links || 0;
  const affected = collaborators + pending + links > 0;
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
        
        {affected ? (
          <p data-testid="delete-impact" style={{ marginBottom: '20px', color: '#666', lineHeight: 1.5 }}>
            Delete <strong>'{courseName}'</strong>?{' '}
            {plural(collaborators, 'collaborator', 'collaborators')} will lose access,{' '}
            {plural(pending, 'pending invite', 'pending invites')} will be cancelled and{' '}
            {plural(links, 'view-only link', 'view-only links')} will stop working.
          </p>
        ) : (
          <p style={{ marginBottom: '20px', color: '#666' }}>
            Are you sure you want to delete <strong>"{courseName}"</strong>?
          </p>
        )}
        {checking && <p style={{ margin: '0 0 12px', color: '#888', fontSize: '14px' }}>Checking who has access…</p>}
        {error && <p role="alert" style={{ margin: '0 0 12px', color: '#dc3545', fontSize: '14px' }}>{error}</p>}
        
        <p style={{ marginBottom: '30px', color: '#dc3545', fontSize: '15.4px' }}>
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
              fontSize: '17.6px'
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={checking || busy || disabled}
            style={{
              flex: 1,
              padding: '12px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: checking || busy || disabled ? 'not-allowed' : 'pointer',
              opacity: checking || busy || disabled ? 0.6 : 1,
              fontSize: '17.6px'
            }}
          >
            {busy ? 'Deleting…' : 'Delete Permanently'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmModal;