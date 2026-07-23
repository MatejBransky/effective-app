// Opened via modal.open(render, { replace: true }) - demonstrates the "supersede
// whatever was open, permanently" mode: if some other modal was showing, it's discarded
// (resolved with undefined) the moment this one opens, and dismissing this one reveals
// nothing, unlike DeleteDialog's Help button (which stacks temporarily and returns to
// DeleteDialog on close).
export function NotifyDialog(props: { readonly onDismiss: () => void }) {
  return (
    <div className="shell-modal-content">
      <p>New activity on this item.</p>
      <button type="button" onClick={() => props.onDismiss()}>
        Dismiss
      </button>
    </div>
  );
}
