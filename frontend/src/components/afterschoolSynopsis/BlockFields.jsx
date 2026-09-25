// frontend/src/components/afterschoolSynopsis/BlockFields.jsx
//
// Shared title + description + photo-grid UI for one block — used by both
// EntryFormView.jsx (teacher flow) and AdminClassView.jsx's inline pencil-edit
// form, so the block-editing UI is defined once. The photo grid (72x72
// thumbnails, dashed "+" add-tile, absolutely-positioned popover with
// outside-click-to-close) is copied from the camp-synopsis feature's
// CampEntryView.jsx (:381-466 markup, :213-265 handlePhotoAdd/handleDrivePick),
// adapted from per-day to per-block. Do not fork googleDrivePicker.js — this
// is just one more consumer of its exports, called with no folderId since
// this feature has no per-month Drive-folder-link concept.

import { useState, useRef } from 'react';
import { Plus, X, HardDriveDownload, Upload } from 'lucide-react';
import { PHOTO_MAX } from '../../constants/afterschoolSynopsisSchema';
import { uploadPhoto } from '../../services/afterschoolSynopsisService';
import {
  loadGoogleApis,
  getDriveAccessToken,
  openDrivePicker,
  fetchDriveFileAsFile,
} from '../../utils/googleDrivePicker';

const FONT = "'DM Sans', sans-serif";

const fieldInput = {
  width: '100%', padding: '11px 14px', borderRadius: 10,
  border: '1.5px solid rgba(255,255,255,0.9)', fontSize: 14,
  fontFamily: FONT, color: '#1e1e2e',
  background: 'rgba(255,255,255,0.7)', outline: 'none', boxSizing: 'border-box',
};

const focusField = (e) => { e.target.style.borderColor = '#ACD8F0'; e.target.style.boxShadow = '0 0 0 3px rgba(172,216,240,0.3)'; };
const blurField = (e) => { e.target.style.borderColor = 'rgba(255,255,255,0.9)'; e.target.style.boxShadow = 'none'; };

export default function BlockFields({
  value,
  onChange,
  gradeSlug,
  typeSlug,
  monthId,
  blockIndex,
  titlePlaceholder = 'Title (optional)',
  descPlaceholder = 'What happened?',
  showPhotos = true, // false for the admin's monthly intro (title + description only)
}) {
  const [uploading, setUploading] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const fileRef = useRef(null);

  const photoUrls = value.photo_urls || [];
  const photoCount = photoUrls.length;

  const handlePhotoAdd = async (files) => {
    const toUpload = Array.from(files).slice(0, PHOTO_MAX - photoCount);
    if (!toUpload.length) return;
    setUploading(true);
    const urls = [];
    for (const file of toUpload) {
      try {
        const { url } = await uploadPhoto(file, gradeSlug, typeSlug, monthId, blockIndex);
        urls.push(url);
      } catch (err) {
        alert(`Upload failed: ${err.message}`);
      }
    }
    if (urls.length) onChange('photo_urls', [...photoUrls, ...urls]);
    setUploading(false);
  };

  const handleDrivePick = async () => {
    setAddMenuOpen(false);
    const remaining = PHOTO_MAX - photoCount;
    if (remaining <= 0) return;
    try {
      await loadGoogleApis();
      const accessToken = await getDriveAccessToken();
      openDrivePicker({
        accessToken,
        folderId: undefined, // no per-month Drive folder concept in this feature
        maxItems: remaining,
        onPicked: async (docs) => {
          setUploading(true);
          try {
            const files = await Promise.all(
              docs.map((doc) => fetchDriveFileAsFile(doc.id, doc.name, doc.mimeType, accessToken))
            );
            await handlePhotoAdd(files);
          } catch (err) {
            alert(`Couldn't add photo from Drive: ${err.message}`);
          } finally {
            setUploading(false);
          }
        },
      });
    } catch (err) {
      alert(`Google Drive sign-in failed: ${err.message}`);
    }
  };

  const removePhoto = (idx) => {
    const next = [...photoUrls];
    next.splice(idx, 1);
    onChange('photo_urls', next);
  };

  return (
    <div>
      <input
        type="text"
        value={value.title || ''}
        onChange={(e) => onChange('title', e.target.value)}
        placeholder={titlePlaceholder}
        style={{ ...fieldInput, marginBottom: 10, fontWeight: 500 }}
        onFocus={focusField}
        onBlur={blurField}
      />

      <textarea
        value={value.raw_text || ''}
        onChange={(e) => onChange('raw_text', e.target.value)}
        placeholder={descPlaceholder}
        rows={4}
        style={{
          ...fieldInput,
          padding: '14px 16px', borderRadius: 12,
          fontSize: 15, lineHeight: 1.65, resize: 'vertical',
        }}
        onFocus={focusField}
        onBlur={blurField}
      />

      {showPhotos && <div style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
          {photoUrls.map((url, i) => (
            <div key={i} style={{ position: 'relative', width: 72, height: 72, borderRadius: 10, overflow: 'hidden', flexShrink: 0 }}>
              <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <button
                onClick={() => removePhoto(i)}
                style={{
                  position: 'absolute', top: 3, right: 3, background: 'rgba(0,0,0,0.55)',
                  border: 'none', borderRadius: '50%', width: 18, height: 18,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0,
                }}
              >
                <X size={10} color="#fff" />
              </button>
            </div>
          ))}

          {photoCount < PHOTO_MAX && (
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <button
                onClick={() => setAddMenuOpen((o) => !o)}
                disabled={uploading}
                style={{
                  width: 72, height: 72, borderRadius: 10,
                  border: '1.5px dashed #C8BFB5', background: '#FAF9F6',
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', cursor: uploading ? 'wait' : 'pointer', flexShrink: 0,
                }}
              >
                {uploading
                  ? <span style={{ fontSize: 10, color: '#8b7355' }}>Uploading…</span>
                  : <Plus size={18} color="#8b7355" />}
              </button>

              {addMenuOpen && (
                <>
                  <div
                    onClick={() => setAddMenuOpen(false)}
                    style={{ position: 'fixed', inset: 0, zIndex: 9 }}
                  />
                  <div style={{
                    position: 'absolute', top: 78, left: 0, zIndex: 10,
                    background: '#fff', borderRadius: 10, overflow: 'hidden',
                    boxShadow: '0 4px 18px rgba(0,0,0,0.15)', border: '1px solid #F0EDE8',
                    width: 210,
                  }}>
                    <button
                      onClick={handleDrivePick}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                        padding: '10px 14px', border: 'none', background: 'none',
                        cursor: 'pointer', fontSize: 13, fontFamily: FONT, color: '#1C1917', textAlign: 'left',
                      }}
                    >
                      <HardDriveDownload size={15} color="#8b7355" /> Choose from Google Drive
                    </button>
                    <button
                      onClick={() => { setAddMenuOpen(false); fileRef.current?.click(); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                        padding: '10px 14px', border: 'none', borderTop: '1px solid #F0EDE8', background: 'none',
                        cursor: 'pointer', fontSize: 13, fontFamily: FONT, color: '#1C1917', textAlign: 'left',
                      }}
                    >
                      <Upload size={15} color="#8b7355" /> Upload from computer
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          <input
            ref={fileRef}
            type="file" accept="image/*" multiple
            style={{ display: 'none' }}
            onChange={(e) => handlePhotoAdd(e.target.files)}
          />
        </div>

        <div style={{ fontSize: 11, color: '#8b7355' }}>
          {photoCount} of {PHOTO_MAX} photos
        </div>
      </div>}
    </div>
  );
}
