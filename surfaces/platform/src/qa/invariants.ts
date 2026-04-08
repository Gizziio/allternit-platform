export function assertSinglePrimaryView() {
  if (typeof document === "undefined") return;
  const roots = document.querySelectorAll("[data-allternit-primary-root]");
  if (roots.length !== 1) {
    console.error("UI LAW violation: expected 1 primary view root, found", roots.length);
  }
}

export function assertNoDockingOutsideBrowser() {
  if (typeof document === 'undefined') return;
  const flexLayouts = document.querySelectorAll('.flexlayout__layout');
  const browserCapsule = document.querySelector('[data-allternit-capsule="browser"]');
  
  flexLayouts.forEach(layout => {
    if (!browserCapsule || !browserCapsule.contains(layout)) {
      console.error('UI LAW violation: FlexLayout found outside of Browser capsule');
    }
  });
}
