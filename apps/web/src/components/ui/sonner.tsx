"use client"

import { Toaster as SonnerToaster } from "sonner"

type ToasterProps = React.ComponentProps<typeof SonnerToaster>

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <SonnerToaster
      richColors
      className="toaster group"
      {...props}
    />
  )
}

export { Toaster }
