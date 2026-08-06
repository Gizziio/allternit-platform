import { loadSettings as _load, getSettings } from './services/settings.js';
import { config } from './config.js';

export { getSettings };

export async function loadSettings() {
  return _load();
}

/**
 * WEBOBSIDIAN_PASSWORD không còn ghi vào settings.json; nó được dùng như mật khẩu
 * override (khôi phục khi quên pass), kiểm tra trực tiếp lúc login. Mật khẩu đăng
 * nhập mặc định là 123456. Chỉ log để báo override đang bật.
 */
export async function setPasswordIfInitial(): Promise<void> {
  if (config.initialPassword) {
    console.log('[boot] WEBOBSIDIAN_PASSWORD active as recovery/override password');
  }
}
