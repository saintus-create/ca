// Bisect step 3 stub: stands in for the real thread view while the store is tested.
import type { ChatMessage, ChatThread } from './types'
import type { DatasetInfo } from '@/components/corpus/datasets'

type ThreadViewProps = {
  thread: ChatThread
  datasets: DatasetInfo[]
  onSendText: (text: string) => void
  onCancel: () => void
  onReload: () => void
  onScopeChange: (scope: string) => void
  onSetMessages: (messages: readonly ChatMessage[]) => void
  onOpenMobileNav: () => void
}

export function ThreadView(_props: ThreadViewProps) {
  return <div>Thread view stub</div>
}
