// Which Telegram notification (if any) a CRM change to an appointment should trigger.
// `prev` is the row before the update, `patch` is the PATCH body the CRM sent.
//
// Note: in the CRM the "Подтвердить" button moves an order straight to `in_progress`,
// so that transition is what tells the client "confirmed, the car is in work" (with the master's name).
// A change of master on its own does NOT notify the client; a change of date/time does.
const toHM = (t) => (t ? String(t).slice(0, 5) : '')

function detectAppointmentEvent(prev, patch) {
  if (!prev) return null
  const statusChanged = patch.status !== undefined && patch.status !== prev.status
  if (statusChanged) {
    return ({ confirmed: 'confirmed', in_progress: 'in_progress', cancelled: 'cancelled', completed: 'completed' })[patch.status] || null
  }
  const moved = (patch.date !== undefined && patch.date !== prev.date) ||
                (patch.time !== undefined && toHM(patch.time) !== toHM(prev.time))
  return moved ? 'rescheduled' : null
}

module.exports = { detectAppointmentEvent }
