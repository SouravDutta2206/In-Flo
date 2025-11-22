"use client"

import { Input } from "@/components/ui/input"

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
}

export function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <div className="p-2 border-b border-gray-700 flex-shrink-0">
      <Input
        placeholder="Search models..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-[#35373c] border-gray-600 focus:ring-blue-500 focus:border-blue-500 text-gray-100"
      />
    </div>
  )
}


