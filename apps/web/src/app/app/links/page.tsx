"use client"

import { api } from "@/trpc/react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

export default function LinksPage() {
  const router = useRouter()
  const { data: links, isLoading } = api.scheduleLinks.list.useQuery()
  const [copied, setCopied] = useState<string | null>(null)

  const copyLink = (slug: string) => {
    const url = `${window.location.origin}/${slug}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(slug)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Scheduling Links
          </h1>
          <p className="text-sm text-gray-500">
            Manage your booking pages
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="h-24 bg-gray-100 rounded-lg animate-pulse"
            />
          ))}
        </div>
      ) : links && links.length > 0 ? (
        <div className="space-y-3">
          {links.map((link) => (
            <Card key={link.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">
                      {link.name}
                    </span>
                    <Badge
                      variant={link.isActive ? "default" : "secondary"}
                    >
                      {link.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    /{link.slug} · {link.durationMinutes} min
                  </div>
                  {link.description && (
                    <div className="text-xs text-gray-400 mt-0.5">
                      {link.description}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyLink(link.slug)}
                  >
                    {copied === link.slug ? "Copied!" : "Copy Link"}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => router.push(`/app/links/${link.id}`)}
                  >
                    Edit
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-gray-400">
          <div className="text-5xl mb-4">🔗</div>
          <p className="text-lg font-medium">No links yet</p>
          <p className="text-sm">
            Create your first scheduling link to start receiving bookings.
          </p>
        </div>
      )}
    </div>
  )
}
