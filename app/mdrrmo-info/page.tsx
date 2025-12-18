"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Info, ArrowLeft } from "lucide-react"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

interface MdrrmoInfo {
  id: string
  content: string
  last_updated_at: string
}

export default function MdrrmoInfoPage() {
  const [mdrrmoInfo, setMdrrmoInfo] = useState<MdrrmoInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchMdrrmoInfo = async () => {
      try {
        const { data, error } = await supabase
          .from('mdrrmo_info')
          .select('*')
          .single()

        if (error && error.code !== 'PGRST116') throw error 
        
        if (data) {
          setMdrrmoInfo(data)
        }
      } catch (err) {
        console.error('Error fetching MDRRMO info:', err)
        setError('Failed to load MDRRMO information. Please try again later.')
      } finally {
        setLoading(false)
      }
    }

    fetchMdrrmoInfo()
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
          <p className="mt-4 text-orange-700 font-medium">Loading MDRRMO information...</p>
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
          <h2 className="text-xl font-semibold text-orange-800 mb-2">Error Loading Information</h2>
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
            <h1 className="text-2xl sm:text-3xl font-bold text-orange-800 mb-2">MDRRMO Bulan, Sorsogon</h1>
            <p className="text-orange-700 font-medium">Municipal Disaster Risk Reduction and Management Office</p>
          </div>

          <Card className="shadow-md border-orange-200">
            <CardHeader className="bg-orange-500 text-white">
              <CardTitle className="flex items-center">
                <Info className="mr-2 h-5 w-5" /> About MDRRMO Bulan
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 bg-white">
              {mdrrmoInfo ? (
                <div 
                  className="prose max-w-none text-gray-800"
                  dangerouslySetInnerHTML={{ __html: mdrrmoInfo.content }}
                />
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500">No information available at this time.</p>
                  <p className="text-sm text-gray-400 mt-2">Please check back later or contact the MDRRMO office directly.</p>
                </div>
              )}
              {mdrrmoInfo?.last_updated_at && (
                <p className="text-sm text-orange-700 mt-4 font-medium">
                  Last updated: {new Date(mdrrmoInfo.last_updated_at).toLocaleDateString()}
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="mt-6 shadow-md border-orange-200">
            <CardHeader className="bg-orange-500 text-white">
              <CardTitle className="flex items-center">
                <Info className="mr-2 h-5 w-5" /> Our Vision
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 bg-white">
              <p className="text-gray-700">
                A disaster-resilient community with safe and adaptive capacity to manage hazards and risks 
                through a culture of safety, sustainable development, and good governance.
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6 shadow-md border-orange-200">
          <CardHeader className="bg-orange-500 text-white">
            <CardTitle className="flex items-center">
              <Info className="mr-2 h-5 w-5" /> Our Services
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 bg-white">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[
                "Disaster Preparedness Training",
                "Emergency Response",
                "Risk Assessment",
                "Community Drills",
                "Early Warning Systems",
                "Disaster Relief Operations"
              ].map((service, index) => (
                <div key={index} className="flex items-start">
                  <span className="text-orange-600 mr-2">•</span>
                  <span className="text-gray-700">{service}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
    
