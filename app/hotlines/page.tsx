"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Phone, ArrowLeft } from "lucide-react"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

interface Hotline {
  id: string
  name: string
  number: string
  description?: string
}

export default function HotlinesPage() {
  const [hotlines, setHotlines] = useState<Hotline[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchHotlines = async () => {
      try {
        const { data, error } = await supabase
          .from('hotlines')
          .select('*')
          .order('name', { ascending: true })

        if (error) throw error
        setHotlines(data || [])
      } catch (err) {
        console.error('Error fetching hotlines:', err)
        setError('Failed to load hotlines. Please try again later.')
      } finally {
        setLoading(false)
      }
    }

    fetchHotlines()
  }, [])

  const handleBack = () => {
    if (window.history.length > 1) {
      window.history.back()
    } else {
      window.location.href = '/'
    }
  }
  if (loading) {
    return (
      <div className="min-h-screen bg-orange-50 p-4 sm:p-6 lg:p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-orange-700 font-medium">Loading hotlines...</p>
        </div>
      </div>
    )
  }
  if (error) {
    return (
      <div className="min-h-screen bg-orange-50 p-4 sm:p-6 lg:p-8 flex items-center justify-center">
        <div className="text-center max-w-md bg-white p-6 rounded-lg shadow-md">
          <div className="text-red-500 mb-4">
            <svg className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-orange-800 mb-2">Error Loading Hotlines</h2>
          <p className="text-orange-700 mb-6">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 transition-colors font-medium"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }
  return (
    <div className="min-h-screen bg-orange-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <button 
            onClick={handleBack}
            className="flex items-center text-orange-600 hover:text-orange-800 mb-4 transition-colors"
          >
            <ArrowLeft className="h-5 w-5 mr-1" />
            <span>Back</span>
          </button>
          
          <div className="text-center mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-black-800 mb-2">Emergency Hotlines</h1>
            <p className="text-black-700 font-medium">Important contact numbers for emergencies in Bulan, Sorsogon</p>
          </div>

          <Card className="shadow-md border-orange-200 mb-6">
            <CardHeader className="bg-orange-500 text-white">
              <CardTitle className="flex items-center">
                <Phone className="mr-2 h-5 w-5" /> Emergency Contacts
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 bg-white">
              {hotlines.length > 0 ? (
                <div className="space-y-4">
                  {hotlines.map((hotline) => (
                    <div key={hotline.id} className="p-4 border border-orange-100 rounded-lg hover:bg-orange-50 transition-colors">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start">
                        <div className="mb-2 sm:mb-0">
                          <h3 className="font-medium text-black-900">{hotline.name}</h3>
                          {hotline.description && (
                            <p className="text-sm text-black-700 mt-1">{hotline.description}</p>
                          )}
                        </div>
                        <a 
                          href={`tel:${hotline.number.replace(/\D/g, '')}`}
                          className="flex items-center text-red-600 hover:text-red-800 whitespace-nowrap sm:ml-4 mt-2 sm:mt-0"
                        >
                          <Phone className="h-4 w-4 mr-1" />
                          <span className="font-medium">{hotline.number}</span>
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-black-600">No hotlines available at this time.</p>
                  <p className="text-sm text-black-500 mt-2">Please check back later or contact the MDRRMO office directly.</p>
                </div>
              )}
            </CardContent>
          </Card>
          <div className="bg-orange-50 p-4 rounded-lg border border-orange-100">
            <h3 className="font-medium text-black-800 mb-2">Important Reminder</h3>
            <p className="text-sm text-black-700">
              In case of an emergency, please call the appropriate hotline number immediately displayed or use this application to report an incident directly to mdrrmo. 
              For life-threatening situations, call the emergency hotline at <strong className="text-red-900">911</strong> or visit the nearest hospital.
            </p>
          </div>
          <div className="mt-8 text-center text-sm text-black-800">
            <p>&copy; {new Date().getFullYear()} MDRRMO Bulan, Sorsogon. All rights reserved.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
