/* eslint-disable */
var currentPeriod = 'all'
var currentChannel = 'all'
var currentTopic = 'all'
var currentSearch = ''

function scrollActiveIntoView(btn) {
  if (window.innerWidth <= 720 && btn) {
    btn.scrollIntoView({ inline: 'center', behavior: 'smooth', block: 'nearest' })
  }
}

function filterPeriod(period) {
  currentPeriod = period
  document.querySelectorAll('.filter-btn').forEach(function (b) {
    b.classList.toggle('active', b.dataset.period === period)
    if (b.dataset.period === period) scrollActiveIntoView(b)
  })
  applyFilters()
}

function filterChannel(ch) {
  currentChannel = ch
  document.querySelectorAll('.channel-btn').forEach(function (b) {
    b.classList.toggle('active', b.dataset.channel === ch)
    if (b.dataset.channel === ch) scrollActiveIntoView(b)
  })
  applyFilters()
}

function filterSearch(q) {
  currentSearch = q.toLowerCase()
  applyFilters()
}

function filterTopic(topic) {
  currentTopic = topic
  document.querySelectorAll('.topic-btn').forEach(function (b) {
    b.classList.toggle('active', b.dataset.topic === topic)
    if (b.dataset.topic === topic) scrollActiveIntoView(b)
  })
  applyFilters()
}

function applyFilters() {
  var now = Date.now()
  var periodMs = {
    '24h': 24 * 60 * 60 * 1000,
    '3d': 3 * 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    all: Infinity,
  }
  var maxAge = periodMs[currentPeriod] || Infinity
  var visible = 0

  document.querySelectorAll('.digest-post').forEach(function (el) {
    var show = true
    if (currentPeriod !== 'all') {
      var dt = new Date(el.dataset.datetime).getTime()
      if (now - dt > maxAge) show = false
    }
    if (currentChannel !== 'all' && el.dataset.channel !== currentChannel) show = false
    if (currentTopic !== 'all') {
      var topics = (el.dataset.topic || '').split(/\s+/)
      if (topics.indexOf(currentTopic) === -1) show = false
    }
    if (currentSearch && el.dataset.text.indexOf(currentSearch) === -1) show = false
    el.style.display = show ? '' : 'none'
    if (show) visible++
  })

  document.getElementById('no-results').style.display = visible === 0 ? '' : 'none'
}
