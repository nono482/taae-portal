import { getNotifications } from '@/app/actions/notifications'
import NotificationsClient from './NotificationsClient'

export default async function NotificationsPage() {
  const notifs = await getNotifications()
  return <NotificationsClient initialNotifs={notifs} />
}
