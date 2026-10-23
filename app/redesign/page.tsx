import { redirect } from 'next/navigation'

// The Valora design now lives on the real application route.
// Keep old bookmarks working without maintaining a separate demo page.
export default function RedesignPage() {
  redirect('/')
}
