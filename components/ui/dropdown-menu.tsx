"use client"

import * as React from "react"
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu"
import { CheckIcon, SparklesIcon } from "lucide-react"

import { cn } from "@/lib/utils"

type Model = { id: string; label: string; current?: boolean }

function DropdownMenu({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) {
  return <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props} />
}

function DropdownMenuPortal({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Portal>) {
  return <DropdownMenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />
}

function DropdownMenuTrigger({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>) {
  return <DropdownMenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />
}

function DropdownMenuContent({
  className,
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPortal>
      <DropdownMenuPrimitive.Content
        data-slot="dropdown-menu-content"
        sideOffset={sideOffset}
        className={cn(
          "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 max-h-[var(--radix-dropdown-menu-content-available-height)] min-w-[14rem] overflow-hidden rounded-xl border border-white/5 p-1.5 shadow-2xl shadow-black/50",
          className
        )}
        {...props}
      />
    </DropdownMenuPortal>
  )
}

function DropdownMenuItem({
  className,
  inset,
  variant = "default",
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & {
  inset?: boolean
  variant?: "default" | "destructive"
}) {
  return (
    <DropdownMenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(
        "focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 dark:data-[variant=destructive]:focus:bg-destructive/20 data-[variant=destructive]:focus:text-destructive data-[variant=destructive]:*:[svg]:!text-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='text-'])]:size-4 relative flex cursor-default items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8",
        className
      )}
      {...props}
    />
  )
}

function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem>) {
  return (
    <DropdownMenuPrimitive.CheckboxItem
      data-slot="dropdown-menu-checkbox-item"
      className={cn(
        "focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='text-'])]:size-4 relative flex cursor-default items-center gap-2 rounded-lg py-2 pr-2 pl-8 text-[13px] outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className
      )}
      checked={checked}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <CheckIcon className="size-4" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  )
}

function DropdownMenuLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Label> & {
  inset?: boolean
}) {
  return (
    <DropdownMenuPrimitive.Label
      data-slot="dropdown-menu-label"
      data-inset={inset}
      className={cn(
        "text-muted-foreground px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] data-[inset]:pl-8",
        className
      )}
      {...props}
    />
  )
}

function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn("-mx-1 my-1 h-px bg-border/70", className)}
      {...props}
    />
  )
}

export function ModelPicker({
  models,
  selectedId,
  onSelect,
  customModels,
  onSelectCustom,
  className,
}: {
  models: Model[]
  selectedId: string | null
  onSelect: (id: string) => void
  customModels?: Model[]
  onSelectCustom?: (id: string) => void
  className?: string
}) {
  if (models.length === 0 && !customModels?.length) return null
  const selectedCustom = customModels?.find((m) => m.id === selectedId)
  const selectedModel = models.find((m) => m.id === selectedId) ?? models.find((m) => m.current) ?? models[0]
  const selected = selectedCustom ?? selectedModel
  const activeId = selectedCustom ? selectedCustom.id : selectedModel?.id

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Choose chat model"
          title={selected.label}
          className={cn(
            "group inline-flex h-7 max-w-[11rem] items-center gap-1.5 rounded-full border border-border bg-muted/20 px-2.5 font-mono text-[10.5px] font-medium text-muted-foreground transition-all hover:border-foreground/20 hover:bg-accent hover:text-foreground",
            className
          )}
        >
          <SparklesIcon
            size={13}
            className="shrink-0 text-muted-foreground/70 transition-colors group-hover:text-foreground"
          />
          <span className="truncate">{selected.label}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-64">
        <DropdownMenuLabel>Chat models</DropdownMenuLabel>
        {models.map((m) => {
          const isSelected = m.id === activeId
          return (
            <DropdownMenuCheckboxItem
              key={m.id}
              checked={isSelected}
              onCheckedChange={() => {
                if (!isSelected) onSelect(m.id)
              }}
              className="cursor-pointer"
            >
              <span className="min-w-0 flex-1 truncate font-medium">{m.label}</span>
              <span
                className={cn(
                  "shrink-0 text-[10px] leading-none",
                  isSelected ? "text-foreground" : "text-transparent"
                )}
                aria-hidden
              >
                ●
              </span>
            </DropdownMenuCheckboxItem>
          )
        })}
        <DropdownMenuSeparator />
        <p className="px-2.5 py-1.5 text-[10px] leading-snug text-muted-foreground">
          SyncAI uses the selected model for every answer in this chat.
        </p>
        {customModels && customModels.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>My models</DropdownMenuLabel>
            {customModels.map((cm: Model) => (
              <DropdownMenuCheckboxItem
                key={cm.id}
                checked={selectedId === cm.id}
                onCheckedChange={() => {
                  if (selectedId !== cm.id) onSelectCustom?.(cm.id)
                }}
                className="cursor-pointer"
              >
                <span className="min-w-0 flex-1 truncate font-medium">{cm.label}</span>
                <span
                  className={cn(
                    "shrink-0 text-[10px] leading-none",
                    selectedId === cm.id ? "text-foreground" : "text-transparent"
                  )}
                  aria-hidden
                >
                  ●
                </span>
              </DropdownMenuCheckboxItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
}
