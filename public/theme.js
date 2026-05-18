/* eslint-disable */
;(function () {
  var STORAGE_KEY = 'theme-preference'

  function getPreference() {
    var stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return stored
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }

  function apply(theme) {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(STORAGE_KEY, theme)
    // Sun glyph when on dark (click \u2192 go light), moon glyph when on light (click \u2192 go dark)
    var icon = theme === 'dark' ? '\u2600\uFE0F' : '\uD83C\uDF19'
    var nextLabel = theme === 'dark' ? '\u0412\u043A\u043B\u044E\u0447\u0438\u0442\u044C \u0441\u0432\u0435\u0442\u043B\u0443\u044E \u0442\u0435\u043C\u0443' : '\u0412\u043A\u043B\u044E\u0447\u0438\u0442\u044C \u0442\u0451\u043C\u043D\u0443\u044E \u0442\u0435\u043C\u0443'
    var btns = document.querySelectorAll('#theme-toggle, #theme-btn')
    for (var i = 0; i < btns.length; i++) {
      btns[i].textContent = icon
      btns[i].setAttribute('aria-label', nextLabel)
      btns[i].setAttribute('title', nextLabel)
    }
    // Sync browser chrome color
    var meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#000000' : '#ffffff')
  }

  // Apply immediately to avoid flash
  apply(getPreference())

  // Re-apply after DOM loads (for dynamically rendered buttons)
  document.addEventListener('DOMContentLoaded', function() {
    apply(getPreference())
  })

  window.toggleTheme = function () {
    var current = document.documentElement.getAttribute('data-theme') || 'light'
    apply(current === 'dark' ? 'light' : 'dark')
  }
})()
