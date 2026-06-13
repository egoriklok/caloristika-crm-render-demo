"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

type TabsContextValue = {
  value: string
  setValue: (value: string) => void
}

const TabsContext = React.createContext<TabsContextValue | null>(null)

export function Tabs({
  value,
  onValueChange,
  defaultValue,
  className,
  children
}: {
  value?: string
  onValueChange?: (value: string) => void
  defaultValue: string
  className?: string
  children: React.ReactNode
}) {
  const [internalValue, setInternalValue] = React.useState(defaultValue)
  const currentValue = value ?? internalValue
  const setValue = React.useCallback(
    (nextValue: string) => {
      setInternalValue(nextValue)
      onValueChange?.(nextValue)
    },
    [onValueChange]
  )
  return (
    <TabsContext.Provider value={{ value: currentValue, setValue }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  )
}

export function TabsList({ className, children }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("inline-flex min-h-10 items-center rounded-md bg-muted p-1", className)}
      role="tablist"
    >
      {children}
    </div>
  )
}

export function TabsTrigger({
  value,
  className,
  children
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }) {
  const context = React.useContext(TabsContext)
  if (!context) {
    throw new Error("TabsTrigger must be used inside Tabs")
  }
  const active = context.value === value
  const activate = React.useCallback(() => {
    if (active) return
    context.setValue(value)
  }, [active, context, value])
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      tabIndex={active ? 0 : -1}
      className={cn(
        "rounded-sm px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
        active && "bg-background text-foreground shadow-sm",
        className
      )}
      onPointerDown={(event) => {
        if (event.button !== 0) return
        activate()
      }}
      onClick={activate}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          activate()
        }
      }}
    >
      {children}
    </button>
  )
}

export function TabsContent({
  value,
  className,
  children
}: React.HTMLAttributes<HTMLDivElement> & { value: string }) {
  const context = React.useContext(TabsContext)
  if (!context) {
    throw new Error("TabsContent must be used inside Tabs")
  }
  if (context.value !== value) {
    return null
  }
  return <div className={cn("mt-4", className)}>{children}</div>
}
