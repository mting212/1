"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { api } from "@/trpc/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { ensureContrast, DEFAULT_PRIMARY } from "@/lib/branding"

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

const DURATIONS = [15, 30, 45, 60] as const

const PROVIDERS = [
  { value: "zoom", label: "Zoom" },
  { value: "google_meet", label: "Google Meet" },
] as const

const RULE_TYPES = [
  "buffer_before", "buffer_after",
  "daily_limit", "weekly_limit", "monthly_limit",
  "min_notice_hours", "max_future_days",
] as const

type RuleType = (typeof RULE_TYPES)[number]

const RULE_LABELS: Record<RuleType, string> = {
  buffer_before: "Buffer Before (min)",
  buffer_after: "Buffer After (min)",
  daily_limit: "Daily Booking Limit",
  weekly_limit: "Weekly Booking Limit",
  monthly_limit: "Monthly Booking Limit",
  min_notice_hours: "Minimum Notice (hours)",
  max_future_days: "Max Future Days",
}

type Tab = "general" | "availability" | "settings" | "branding"

export default function EditLinkPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const utils = api.useUtils()

  const { data: links } = api.scheduleLinks.list.useQuery()
  const link = links?.find((l) => l.id === params.id)

  const { data: availRules } = api.availability.getRules.useQuery(
    { scheduleLinkId: params.id },
    { enabled: !!params.id },
  )
  const { data: scheduleRules } = api.availability.getScheduleRules.useQuery(
    { scheduleLinkId: params.id },
    { enabled: !!params.id },
  )

  const updateMutation = api.scheduleLinks.update.useMutation({
    onSuccess: () => utils.scheduleLinks.list.invalidate(),
  })
  const setRulesMutation = api.availability.setRules.useMutation()
  const setScheduleRuleMutation = api.availability.setScheduleRule.useMutation()

  const [tab, setTab] = useState<Tab>("general")
  const [saved, setSaved] = useState(false)

  // General form state
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [duration, setDuration] = useState(30)
  const [meetingProvider, setMeetingProvider] = useState<"zoom" | "google_meet">("zoom")

  // Availability state
  const [dayRules, setDayRules] = useState<Record<number, { startTime: string; endTime: string; enabled: boolean }>>({})

  // Schedule rules state
  const [scheduleRuleValues, setScheduleRuleValues] = useState<Record<string, number>>({})

  // Branding state
  const [primaryColor, setPrimaryColor] = useState(DEFAULT_PRIMARY)
  const [logoUrl, setLogoUrl] = useState("")
  const [welcomeMessage, setWelcomeMessage] = useState("")

  // Sync link data into form state
  useEffect(() => {
    if (!link) return
    setName(link.name)
    setDescription(link.description ?? "")
    setDuration(link.durationMinutes)
    setMeetingProvider(link.meetingProvider as "zoom" | "google_meet")

    const branding = link.branding as Record<string, unknown> | undefined
    setPrimaryColor((branding?.primaryColor as string) || DEFAULT_PRIMARY)
    setLogoUrl((branding?.logoUrl as string) ?? "")
    setWelcomeMessage((branding?.welcomeMessage as string) ?? "")
  }, [link])

  // Sync availability rules into form state
  useEffect(() => {
    if (!availRules) return
    const map: Record<number, { startTime: string; endTime: string; enabled: boolean }> = {}
    for (let d = 0; d < 7; d++) {
      map[d] = { startTime: "09:00", endTime: "17:00", enabled: false }
    }
    for (const rule of availRules) {
      map[rule.dayOfWeek] = {
        startTime: rule.startTime,
        endTime: rule.endTime,
        enabled: true,
      }
    }
    setDayRules(map)
  }, [availRules])

  // Sync schedule rules into form state
  useEffect(() => {
    if (!scheduleRules) return
    const map: Record<string, number> = {}
    for (const r of scheduleRules) {
      map[r.ruleType] = r.ruleValue
    }
    setScheduleRuleValues(map)
  }, [scheduleRules])

  if (!link) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p>Loading...</p>
      </div>
    )
  }

  const handleSaveGeneral = () => {
    updateMutation.mutate(
      { id: params.id, name, description: description || undefined, durationMinutes: duration, meetingProvider },
      { onSuccess: () => { setSaved(true); setTimeout(() => setSaved(false), 2000) } },
    )
  }

  const handleSaveAvailability = () => {
    const rules = DAYS.reduce<
      { dayOfWeek: number; startTime: string; endTime: string }[]
    >((acc, _, idx) => {
      const d = dayRules[idx]
      if (d?.enabled) {
        acc.push({ dayOfWeek: idx, startTime: d.startTime, endTime: d.endTime })
      }
      return acc
    }, [])
    setRulesMutation.mutate(
      { scheduleLinkId: params.id, rules },
      { onSuccess: () => { setSaved(true); setTimeout(() => setSaved(false), 2000) } },
    )
  }

  const handleSaveScheduleRule = (ruleType: RuleType, value: number) => {
    setScheduleRuleMutation.mutate(
      { scheduleLinkId: params.id, ruleType, ruleValue: value },
    )
  }

  const handleSaveBranding = () => {
    const validatedColor = ensureContrast(primaryColor)
    const branding: Record<string, unknown> = {
      primaryColor: validatedColor,
      welcomeMessage: welcomeMessage || undefined,
    }
    if (logoUrl) branding.logoUrl = logoUrl
    updateMutation.mutate(
      { id: params.id, branding },
      { onSuccess: () => { setSaved(true); setTimeout(() => setSaved(false), 2000) } },
    )
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "general", label: "General" },
    { key: "availability", label: "Availability" },
    { key: "settings", label: "Rules" },
    { key: "branding", label: "Branding" },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="text-gray-400 hover:text-gray-600 text-sm"
            >
              ← Back
            </button>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">{link.name}</h1>
          <p className="text-sm text-gray-500">
            /{link.slug} · {link.durationMinutes} min ·{" "}
            <Badge variant={link.isActive ? "default" : "secondary"}>
              {link.isActive ? "Active" : "Inactive"}
            </Badge>
          </p>
        </div>
        {saved && (
          <span className="text-sm text-green-600 font-medium animate-in fade-in">
            ✓ Saved
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
              tab === t.key
                ? "border-gray-900 text-gray-900"
                : "border-transparent text-gray-500 hover:text-gray-700",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "general" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">General Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Link Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. 30 Minute Meeting"
              />
            </div>
            <div>
              <Label htmlFor="desc">Description (optional)</Label>
              <Input
                id="desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description shown on booking page"
              />
            </div>
            <div>
              <Label>Duration</Label>
              <div className="flex gap-2 mt-1">
                {DURATIONS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDuration(d)}
                    className={cn(
                      "px-4 py-2 text-sm rounded-lg border transition-colors",
                      duration === d
                        ? "bg-gray-900 text-white border-gray-900"
                        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50",
                    )}
                  >
                    {d} min
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Meeting Provider</Label>
              <div className="flex gap-2 mt-1">
                {PROVIDERS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setMeetingProvider(p.value)}
                    className={cn(
                      "px-4 py-2 text-sm rounded-lg border transition-colors",
                      meetingProvider === p.value
                        ? "bg-gray-900 text-white border-gray-900"
                        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50",
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <Button onClick={handleSaveGeneral} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </CardContent>
        </Card>
      )}

      {tab === "availability" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Weekly Availability</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {DAYS.map((label, idx) => {
              const rule = dayRules[idx] ?? { startTime: "09:00", endTime: "17:00", enabled: false }
              return (
                <div key={label} className="flex items-center gap-3">
                  <label className="flex items-center gap-2 w-16">
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onChange={(e) =>
                        setDayRules((prev) => ({
                          ...prev,
                          [idx]: { ...rule, enabled: e.target.checked },
                        }))
                      }
                      className="w-4 h-4 rounded border-gray-300"
                    />
                    <span className="text-sm font-medium text-gray-700 w-10">
                      {label}
                    </span>
                  </label>
                  {rule.enabled && (
                    <div className="flex items-center gap-2">
                      <Input
                        type="time"
                        value={rule.startTime}
                        onChange={(e) =>
                          setDayRules((prev) => ({
                            ...prev,
                            [idx]: { ...rule, startTime: e.target.value },
                          }))
                        }
                        className="w-36"
                      />
                      <span className="text-gray-400 text-sm">to</span>
                      <Input
                        type="time"
                        value={rule.endTime}
                        onChange={(e) =>
                          setDayRules((prev) => ({
                            ...prev,
                            [idx]: { ...rule, endTime: e.target.value },
                          }))
                        }
                        className="w-36"
                      />
                    </div>
                  )}
                  {!rule.enabled && (
                    <span className="text-sm text-gray-400">Unavailable</span>
                  )}
                </div>
              )
            })}
            <Button
              onClick={handleSaveAvailability}
              disabled={setRulesMutation.isPending}
              className="mt-4"
            >
              {setRulesMutation.isPending ? "Saving..." : "Save Availability"}
            </Button>
          </CardContent>
        </Card>
      )}

      {tab === "settings" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Scheduling Rules</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(Object.entries(RULE_LABELS) as [RuleType, string][]).map(([ruleType, label]) => (
              <div key={ruleType}>
                <Label htmlFor={ruleType}>{label}</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    id={ruleType}
                    type="number"
                    min={1}
                    value={scheduleRuleValues[ruleType] ?? ""}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10)
                      setScheduleRuleValues((prev) => ({
                        ...prev,
                        [ruleType]: isNaN(v) ? 0 : v,
                      }))
                    }}
                    placeholder="Not set"
                    className="w-32"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const v = scheduleRuleValues[ruleType]
                      if (v && v > 0) handleSaveScheduleRule(ruleType, v)
                    }}
                    disabled={
                      !scheduleRuleValues[ruleType] ||
                      scheduleRuleValues[ruleType]! <= 0 ||
                      setScheduleRuleMutation.isPending
                    }
                  >
                    Set
                  </Button>
                  {scheduleRules?.find((r) => r.ruleType === ruleType) && (
                    <span className="text-xs text-green-600">✓ Configured</span>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {tab === "branding" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Branding</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="color">Primary Color</Label>
              <div className="flex items-center gap-3 mt-1">
                <Input
                  id="color"
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-16 h-10 p-1 cursor-pointer"
                />
                <Input
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  placeholder="#2563eb"
                  className="w-32"
                />
                <div
                  className="w-8 h-8 rounded border"
                  style={{ backgroundColor: ensureContrast(primaryColor) }}
                />
                <span className="text-xs text-gray-400">
                  WCAG AA: {ensureContrast(primaryColor) === primaryColor ? "✓" : "Auto-adjusted"}
                </span>
              </div>
            </div>
            <div>
              <Label htmlFor="logo">Logo URL (optional)</Label>
              <Input
                id="logo"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://example.com/logo.png"
              />
              {logoUrl && (
                <div className="mt-2 p-2 bg-gray-100 rounded w-fit">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={logoUrl} alt="Logo preview" className="h-8 object-contain" />
                </div>
              )}
            </div>
            <div>
              <Label htmlFor="welcome">Welcome Message</Label>
              <Input
                id="welcome"
                value={welcomeMessage}
                onChange={(e) => setWelcomeMessage(e.target.value)}
                placeholder="Welcome! Choose a time that works for you."
              />
            </div>
            <Button onClick={handleSaveBranding} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save Branding"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
