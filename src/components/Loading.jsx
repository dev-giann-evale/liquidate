import React from 'react'

export default function Loading({ text = 'Loading...' }){
  return (
    <div className="flex items-center justify-center p-6">
      <div className="text-gray-300">{text}</div>
    </div>
  )
}
