// Bisect step 4: renders only the @assistant-ui/react test component.
import type { ChatMessage, ChatThread } from './types'
import type { DatasetInfo } from '@/components/corpus/datasets'
import { AssistantTest } from './assistant-test'

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
  return <AssistantTest />
}
