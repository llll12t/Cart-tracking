"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function LiffQueryRouter() {
  const router = useRouter()

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const bookingId = params.get('bookingId')
      if (bookingId) {
        // use replace so user won't go back to the LIFF start URL
        router.replace(`/confirm/booking/${bookingId}`)
      }
    } catch (e) {
      // ignore
    }
  }, [router])

  return null
}
