export function showToast(message: string, type: 'success' | 'error' | 'info' = 'success') {
  let container = document.querySelector('.ax-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'ax-toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `ax-toast ax-toast-${type}`;
  toast.textContent = message;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-20px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
