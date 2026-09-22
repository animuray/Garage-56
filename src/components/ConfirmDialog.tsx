import { X } from 'lucide-react'

export function ConfirmDialog({ message, onConfirm, onCancel, confirmLabel = 'Удалить' }: {
  message: string
  onConfirm: () => void
  onCancel: () => void
  confirmLabel?: string
}) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[200] p-4">
      <div
        className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl w-full max-w-sm"
       
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[#2a2a2a]">
          <h3 className="text-white font-semibold">Подтверждение</h3>
          <button onClick={onCancel} className="text-gray-500 hover:text-white"><X size={18} /></button>
        </div>
        <div className="px-5 py-4">
          <p className="text-gray-300 text-sm">{message}</p>
        </div>
        <div className="px-5 pb-5 flex gap-2">
          <button onClick={onCancel} className="btn-outline flex-1 text-sm py-2.5">Отмена</button>
          <button onClick={() => { onConfirm(); onCancel() }} className="flex-1 text-sm py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors">{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
