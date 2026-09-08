self.addEventListener('push', function (e) {
  let data = { title: 'Garage 56', body: 'Новая запись', url: '/crm/appointments' }
  try { if (e.data) data = { ...data, ...e.data.json() } } catch (_) {}
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: data.url },
      vibrate: [200, 100, 200],
    })
  )
})

self.addEventListener('notificationclick', function (e) {
  e.notification.close()
  const url = e.notification.data?.url || '/crm/appointments'
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (const client of list) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      return clients.openWindow(url)
    })
  )
})
