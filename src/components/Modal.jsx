import React from 'react'

export default function Modal({ open, onClose, title, children }){
  if(!open) return null
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-4 w-full max-w-md">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose} className="text-gray-400">Close</button>
        </div>
        <div>{children}</div>
      </div>
    </div>
  )
}
