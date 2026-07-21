// frontend/src/utils/googleDrivePicker.js
// Lets a user pick images straight from Google Drive instead of their local filesystem.
// Uses the `drive.file` scope (Picker-only, per-file access) so the app never needs
// Google's full OAuth verification review — see tasks/plan for the Cloud Console setup.

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

let scriptsPromise = null;
let tokenClient = null;
let cachedAccessToken = null;

const loadScript = (src) => new Promise((resolve, reject) => {
  if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
  const script = document.createElement('script');
  script.src = src;
  script.async = true;
  script.defer = true;
  script.onload = () => resolve();
  script.onerror = () => reject(new Error(`Failed to load ${src}`));
  document.head.appendChild(script);
});

export const loadGoogleApis = () => {
  if (scriptsPromise) return scriptsPromise;
  scriptsPromise = Promise.all([
    loadScript('https://accounts.google.com/gsi/client'),
    loadScript('https://apis.google.com/js/api.js').then(
      () => new Promise((resolve) => window.gapi.load('picker', resolve))
    ),
  ]);
  return scriptsPromise;
};

export const getDriveAccessToken = () => new Promise((resolve, reject) => {
  if (!CLIENT_ID) {
    reject(new Error('Google Drive is not configured (missing VITE_GOOGLE_CLIENT_ID).'));
    return;
  }
  if (cachedAccessToken) {
    resolve(cachedAccessToken);
    return;
  }
  if (!tokenClient) {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: DRIVE_SCOPE,
      callback: () => {}, // overridden per-request below
    });
  }
  tokenClient.callback = (response) => {
    if (response.error) {
      reject(new Error(response.error_description || 'Google Drive sign-in was cancelled.'));
      return;
    }
    cachedAccessToken = response.access_token;
    resolve(cachedAccessToken);
  };
  tokenClient.requestAccessToken({ prompt: cachedAccessToken ? '' : 'consent' });
});

// Accepts either a Drive folder URL (`.../folders/<id>`) or an `?id=<id>` link.
export const extractDriveFolderId = (driveLink) => {
  if (!driveLink) return null;
  const folderMatch = driveLink.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch) return folderMatch[1];
  const idMatch = driveLink.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  return idMatch ? idMatch[1] : null;
};

export const openDrivePicker = ({ accessToken, folderId, maxItems = 1, onPicked, onCancel }) => {
  const view = new window.google.picker.DocsView(window.google.picker.ViewId.DOCS_IMAGES)
    .setIncludeFolders(true)
    .setSelectFolderEnabled(false);
  if (folderId) view.setParent(folderId);

  const builder = new window.google.picker.PickerBuilder()
    .addView(view)
    .setOAuthToken(accessToken)
    .setDeveloperKey(API_KEY)
    .setCallback((data) => {
      if (data.action === window.google.picker.Action.PICKED) {
        onPicked(data.docs.slice(0, maxItems));
      } else if (data.action === window.google.picker.Action.CANCEL) {
        onCancel?.();
      }
    });

  if (maxItems > 1) builder.enableFeature(window.google.picker.Feature.MULTISELECT_ENABLED);

  builder.build().setVisible(true);
};

export const fetchDriveFileAsFile = async (fileId, name, mimeType, accessToken) => {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Failed to download "${name}" from Drive`);
  const blob = await res.blob();
  return new File([blob], name, { type: mimeType || blob.type });
};
