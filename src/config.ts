// Hằng số toàn cục. Tham số gameplay sẽ được thêm vào đây theo docs/SPEC.md (không rải số "ma thuật" trong code).
export const APP_VERSION: string = __APP_VERSION__;
export const BUILD_HASH: string = __BUILD_HASH__;

/** Chuỗi phiên bản hiện ở màn Cài đặt, ví dụ "v0.1.0 (a1b2c3d)". */
export function versionLabel(): string {
  return `v${APP_VERSION} (${BUILD_HASH})`;
}
