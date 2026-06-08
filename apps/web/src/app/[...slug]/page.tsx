import { notFound } from "next/navigation"
import { BookingCalendar } from "./_components/BookingCalendar"
import type { Metadata } from "next"

export const dynamic = "force-dynamic"

// Hard-coded demo link data for MVP (avoids module state isolation issues)
const DEMO_LINKS: Record<string, {
  id: string
  name: string
  slug: string
  description: string | null
  durationMinutes: number
  primaryColor?: string
  logoUrl?: string
  welcomeMessage?: string
}> = {
  "test/30min": {
    id: "link_demo_001",
    name: "30 Minute Meeting",
    slug: "test/30min",
    description: "Book a 30-minute chat with me",
    durationMinutes: 30,
    primaryColor: "#6366f1",
    welcomeMessage: "Welcome! Choose a time that works for you.",
  },
  "alex/15min": {
    id: "link_demo_002",
    name: "15 Minute Quick Call",
    slug: "alex/15min",
    description: "A quick sync to discuss your project",
    durationMinutes: 15,
    primaryColor: "#f59e0b",
  },
}

interface Props {
  params: Promise<{ slug: string[] }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const slugStr = slug.join("/")
  const link = DEMO_LINKS[slugStr]
  if (!link) return { title: "Not Found - MeetFlow" }
  return {
    title: `${link.name} | MeetFlow`,
    description: link.description ?? `Book a meeting`,
  }
}

export default async function BookingPage({ params }: Props) {
  const { slug } = await params
  const slugStr = slug.join("/")
  const link = DEMO_LINKS[slugStr]
  if (!link) notFound()

  return (
    <BookingCalendar
      scheduleLinkId={link.id}
      scheduleLinkSlug={link.slug}
      scheduleLinkName={link.name}
      organizerName="Test User"
      primaryColor={link.primaryColor || "#2563eb"}
      logoUrl={link.logoUrl}
      welcomeMessage={link.welcomeMessage}
      durationMinutes={link.durationMinutes}
    />
  )
}
