import { useState } from 'react'
import { useUi } from '../store/ui'
import { errorMessage } from '../lib/utils'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { toast } from '../store/ui'

export function ConfirmDialog() {
  const request = useUi((state) => state.confirm)
  const close = useUi((state) => state.closeConfirm)
  const [loading, setLoading] = useState(false)

  const confirm = async (): Promise<void> => {
    if (!request) return
    setLoading(true)
    try {
      await request.action()
      close()
    } catch (error) {
      toast('error', 'Action failed', errorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  const cancel = (): void => {
    if (!request) return
    try {
      request.onCancel?.()
    } finally {
      close()
    }
  }

  return (
    <Modal
      open={Boolean(request)}
      onClose={close}
      title={request?.title ?? ''}
      description={request?.description}
      size="sm"
      zIndex={140}
      footer={
        <>
          <Button variant="ghost" onClick={cancel} disabled={loading}>
            {request?.cancelLabel ?? 'Cancel'}
          </Button>
          <Button variant={request?.danger ? 'danger' : 'primary'} loading={loading} onClick={() => void confirm()}>
            {request?.confirmLabel ?? 'Confirm'}
          </Button>
        </>
      }
    >
      <p className="text-[13px] leading-relaxed text-muted">
        {request?.body ??
          'This action is applied immediately. You can reinstall or restore from a backup afterwards.'}
      </p>
    </Modal>
  )
}
