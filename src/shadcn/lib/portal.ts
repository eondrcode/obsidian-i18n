const PORTAL_CONTAINER_ID = "i18n-portal-root"

export function createI18nPortalContainer() {
  // 保留 body 内的焦点行为，同时让弹层继承插件作用域样式。
  const container = document.createElement("div")
  container.id = PORTAL_CONTAINER_ID
  container.className = "i18n-ui"
  document.body.appendChild(container)
  return container
}

export function getI18nPortalContainer() {
  return document.getElementById(PORTAL_CONTAINER_ID)
}
