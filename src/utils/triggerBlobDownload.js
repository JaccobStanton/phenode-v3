// =============================================================================
// triggerBlobDownload — kick off a browser file-download from a Blob.
// =============================================================================
//
// The standard recipe for "user clicks a button → file saves to disk":
//
//   1. Create an object URL pointing at the Blob.
//   2. Make a hidden <a download="..."> with that URL as href.
//   3. Append it to the document (Firefox is strict about detached
//      anchors — it'll silently no-op if the element isn't in the DOM).
//   4. .click() the anchor.
//   5. Remove the anchor and revoke the URL so we don't leak memory.
//
// Reusable across every place in the app that pulls a file from the
// backend (CSV exports, ZIP exports, image bulk downloads, future PDF
// reports, etc.) — they all converge on this helper instead of each
// re-implementing the anchor dance.
//
// @param {Blob} blob - file payload (already in the right MIME type)
// @param {string} [filename='download'] - suggested Save As name. The
//   browser respects the `download` attribute when the URL is same-
//   origin (object URLs always are), so this is what the user sees in
//   the dialog. Falls back to "download" only if the caller passes
//   nothing AND the backend didn't supply a Content-Disposition.

export default function triggerBlobDownload(blob, filename = 'download') {
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
